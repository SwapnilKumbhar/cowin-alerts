import { Client, Message, TextChannel } from 'discord.js';
import axios from 'axios'
import { District, State } from './config/types';
import { createChannel, loadChannels, checkChannelAndGetID, newDistrictsChannelID, addRoleToChannel } from './discord/channelManager';
import { createRole, checkAndRemoveRole, loadRoles, checkRoleAndGetID, checkRoleOnUser, setRoleToMember, adminsID } from './discord/roleManager';

require('dotenv').config({ path: './config/.env.uat' });

const client = new Client();
let districts: District[] = []

client.login(process.env.BOT_TOKEN)

client.on('ready', () => {
    // Getting the first guild only because this bot is used in only 1 server currently
    loadChannels(client.guilds.cache.array()[0])
    loadRoles(client.guilds.cache.array()[0])
    initDistricts()

    console.log('Bot is ready');
});

client.on('message', (message) => {
    const textChannel: TextChannel = <TextChannel>message.channel
    if (textChannel.name === process.env.SUBSCRIPTIONS && message.author.username !== process.env.BOT_NAME) {
        manageSubscription(message)
    }
});

async function initDistricts() {
    const states: State[] = (await axios.get('https://cdn-api.co-vin.in/api/v2/admin/location/states', {
        headers: {
            "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.93 Safari/537.36"
        }
    })).data.states
    states.forEach(async (state: State) => {
        const state_id = state.state_id
        const allDistricts: District[] = (await axios.get(`https://cdn-api.co-vin.in/api/v2/admin/location/districts/${state_id}`, {
            headers: {
                "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.93 Safari/537.36"
            }
        })).data.districts
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

async function manageSubscription(message: Message) {
    const subscription = message.content
    if (!subscription.startsWith("+") && !subscription.startsWith("-")) {
        message.reply(`To subscribe to this district's alerts please enter district name starting with + for example +${subscription}\nTo be removed from this district's subscription, please enter district name starting with - for example -${subscription}`)
    } else {
        const districtName = subscription.substring(1).trim()
        const district: District = checkDistrict(districtName)
        if (district === null) {
            message.reply(`no such district:  ${districtName}`)
        } else {
            if (subscription.startsWith("+")) {
                let channelID: string = checkChannelAndGetID(districtName.toLowerCase())
                let roleID: string = checkRoleAndGetID(districtName.toLowerCase())
                if (channelID === null) {
                    let newChannelMessage: string = await createChannel(message, district)
                    let newRoleValues: string[] = await createRole(message, districtName.toLowerCase());
                    const newRoleMessage: string = newRoleValues[0]
                    const roleID: string = newRoleValues[1]

                    if (newChannelMessage !== undefined && newRoleMessage !== undefined) {
                        channelID = checkChannelAndGetID(districtName.toLowerCase())
                        addRoleToChannel(message.guild, channelID, roleID)

                        message.reply(`successfully subscribed to <#${channelID}> and assigned role <@&${roleID}>`);
                        (<TextChannel>message.guild.channels.cache
                            .get(newDistrictsChannelID))
                            .send(`${adminsID} ${newChannelMessage}\n${newRoleMessage}`)
                    } else if (newChannelMessage === undefined && newRoleMessage !== undefined) {
                        const roleID: string = checkRoleAndGetID(districtName.toLowerCase())
                        message.reply(`successfully assigned role <@&${roleID}> but couldn't create an alerts channel, don't worry, the admins will fix this soon!`)
                    } else if (newChannelMessage !== undefined && newRoleMessage === undefined) {
                        message.reply(`successfully subscribed to channel <#${channelID}> but couldn't assign you to a role, don't worry, the admins will fix this soon!`)
                    } else {
                        message.reply(`district subscription failed, don't worry, the admins will contact you soon!`)
                    }
                } else {
                    if (roleID !== null) {
                        const roleOnUser: boolean = checkRoleOnUser(message, districtName.toLowerCase())
                        if (!roleOnUser) {
                            setRoleToMember(roleID, message, districtName.toLowerCase())
                            message.reply(`successfully assigned role <@&${roleID}>`);
                        }  else {
                            message.reply(`you are already subscribed to role <@&${roleID}>`)
                        }
                    } else {
                        let newRoleMessage: string[] = await createRole(message, districtName.toLowerCase());
                        message.reply(`successfully subscribed to <#${channelID}> and assigned role <@&${newRoleMessage[1]}>`);
                        (<TextChannel>message.guild.channels.cache
                            .get(newDistrictsChannelID))
                            .send(`${adminsID} ${newRoleMessage[0]}.\nDistrict must be created earlier by a user without creating any role, please check.`)
                    }
                }

            } else if (subscription.startsWith("-")) {
                checkAndRemoveRole(message, districtName.toLowerCase())
            }
        }
    }
}
