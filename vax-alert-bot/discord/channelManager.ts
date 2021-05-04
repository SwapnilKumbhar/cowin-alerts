import { CategoryChannel, Channel, Guild, GuildChannel, Message, TextChannel } from "discord.js";
import { District } from "../types";

let alertChannels: TextChannel[] = []
export let districtsListChannelID: string = ""
let errorAlertsChannelID: string = ""
export let newDistrictsChannelID: string = ""

export function loadChannels(server: Guild) {
    let channels = server.channels.cache.array();
    for (const channel of channels) {
        if (channel.type === "category" && channel.name === "alerts") {
            const categoryChannel = <CategoryChannel>channel
            alertChannels = <TextChannel[]>categoryChannel.children.array()
        }
        if (channel.name === "districts-list") {
            districtsListChannelID = channel.id
        } else if (channel.name === "error-alerts") {
            errorAlertsChannelID = channel.id
        } else if (channel.name === "new-districts") {
            newDistrictsChannelID = channel.id
        }
    }
}

export function manageChannel(message: Message, district: District) {
    const server: Guild = message.guild;
    const districtName = district.district_name.toLowerCase()
    const channelID = checkChannelAndGetID(districtName)

    if (channelID != null) {
        message.reply(`a channel already exists for this district, check <#${channelID}>.\nTo subscribe yourself to this district, enter +${districtName}.\nTo get the list of all available districts, check <#${districtsListChannelID}>`)
    } else {
        server.channels
            .create(districtName + "-alerts", {
                reason: `To display alerts for district ${districtName}`
            })
            .then(async (channel: TextChannel) => {
                alertChannels.push(channel)
                setChannelUnderAlertsCategory(channel, server)
                
                let notifyNewDistrictsMessage: string = `${message.author.username} created a new channel <#${channel.id}>\nDistrict ID: ${district.district_id}`

                const webhookURL = await createWebHookAndGetURL(channel, districtName)
                if(webhookURL != null) {
                    notifyNewDistrictsMessage += `\nWebhook URL: ${webhookURL}`
                } else {
                    notifyNewDistrictsMessage += "\nWebhook creation failed! Please create it manually"
                }

                message.reply(`successfully created channel <#${channel.id}>.\nTo subscribe yourself to this district, enter +${districtName}.`);

                (<TextChannel>message.guild.channels.cache
                    .get(newDistrictsChannelID))
                    .send(notifyNewDistrictsMessage)
            })
            .catch(error => {
                console.log(error)
                message.reply(`an error occurred while creating channel for district ${districtName}. Don't worry, the admins will contact you soon!`);
                (<TextChannel>message.guild.channels.cache
                    .get(errorAlertsChannelID))
                    .send(`An error occurred when ${message.author.username} tried to create channel for district ${districtName} - ${error}`)
            });
    }
}

export function checkChannelAndGetID(districtName: string) {
    const channelName: string = `${districtName}-alerts`.replace(" ", "-")
    for (const alertChannel of alertChannels) {
        if (channelName === alertChannel.name) {
            return alertChannel.id
        }
    }
    return null
}

function setChannelUnderAlertsCategory(channel: TextChannel, server: Guild) {
    const category: GuildChannel = server.channels.cache.find(c => c.name.toLowerCase() === "devs-only" && c.type === "category");
    if (!category) {
        throw new Error("Alerts category channel does not exist");
    }
    channel.setParent(category.id);
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
