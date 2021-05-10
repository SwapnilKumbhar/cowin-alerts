import { Message, TextChannel } from 'discord.js';
import { Database, OPEN_READWRITE } from 'sqlite3'
import { Action, UserPincode } from '../config/types';
import { errorAlertsChannelID } from '../discord/channelManager';
import { adminsID } from '../discord/roleManager';

export let userPincodesMap: Map<string, number[]> = new Map<string, number[]>()
let db: Database

function loadUserPincodeCache(db: Database) {
    db.all('select * from user_pincodes', [], (err, rows: UserPincode[]) => {
        if (err) {
            throw err;
        }
        console.log(rows)
        rows.forEach((row: UserPincode) => {
            let pincodes: number[] = userPincodesMap.get(row.user_id)
            if (pincodes !== undefined) {
                pincodes.push(row.pincode)
            } else {
                pincodes = [row.pincode]
            }
            userPincodesMap.set(row.user_id, pincodes)
        });
    });
}

export function loadVaxAlertDatabase() {
    db = new Database(`${process.env.DB_PATH}/vax_alert.db`, OPEN_READWRITE, (err: { message: any; }) => {
        if (err) {
            console.error(err.message);
        }
        loadUserPincodeCache(db)
    })
}

export function managePincodeSubscription(message: Message, pincode: string, action: Action) {
    if (pincode.length !== 6) {
        message.reply(`pincode ${pincode} is not 7 digits long, please enter valid pincode`)
    } else {
        if (action === "+") {
            subscribePincode(message, pincode)
        } else if (action === "-") {
            unsubscribePincode(message, pincode)
        }
    }
}

function subscribePincode(message: Message, pincode: string) {
    const pincodeValue: number = Number(pincode)
    const userId: string = message.author.id
    let pincodes: number[] = userPincodesMap.get(userId)
    if (pincodes !== undefined && pincodes.includes(pincodeValue)) {
        message.reply(`you are already subscribed to pincode ${pincode}`)
    } else {
        db.run(`insert into user_pincodes(user_id, pincode) values ('${userId}', ${pincodeValue})`, (err: any, _row: any) => {
            if (err !== null) {
                message.reply(`an error occured while subscribing to pincde ${pincode}, don't worry, the admins will fix this soon!`);
                (<TextChannel>message.guild.channels.cache
                    .get(errorAlertsChannelID))
                    .send(`<@&${adminsID}> an error occured when ${message.author.username} tried to subscribe to pincode ${pincode} - ${err}`)
            } else {
                message.reply(`successfully subscribed to pincode ${pincode}`)
                if (pincodes === undefined) {
                    userPincodesMap.set(userId, [pincodeValue])
                } else {
                    pincodes = pincodes.concat(pincodeValue)
                    userPincodesMap.set(userId, pincodes)
                }
            }
        })
    }
}

function unsubscribePincode(message: Message, pincode: string) {
    const pincodeValue: number = Number(pincode)
    const userId: string = message.author.id
    let pincodes: number[] = userPincodesMap.get(userId)
    if (pincodes === undefined || !pincodes.includes(pincodeValue)) {
        message.reply(`you are not currently subscribed to pincode ${pincode}. To subscribe please enter +${pincode}`)
    } else {
        db.run(`delete from user_pincodes where user_id = '${userId}' and pincode = ${pincodeValue}`, (err: any, _row: any) => {
            if (err !== null) {
                message.reply(`an error occured while unsubscribing to pincde ${pincode}, don't worry, the admins will fix this soon!`);
                (<TextChannel>message.guild.channels.cache
                    .get(errorAlertsChannelID))
                    .send(`<@&${adminsID}> an error occured when ${message.author.username} tried to unsubscribe to pincode ${pincode} - ${err}`)
            } else {
                message.reply(`successfully unsubscribed to pincode ${pincode}`)
                pincodes.splice(pincodes.indexOf(pincodeValue), 1)
                userPincodesMap.set(userId, pincodes)
            }
        })
    }
}