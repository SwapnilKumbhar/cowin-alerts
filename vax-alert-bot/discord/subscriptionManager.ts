import axios from "axios";
import { Message, TextChannel } from "discord.js";
import { State, District, Action } from "../config/types";
import { checkChannelAndGetID, createChannel, addRoleToChannel, newDistrictsChannelID, aurangabadBiharChannelID, aurangabadMaharashtraChannelID } from "./channelManager";
import { checkRoleAndGetID, createRole, adminsID, checkRoleOnUser, setRoleToMember, checkAndRemoveRole, aurangabadBiharRoleID, aurangabadMaharashtraRoleID } from "./roleManager";

let districts: District[] = []
const aurangabad: string = "aurangabad"

export async function initDistricts() {
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

export async function manageSubscription(message: Message) {
    const subscription = message.content
    if (!subscription.startsWith("+") && !subscription.startsWith("-")) {
        if (subscription.trim().toLowerCase().startsWith(aurangabad)) {
            message.reply(`To subscribe to this district's alerts please enter district name starting with +\nFor example:\n+Aurangabad, Maharashtra\n+Aurangabad, Bihar\nTo be removed from this district's subscription, please enter district name starting with -\nFor example:\n-Aurangabad, Maharashtra\n-Aurangabad, Bihar`)
        } else {
            message.reply(`To subscribe to this district's alerts please enter district name starting with + for example +${subscription}\nTo be removed from this district's subscription, please enter district name starting with - for example -${subscription}`)
        }
    } else {
        const action: Action = <Action>subscription.substring(0, 1)
        const districtName = subscription.substring(1).trim()
        const district: District = checkDistrict(districtName)
        if (district === null && !districtName.toLowerCase().startsWith(aurangabad)) {
            message.reply(`no such district:  ${districtName}`)
        } else if (districtName.toLowerCase().startsWith(aurangabad)) {
            manageAurangabadSubscription(message, districtName.toLowerCase(), action)
        } else {
            if (action === "+") {
                let channelID: string = checkChannelAndGetID(districtName.toLowerCase())
                let roleID: string = checkRoleAndGetID(districtName.toLowerCase())
                if (channelID === null) {
                    addNewDistrict(message, district, channelID)
                } else {
                    manageExistingDistrict(message, districtName, channelID, roleID)
                }

            } else if (action === "-") {
                checkAndRemoveRole(message, districtName.toLowerCase())
            }
        }
    }
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

async function addNewDistrict(message: Message, district: District, channelID: string) {
    const districtName = district.district_name.toLowerCase()
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
            .send(`<@&${adminsID}> ${newChannelMessage}\n${newRoleMessage}`)
    } else if (newChannelMessage === undefined && newRoleMessage !== undefined) {
        const roleID: string = checkRoleAndGetID(districtName.toLowerCase())
        message.reply(`successfully assigned role <@&${roleID}> but couldn't create an alerts channel, don't worry, the admins will fix this soon!`)
    } else if (newChannelMessage !== undefined && newRoleMessage === undefined) {
        message.reply(`successfully subscribed to channel <#${channelID}> but couldn't assign you to a role, don't worry, the admins will fix this soon!`)
    } else {
        message.reply(`district subscription failed, don't worry, the admins will contact you soon!`)
    }
}

async function manageExistingDistrict(message: Message, districtName: string, channelID: string, roleID: string) {
    if (roleID !== null) {
        const roleOnUser: boolean = checkRoleOnUser(message, districtName.toLowerCase())
        if (!roleOnUser) {
            setRoleToMember(roleID, message, districtName.toLowerCase())
            message.reply(`successfully assigned role <@&${roleID}>`);
        } else {
            message.reply(`you are already subscribed to role <@&${roleID}>`)
        }
    } else {
        let newRoleMessage: string[] = await createRole(message, districtName.toLowerCase());
        message.reply(`successfully subscribed to <#${channelID}> and assigned role <@&${newRoleMessage[1]}>`);
        (<TextChannel>message.guild.channels.cache
            .get(newDistrictsChannelID))
            .send(`<@&${adminsID}> ${newRoleMessage[0]}.\nDistrict must be created earlier by a user without creating any role, please check.`)
    }
}

async function manageAurangabadSubscription(message: Message, districtName: string, action: Action) {
    let state: string = districtName.split(", ")[1]
    if (state === undefined) {
        state = districtName.split(",")[1]
    }
    if (state === undefined || (state.toLowerCase().trim() !== "bihar" && state.toLowerCase().trim() !== "maharashtra")) {
        message.reply(`please enter valid state name along with Aurangabad. For example:\n${action}Aurangabad, Maharashtra\n${action}Aurangabad, Bihar`)
    } else if (state.toLowerCase().trim() === "bihar") {
        if (action == "+") {
            const roleSet: boolean = await setRoleToMember(aurangabadBiharRoleID, message, districtName)
            if (roleSet) {
                message.reply(`successfully subscribed to <#${aurangabadBiharChannelID}> and assigned role <@&${aurangabadBiharRoleID}>`)
            }
        } else if(action == "-") {
            checkAndRemoveRole(message, "aurangabad")
        }
    } else if (state.toLowerCase().trim() == "maharashtra") {
        if (action == "+") {
            const roleSet: boolean = await setRoleToMember(aurangabadMaharashtraRoleID, message, districtName)
            if (roleSet) {
                message.reply(`successfully subscribed to <#${aurangabadMaharashtraChannelID}> and assigned role <@&${aurangabadMaharashtraRoleID}>`)
            }
        } else if(action == "-") {
            checkAndRemoveRole(message, "aurangabad-mh")
        }
    }
}