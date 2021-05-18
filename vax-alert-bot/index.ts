import { Client, Guild, Message, TextChannel } from 'discord.js';
import { Action, SubscriptionType } from './config/types';
import { loadChannels, subscriptionsChannelID } from './discord/channelHandler';
import { loadRoles } from './discord/roleHandler';
import { loadPincodesPerDistrict, loadDatabaseConnectionAndCache, pincodeRegExp } from './subscriptions/pincode';
import { aurangabad, bilaspur, checkDistrict, initDistricts, manageDistrictSubscription } from './subscriptions/district';

require('dotenv').config({ path: './config/.env.uat' });

const client = new Client()
const actionsRegExp: RegExp = new RegExp('^[@+#-]$')

client.login(process.env.BOT_TOKEN)

client.on('ready', async () => {
    await initBot()
    console.log(`\n${process.env.BOT_NAME} is ready`);
});

client.on('message', (message) => {
    const textChannel: TextChannel = <TextChannel>message.channel
    if (textChannel.name === process.env.SUBSCRIPTIONS && message.author.username !== process.env.BOT_NAME) {
        manageSubscription(message)
    } else if (textChannel.name === process.env.GENERAL && message.author.username !== process.env.BOT_NAME) {
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
            message.reply(`To subscribe to alerts please enter district name starting with +\nFor example:\n+Aurangabad, Maharashtra\n+Aurangabad, Bihar\nTo be removed from this district's subscription, please enter district name starting with -\nFor example:\n-Aurangabad, Maharashtra\n-Aurangabad, Bihar`)
        } else if (subscription.trim().toLowerCase().startsWith(bilaspur)) {
            message.reply(`To subscribe to alerts please enter district name starting with +\nFor example:\n+Bilaspur, Chhattisgarh\n+Bilaspur, Himachal Pradesh\nTo be removed from this district's subscription, please enter district name starting with -\nFor example:\n-Bilaspur, Chhattisgarh\n-Bilaspur, Himachal Pradesh`)
        } else {
            // TODO: Uncomment the below line to enable pincode based subscriptions and remove the line after that
            // message.reply(`To subscribe to alerts please enter district name/pincode starting with + for example +${subscription}\nTo be removed from this subscription, please enter district name/pincode starting with - for example -${subscription}`)
            message.reply(`To subscribe to alerts please enter district name starting with + for example +${subscription}\nTo be removed from this subscription, please enter district name starting with - for example -${subscription}`)
        }
    } else {
        const subscriptionValue: string = subscription.substring(1)
        const action: Action = <Action>subscription.substring(0, 1)
        if (pincodeRegExp.test(subscription.substring(1))) {
            // TODO: Uncomment the below line to enable pincode based subscriptions and remove the bot's reply
            // managePincodeSubscription(message, subscriptionValue.trim(), action)
            message.reply(`The pincode feature is not available yet, but the admins are working on it!`)
        } else {
            manageDistrictSubscription(message, subscriptionValue.trim(), action)
        }
    }
}

function replyIfUserTriesToSubscribeInGeneral(message: Message) {
    const subscription: string = message.content
    const action: string = subscription.substring(0, 1)

    const possibleDistrict: string = subscription
    const possiblePincode: string = subscription
    const possibleDistrictWithAction: string = subscription.substring(1)?.trim()
    const possiblePincodeWithAction: string = subscription.substring(1)?.trim()
    let messageReply: string = undefined

    if ((possiblePincode.length == 6 && pincodeRegExp.test(possiblePincode))
        || (possiblePincodeWithAction.length == 6 && pincodeRegExp.test(possiblePincodeWithAction))) {
        if (actionsRegExp.test(action)) {
            messageReply = buildReply(action, possibleDistrictWithAction, "pincode")
        } else {
            messageReply = buildReply("", possiblePincode, "pincode")
        }
    } else if (checkDistrict(possibleDistrict) || checkDistrict(possibleDistrictWithAction)) {
        if (actionsRegExp.test(action)) {
            messageReply = buildReply(action, possibleDistrictWithAction, "district")
        } else {
            messageReply = buildReply("", possibleDistrict, "district")
        }
    }

    if(messageReply) {
        message.reply(messageReply)
    }
}

function buildReply(action: string, subscription: string, subscriptionType: SubscriptionType): string {
    let intendedAction: string = "subscribe/unsubscribe"
    if (action === "+") {
        intendedAction = "subscribe"
    } else if (action === "-") {
        intendedAction = "unsubscribe"
    }
    let messageReply: string = `hi, if you're trying to ${intendedAction} to the ${subscriptionType} ${subscription}, please do so on the <#${subscriptionsChannelID}> channel`
    if (action == "+" || action == "-") {
        messageReply += ` by typing \`${action}${subscription}\``
    } else {
        messageReply += ` by  typing \`+${subscription}\` to subscribe or \`-${subscription}\` to unsubscribe`
    }
    return messageReply
}
