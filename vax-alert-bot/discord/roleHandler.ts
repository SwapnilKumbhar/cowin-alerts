import { Guild, GuildMember, Message, Role, TextChannel } from "discord.js";
import { errorAlertsChannelID, generalChannelID } from "./channelHandler";



/**************************** Initializing data ****************************/

let rolesMap: Map<string, Role> = new Map<string, Role>()

export const everyoneRoleID: string = "838421930406445086"
export const aurangabadBiharRoleID: string = "839388376477335583"
export const aurangabadMaharashtraRoleID: string = "840549022598037515"
let memberRoleID: string

export const adminsID: string = "838446465566244914"

export function loadRoles(server: Guild) {
    console.log("Loading all roles...")
    let allRoles = server.roles.cache.array();
    for (const role of allRoles) {
        // roles.push(role)
        rolesMap.set(role.name, role)
        if (role.name === "member") {
            memberRoleID = role.id
        }
    }
}

/**************************** Creating roles ****************************/

export async function createRole(message: Message, districtName: string): Promise<string[]> {
    const roleName: string = `${districtName}`.replace(/ /g, "-")
    const server: Guild = message.guild
    try {
        const role: Role = await server.roles.create({
            data: {
                name: roleName
            }
        })
        const roleSet: boolean = await setRoleToMember(role.id, message, districtName)
        if (roleSet) {
            rolesMap.set(role.name, role)
            return [`${message.author.username} created new role <@&${role.id}> - ${role.id}`, role.id]
        } else {
            return undefined
        }
    } catch (error) {
        console.log(error)
        message.reply(`an error occurred while subscribing to district ${districtName}. Don't worry, the admins will contact you soon!`);
        (<TextChannel>message.guild.channels.cache
            .get(errorAlertsChannelID))
            .send(`<@&${adminsID}> an error occurred when ${message.author.username} tried to create role for district ${districtName} - ${error}`)

        return undefined
    }
}

export function checkRoleAndGetID(districtName: string) {
    const roleName: string = `${districtName}`.replace(/ /g, "-")
    return rolesMap.get(roleName)?.id
}


/**************************** Setting and removing roles ****************************/

export async function setRoleToMember(roleID: string, message: Message, districtName: string): Promise<boolean> {
    const server = message.guild
    const memberRolesSize: number = server.members.cache.get(message.author.id).roles.cache.array().length
    try {
        const member: GuildMember = await server.members.cache.get(message.author.id).roles.add([roleID])
        if (memberRolesSize === 1) {
            try {
                await member.roles.add([roleID, memberRoleID])
                message.reply(`you are now a <@&${memberRoleID}> of the Vax-Alert server and can access the <#${generalChannelID}> channel`)

                return Promise.resolve(true)
            } catch (error) {
                message.reply(`an error occurred while subscribing to district ${districtName}. Don't worry, the admins will contact you soon!`);
                (<TextChannel>message.guild.channels.cache
                    .get(errorAlertsChannelID))
                    .send(`<@&${adminsID}> an error occurred while assigning role 'member' to ${message.author.username} - ${error}`)

                return Promise.resolve(false)
            }
        }
        return Promise.resolve(true)
    } catch (error) {
        console.log(error)
        message.reply(`an error occurred while subscribing to district ${districtName}. Don't worry, the admins will contact you soon!`);
        (<TextChannel>message.guild.channels.cache
            .get(errorAlertsChannelID))
            .send(`<@&${adminsID}> an error occurred when ${message.author.username} tried to subscribe to district ${districtName} - ${error}`)
        return Promise.resolve(false)
    }
}

export async function addMemberRoleOnly(message: Message): Promise<boolean> {
    const member: GuildMember = message.guild.members.cache.get(message.author.id)
    try {
        await member.roles.add([memberRoleID])
        message.reply(`you are now a <@&${memberRoleID}> of the Vax-Alert server and can access the <#${generalChannelID}> channel`)

        return true
    } catch (error) {
        (<TextChannel>message.guild.channels.cache
            .get(errorAlertsChannelID))
            .send(`<@&${adminsID}> an error occurred while assigning role 'member' to ${message.author.username} - ${error}`)

        return false
    }
}

export async function checkAndRemoveRole(message: Message, districtName: string) {
    const roleID: string = checkRoleAndGetID(districtName)
    if (roleID === null) {
        message.reply(`cannot unsubscribe to a role that does not exist for ${districtName}`)
    } else {
        const server: Guild = message.guild
        const foundRole: Role = server.members.cache.get(message.author.id).roles.cache.array().find(role => role.id == roleID)
        if (foundRole) {
            try {
                await server.members.cache.get(message.author.id).roles.remove(roleID)
                message.reply(`removed role <@&${roleID}> for user <@${message.author.id}>`)
            } catch (error) {
                console.log(error)
                message.reply(`an error occurred while unsubscribing to district ${districtName}. Don't worry, the admins will contact you soon!`);
                (<TextChannel>message.guild.channels.cache
                    .get(errorAlertsChannelID))
                    .send(`<@&${adminsID}> an error occurred when ${message.author.username} tried to unsubscribe to district ${districtName} - ${error}`)
            }
        } else {
            message.reply(`user <@${message.author.id}> is not subscribed to district <@&${roleID}>`)
        }
    }
}

export function checkRoleOnUser(message: Message, districtName: string): boolean {
    const roleName: string = `${districtName}`.replace(/ /g, "-")
    let roleFound: boolean = false
    message.guild.members.cache.get(message.author.id).roles.cache.array()
        .forEach((role: Role) => {
            if (role.name === roleName) {
                roleFound = true
            }
        })
    return roleFound
}