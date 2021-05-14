import { CategoryChannel, Guild, Message, TextChannel } from "discord.js";
import { District } from "../config/types";
import { addMemberRoleOnly, adminsID, everyoneRoleID } from "./roleHandler";
require('dotenv').config({ path: '../config/.env.uat' });

/**************************** Initializing data ****************************/

export let alertChannels: Map<string, string> = new Map<string, string>()
export let districtsListChannelID: string = ""
export let errorAlertsChannelID: string = ""
export let newDistrictsChannelID: string = ""
export let generalChannelID: string = ""
export let subscriptionsChannelID: string = ""
export let aurangabadBiharChannelID: string = ""
export let aurangabadMaharashtraChannelID: string = ""
let currentAlertsCategoryID: string = ""
let alertCategories: string[] = []

export function loadChannels(server: Guild) {
    console.log("Loading all alert channels...")
    let channels = server.channels.cache.array();
    alertCategories = process.env.ALERTS_CATEGORIES.split(", ")

    channels.find(channel => {
        switch (channel.name) {
            case process.env.CURRENT_ALERTS_CATEGORY:
                currentAlertsCategoryID = channel.id
                break
            case process.env.DISTRICTS_LIST:
                districtsListChannelID = channel.id
                break
            case process.env.ERROR_ALERTS:
                errorAlertsChannelID = channel.id
                break
            case process.env.NEW_DISTRICTS:
                newDistrictsChannelID = channel.id
                break
            case process.env.GENERAL:
                generalChannelID = channel.id
                break
            case process.env.SUBSCRIPTIONS:
                subscriptionsChannelID = channel.id
                break
            case "aurangabad-alerts":
                aurangabadBiharChannelID = channel.id
                break
            case "aurangabad-mh-alerts":
                aurangabadMaharashtraChannelID = channel.id
                break
        }
        if (channel.type === "category" && alertCategories.includes(channel.name)) {
            (<TextChannel[]>(<CategoryChannel>channel).children.array())
                .forEach((alertChannel: TextChannel) => {
                    alertChannels.set(alertChannel.name, alertChannel.id)
                })
        }
    })
}


/**************************** Creating channel and channel integrations ****************************/

export async function createChannel(message: Message, district: District): Promise<string | undefined> {
    const server: Guild = message.guild;
    const districtName = district.district_name.toLowerCase()

    try {
        const channel: TextChannel = await server.channels.create(districtName + "-alerts", {
            topic: `This channel will display alerts for district ${districtName}. Created on ${new Date()}`
        })
        alertChannels.set(channel.name, channel.id)
        channel.setParent(currentAlertsCategoryID)
        let newChannelMessage: string = `${message.author.username} created a new channel <#${channel.id}>\nDistrict ID: ${district.district_id}`

        const webhookURL = await createWebHookAndGetURL(channel, districtName)
        if (webhookURL != null) {
            newChannelMessage += `\nWebhook URL: ${webhookURL}`
        } else {
            newChannelMessage += `\nWebhook creation failed for ${districtName}! Please create it manually`
        }

        return newChannelMessage
    } catch (error) {
        console.log(error);
        (<TextChannel>message.guild.channels.cache
            .get(errorAlertsChannelID))
            .send(`<@&${adminsID}> an error occurred when ${message.author.username} tried to create channel for district ${districtName} - ${error}`)

        return undefined
    }

}

export async function checkChannelAndGetID(districtName: string) {
    const channelName: string = `${districtName}-alerts`.replace(/ /g, "-")
    return alertChannels.get(channelName)
}

async function createWebHookAndGetURL(channel: TextChannel, districtName: string): Promise<string> {
    try {
        const webhook = await channel.createWebhook(`${districtName} alerts`, {});
        return Promise.resolve(webhook.url)
    } catch (error) {
        console.log(error);
        return Promise.resolve(null)
    }
}


/**************************** Managing channel roles and members ****************************/

export async function setNewRoleToChannel(message: Message, channelID: string, roleID: string): Promise<boolean> {
    const server: Guild = message.guild
    try {
        server.channels.cache.get(channelID).overwritePermissions([
            {
                id: everyoneRoleID,
                deny: ['VIEW_CHANNEL', 'SEND_MESSAGES']
            },
            {
                id: roleID,
                allow: ['VIEW_CHANNEL']
            }
        ])
        return true
    } catch (error) {
        console.log(error);
        (<TextChannel>server.channels.cache
            .get(errorAlertsChannelID))
            .send(`<@&${adminsID}> an error occurred while assigning role <@&${roleID}> to channel <#${channelID}> for user ${message.author.username}, please assign it manually first and then analyse the cause - ${error}`)
        return false
    }
}

export async function addRoleToChannel(message: Message, channelID: string, roleID: string): Promise<boolean> {
    const server: Guild = message.guild
    try {
        server.channels.cache.get(channelID).updateOverwrite(roleID, {
            VIEW_CHANNEL: true,
            SEND_MESSAGES: false
        })
        return true
    } catch (error) {
        console.log(error);
        (<TextChannel>server.channels.cache
            .get(errorAlertsChannelID))
            .send(`<@&${adminsID}> an error occurred while adding user ${message.author.username} to channel <#${channelID}> - error`)
        return false
    }
}

export async function setUserAsMemberAndAddToChannel(message: Message, channelID: string, pincode: string) {
    // Add user directly to channel
    const userAddedToChannel: boolean = await addUserToChannel(message, channelID)

    // Check if the user is a completely new member, if yes try to assign member role
    let userSetAsMember: boolean = true
    const memberRolesSize: number = message.guild.members.cache.get(message.author.id).roles.cache.array().length
    if (memberRolesSize == 1) {
        userSetAsMember = await addMemberRoleOnly(message)
    }

    if (userSetAsMember && userAddedToChannel) {
        message.reply(`successfully subscribed to pincode ${pincode}. You will get notified when slots open up for this pincode on <#${channelID}>`)
    } else {
        message.reply(`an error occurred while subscribing to pincode ${pincode}, don't worry, the admins will fix this soon!`);
        (<TextChannel>message.guild.channels.cache
            .get(errorAlertsChannelID))
            .send(`for above error, data is already inserted in the database`)
    }
}

export async function addUserToChannel(message: Message, channelID: string): Promise<boolean> {
    const server: Guild = message.guild
    try {
        server.channels.cache.get(channelID).updateOverwrite(message.author, {
            VIEW_CHANNEL: true,
            SEND_MESSAGES: false
        })
        return true
    } catch (error) {
        console.log(error);
        (<TextChannel>server.channels.cache
            .get(errorAlertsChannelID))
            .send(`<@&${adminsID}> an error occurred while adding user ${message.author.username} to channel <#${channelID}> - error`)
        return false
    }
}

export async function removeUserFromChannel(message: Message, channelID: string) {
    const memberType: string = "member"
    try {
        await message.guild.channels.cache.get(channelID).permissionOverwrites
            .find(access => access.type == memberType && access.id == message.author.id).delete()
    } catch (error) {
        console.log(error);
        (<TextChannel>message.guild.channels.cache
            .get(errorAlertsChannelID))
            .send(`<@&${adminsID}> an error occurred while removing user ${message.author.username} from channel <#${channelID}> - error`)
    }
}