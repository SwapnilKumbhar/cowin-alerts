import { Client, Guild, Message, TextChannel } from 'discord.js';
import { Action } from './config/types';
import { loadChannels, subscriptionsChannelID } from './discord/channelHandler';
import { loadRoles } from './discord/roleHandler';
import { loadPincodesPerDistrict, loadDatabaseConnectionAndCache, managePincodeSubscription, pincodeRegExp } from './subscriptions/pincode';
import { aurangabad, checkDistrict, initDistricts, manageDistrictSubscription } from './subscriptions/district';

require('dotenv').config({ path: './config/.env.uat' });

const client = new Client()

client.login(process.env.BOT_TOKEN)

client.on('ready', async () => {
    await initBot()
    console.log(`\n${process.env.BOT_NAME} is ready`);
});

client.on('message', (message) => {
    const textChannel: TextChannel = <TextChannel>message.channel
    if (textChannel.name === process.env.SUBSCRIPTIONS && message.author.username !== process.env.BOT_NAME) {
        manageSubscription(message)
    } else if(textChannel.name === process.env.GENERAL && message.author.username !== process.env.BOT_NAME) {
        replyIfUserTriesToSubscribeInGeneral(message)
    }
});

async function initBot() {
    // Getting the first guild only because this bot is used in only 1 server currently
    const server: Guild = client.guilds.cache.array()[0]
    loadChannels(server)
    loadRoles(server)
    loadDatabaseConnectionAndCache()
    loadPincodesPerDistrict()
    await initDistricts()
}

export async function manageSubscription(message: Message) {
    const subscription: string = message.content
    if (!subscription.startsWith("+") && !subscription.startsWith("-")) {
        if (subscription.trim().toLowerCase().startsWith(aurangabad)) {
            message.reply(`To subscribe to alerts please enter district name/pincode starting with +\nFor example:\n+Aurangabad, Maharashtra\n+Aurangabad, Bihar\nTo be removed from this district's subscription, please enter district name/pincode starting with -\nFor example:\n-Aurangabad, Maharashtra\n-Aurangabad, Bihar`)
        } else {
            message.reply(`To subscribe to alerts please enter district name/pincode starting with + for example +${subscription}\nTo be removed from this subscription, please enter district name/pincode starting with - for example -${subscription}`)
        }
    } else {
        const subscriptionValue: string = subscription.substring(1)
        const action: Action = <Action>subscription.substring(0, 1)
        if (pincodeRegExp.test(subscription.substring(1))) {
            managePincodeSubscription(message, subscriptionValue.trim(), action)
        } else {
            manageDistrictSubscription(message, subscriptionValue.trim(), action)
        }
    }
}

function replyIfUserTriesToSubscribeInGeneral(message: Message) {
    const subscription: string = message.content
    if(subscription.startsWith("+") || subscription.startsWith("-")) {
        const action: Action = <Action> subscription.substring(0, 1)
        let intendedAction: string = "subscribe"
        if(action == "-") {
            intendedAction = "unsubscribe"
        }
        const possibleDistrict: string = subscription.substring(1)
        const possiblePincode: string = subscription.substring(1)
        if(possiblePincode.length == 6 && pincodeRegExp.test(possiblePincode)) {
            message.reply(`hi, if you're trying to ${intendedAction} to the pincode ${possiblePincode}, please do so on the <#${subscriptionsChannelID}> channel by typing \`${action}${possiblePincode}\``)
        } else if(checkDistrict(possibleDistrict)) {
            message.reply(`hi, if you're trying to ${intendedAction} to the district ${possibleDistrict}, please do so on the <#${subscriptionsChannelID}> channel by typing \`${action}${possibleDistrict}\``)
        }
    }
}

