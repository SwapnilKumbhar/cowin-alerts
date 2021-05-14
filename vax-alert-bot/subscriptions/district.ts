import axios from "axios";
import { Message, TextChannel } from "discord.js";
import { State, District, Action } from "../config/types";
import { checkChannelAndGetID, createChannel, setNewRoleToChannel, newDistrictsChannelID, aurangabadBiharChannelID, aurangabadMaharashtraChannelID, addRoleToChannel } from "../discord/channelHandler";
import { checkRoleAndGetID, createRole, adminsID, checkRoleOnUser, setRoleToMember, checkAndRemoveRole, aurangabadBiharRoleID, aurangabadMaharashtraRoleID } from "../discord/roleHandler";


/**************************** Initializing data ****************************/

export let districts: District[] = []
export const aurangabad: string = "aurangabad"

export async function initDistricts() {
    console.log("Getting districts lists from Cowin API...")
    const states: State[] = (await axios.get('https://cdn-api.co-vin.in/api/v2/admin/location/states', {
        headers: {
            "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.93 Safari/537.36"
        }
    })).data.states
    states.forEach(async (state: State) => {
        const state_id = state.state_id
        const currentDistricts: District[] = (await axios.get(`https://cdn-api.co-vin.in/api/v2/admin/location/districts/${state_id}`, {
            headers: {
                "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.93 Safari/537.36"
            }
        })).data.districts
        districts = districts.concat(currentDistricts)
    });
}


/**************************** Adding new districts or managing existing districts ****************************/

export async function manageDistrictSubscription(message: Message, districtName: string, action: Action) {
    const district: District = checkDistrict(districtName)
    if (district === null && !districtName.toLowerCase().startsWith(aurangabad)) {
        message.reply(`no such district:  ${districtName}`)
    } else if (districtName.toLowerCase().startsWith(aurangabad)) {
        manageAurangabadSubscription(message, districtName.toLowerCase(), action)
    } else {
        if (action === "+") {
            let channelID: string = await checkChannelAndGetID(districtName.toLowerCase())
            let roleID: string = checkRoleAndGetID(districtName.toLowerCase())
            if (!channelID) {
                addNewDistrictWithRole(message, district, channelID)
            } else {
                manageExistingDistrict(message, districtName, channelID, roleID)
            }

        } else if (action === "-") {
            checkAndRemoveRole(message, districtName.toLowerCase())
        }
    }
}

export function checkDistrict(districtName: string): District {
    districtName = districtName.toLowerCase()
    return districts.find(district => district.district_name.toLowerCase() == districtName)
}

async function addNewDistrictWithRole(message: Message, district: District, channelID: string) {
    const districtName = district.district_name.toLowerCase()
    let newChannelMessage: string = await createChannel(message, district)
    let newRoleValues: string[] = await createRole(message, districtName.toLowerCase());
    const newRoleMessage: string = newRoleValues[0]
    const roleID: string = newRoleValues[1]

    if (newChannelMessage !== undefined && newRoleMessage !== undefined) {
        channelID = await checkChannelAndGetID(districtName.toLowerCase())
        const roleAdded: boolean = await setNewRoleToChannel(message, channelID, roleID)

        if (roleAdded) {
            message.reply(`successfully subscribed to <#${channelID}> and assigned role <@&${roleID}>`);
            (<TextChannel>message.guild.channels.cache
                .get(newDistrictsChannelID))
                .send(`<@&${adminsID}> ${newChannelMessage}\n${newRoleMessage}`)
        } else {
            message.reply(`an error occurred while assigning role <@&${roleID}> to channel <#${channelID}>, don't worry, the admins will fix it soon!`);
        }
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
    if (roleID) {
        const roleOnUser: boolean = checkRoleOnUser(message, districtName.toLowerCase())
        if (!roleOnUser) {
            setRoleToMember(roleID, message, districtName.toLowerCase())
            message.reply(`successfully assigned role <@&${roleID}> and subscribed to channel <#${channelID}>`);
        } else {
            message.reply(`you are already subscribed to role <@&${roleID}>`)
        }
    } else {
        const newRoleMessage: string[] = await createRole(message, districtName.toLowerCase());
        // If an error occurs while creating new role, the user and admins wil be notified from createRole method itself
        if (newRoleMessage) {
            const newRoleAddedToChannel: boolean = await addRoleToChannel(message, channelID, newRoleMessage[1])
            if (newRoleAddedToChannel) {
                message.reply(`successfully subscribed to <#${channelID}> and assigned role <@&${newRoleMessage[1]}>`);
                (<TextChannel>message.guild.channels.cache
                    .get(newDistrictsChannelID))
                    .send(`<@&${adminsID}> ${newRoleMessage[0]}.\nDistrict must be created via pincode earlier, please add this role to the district config now.`)
            } else {
                message.reply(`an error occurred while subscribing to district ${districtName}, don't worry, the admins will fix this soon!`)
            }
        }
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
        } else if (action == "-") {
            checkAndRemoveRole(message, "aurangabad")
        }
    } else if (state.toLowerCase().trim() == "maharashtra") {
        if (action == "+") {
            const roleSet: boolean = await setRoleToMember(aurangabadMaharashtraRoleID, message, districtName)
            if (roleSet) {
                message.reply(`successfully subscribed to <#${aurangabadMaharashtraChannelID}> and assigned role <@&${aurangabadMaharashtraRoleID}>`)
            }
        } else if (action == "-") {
            checkAndRemoveRole(message, "aurangabad-mh")
        }
    }
}