import { Guild, Message, Role, TextChannel } from "discord.js";
import { errorAlertsChannelID, generalChannelID, newDistrictsChannelID } from "./channelManager";

let roles: Role[] = []
export let everyoneRoleID: string
let memberRoleID: string

export function loadRoles(server: Guild) {
    let allRoles = server.roles.cache.array();
    for (const role of allRoles) {
        roles.push(role)
        if (role.name === "member") {
            memberRoleID = role.id
        }
    }
}

export function checkAndCreateRole(message: Message, districtName: string) {
    const roleName: string = `${districtName}`.replace(" ", "-")
    const server: Guild = message.guild
    const roleID = checkRoleAndGetID(districtName)
    if (roleID === null) {
        server.roles.create({
            data: {
                name: roleName
            }
        }).then(role => {
            setRoleToMember(role.id, server, message, districtName)
            roles.push(role);
            (<TextChannel>message.guild.channels.cache
                .get(newDistrictsChannelID))
                .send(`Created new role <@&${role.id}> - ${role.id}`)
        })
    } else {
        setRoleToMember(roleID, server, message, districtName)
    }
}

function checkRoleAndGetID(districtName: string) {
    const roleName: string = `${districtName}`.replace(" ", "-")
    for (const role of roles) {
        if (role.name === roleName) {
            return role.id
        }
    }
    return null
}

function setRoleToMember(roleID: string, server: Guild, message: Message, districtName: string) {
    const memberRolesSize: number = server.members.cache.get(message.author.id).roles.cache.array().length
    server.members.cache.get(message.author.id).roles
        .add([roleID])
        .then(_member => {
            message.reply(`assigned role <@&${roleID}> to user <@${message.author.id}>`);
            if (memberRolesSize === 1) {
                server.members.cache.get(message.author.id).roles.add([roleID, memberRoleID])
                message.reply(`you are now a <@&${memberRoleID}> of the Vax-Alert server and can access the <#${generalChannelID}> channel`);
            }
        }).catch(error => {
            console.log(error)
            message.reply(`an error occurred while creating/subscribing to district ${districtName}. Don't worry, the admins will contact you soon!`);
            (<TextChannel>message.guild.channels.cache
                .get(errorAlertsChannelID))
                .send(`An error occurred when ${message.author.username} tried to create/subscribe to district ${districtName} - ${error}`)
        })
}

export function checkAndRemoveRole(message: Message, districtName: string) {
    const roleID: string = checkRoleAndGetID(districtName)
    if (roleID === null) {
        message.reply(`cannot unsubscribe to a role that does not exist for ${districtName}`)
    } else {
        const server: Guild = message.guild
        let foundRole = 0
        server.members.cache.get(message.author.id).roles.cache.array()
            .forEach(role => {
                if (role.id === roleID) {
                    foundRole = 1
                }
            })
        if (foundRole) {
            server.members.cache.get(message.author.id).roles
                .remove(roleID)
                .then(_member => {
                    message.reply(`removed role <@&${roleID}> for user <@${message.author.id}>`)
                })
                .catch(error => {
                    console.log(error)
                })
        } else {
            message.reply(`user <@${message.author.id}> is not subscribed to role <@&${roleID}>`)
        }
    }
}