import { Client, Message, TextChannel } from 'discord.js';
import axios from 'axios'
import { District, State } from './types';
import { manageChannel, loadChannels, checkChannelAndGetID, districtsListChannelID } from './discord/channelManager';
import { checkAndCreateRole, checkAndRemoveRole, loadRoles } from './discord/roleManager';

require('dotenv').config();

const client = new Client();
let districts: District[] = []

client.login(process.env.BOT_TOKEN)

client.on('ready', () => {

    // Getting the first guild only because this bot is used in onlly 1 server currently
    loadChannels(client.guilds.cache.array()[0])
    loadRoles(client.guilds.cache.array()[0])
    initDistricts()

    console.log('Bot is ready');
});

client.on('message', (message) => {
    const textChannel: TextChannel = <TextChannel>message.channel
    if (textChannel.name === "subscriptions" && message.author.username !== "Vax Alert Bot") {
        manageSubscription(message)
    }
});

async function initDistricts() {
    const states: State[] = (await axios.get('https://cdn-api.co-vin.in/api/v2/admin/location/states')).data.states
    states.forEach(async (state: State) => {
        const state_id = state.state_id
        const allDistricts: District[] = (await axios.get(`https://cdn-api.co-vin.in/api/v2/admin/location/districts/${state_id}`)).data.districts
        allDistricts.forEach((district: District) => {
            districts.push(district)
        });
    });
}

function checkDistrict(districtName: string): District {
    let finalDistrict: District = null
    for (const currentDistrict of districts) {
        if (currentDistrict.district_name.toLowerCase() === districtName.toLowerCase()) {
            finalDistrict = currentDistrict
            break;
        }
    }
    return finalDistrict
}

function manageSubscription(message: Message) {
    const subscription = message.content
    if (!subscription.startsWith("*") && !subscription.startsWith("+") && !subscription.startsWith("-")) {
        message.reply(`To create/check a district please enter district name starting with * for example *${subscription}\nTo subscribe to this district's alerts please enter district name starting with + for example +${subscription}\nTo be removed from this district's subscription, please enter district name starting with ! for example !${subscription}`)
    } else {
        let districtName = subscription.substring(1).trim()
        let district: District = checkDistrict(districtName)
        if (district === null) {
            message.reply(`no such district:  ${districtName}`)
        } else {
            if (subscription.startsWith("*")) {
                manageChannel(message, district)
            } else if (subscription.startsWith("+")) {
                const channelID: string = checkChannelAndGetID(districtName.toLowerCase())
                if (channelID === null) {
                    message.reply(`no channel currently exists for district ${districtName}.\nPlease create a channel first by typing *${districtName} and then subscribe yourself to this district using +${districtName}\nTo get the list of currently available channels, check <#${districtsListChannelID}>`)
                } else {
                    checkAndCreateRole(message, districtName.toLowerCase())
                }
            } else if (subscription.startsWith("-")) {
                checkAndRemoveRole(message, districtName.toLowerCase())
            }
        }
    }
}
