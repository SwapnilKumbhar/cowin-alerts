import { Message, TextChannel } from 'discord.js';
import { Database, OPEN_READWRITE } from 'sqlite3'
import { Action, District, UserPincode } from '../config/types';
import { checkChannelAndGetID, createChannel, errorAlertsChannelID, newDistrictsChannelID, removeUserFromChannel, setUserAsMemberAndAddToChannel } from '../discord/channelHandler';
import { adminsID } from '../discord/roleHandler';

import districtsData from "../config/districts.json"
import { districts, updateDistrictsList } from './district';


/**************************** Initializing data ****************************/

export let userPincodesMap: Map<string, number[]> = new Map<string, number[]>()
export const pincodeRegExp: RegExp = new RegExp('^[ 0-9]*$')
let pincodeDistrictMap: Map<number, string> = new Map<number, string>()
let db: Database

export function loadDatabaseConnectionAndCache() {
    console.log("Connecting to Vax Alert Database...")
    db = new Database(`${process.env.DB_PATH}/vax_alert.db`, OPEN_READWRITE, (err: { message: any; }) => {
        if (err) {
            console.error(err.message);
        }
        loadUserPincodeCache(db)
    })
}

export function loadPincodesPerDistrict() {
    console.log("Loading pincodes and districts from JSON...")
    Object.keys(districtsData).forEach((district: string) => {
        const pincodes: number[] = districtsData[district]
        pincodes.forEach((pincode: number) => {
            pincodeDistrictMap.set(pincode, district)
        })
    })
}

function loadUserPincodeCache(db: Database) {
    console.log("Initializing user_pincodes cache...")
    db.all('select * from user_pincodes', [], (err, rows: UserPincode[]) => {
        if (err) {
            throw err;
        }
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


/**************************** Subscribing/Unsubscribing to pincodes ****************************/

export function managePincodeSubscription(message: Message, pincode: string, action: Action) {
    if (pincode.length !== 6) {
        message.reply(`pincode ${pincode} is not 6 digits long, please enter valid pincode`)
    } else {
        // Validate the pincode
        if (pincodeDistrictMap.get(Number(pincode))) {
            if (action === "+") {
                subscribePincode(message, pincode)
            } else if (action === "-") {
                unsubscribePincode(message, pincode)
            }
        } else {
            message.reply(`pincode ${pincode} is invalid, pease enter a valid pincode`);

            // TODO: Check if we need to send alert to errorAlerts if user enters invalid pincode
            (<TextChannel>message.guild.channels.cache
                .get(errorAlertsChannelID))
                .send(`<@&${adminsID}> couldn't find a district for pincode ${pincode}, that user ${message.author.username} tried to subscribe to, in the pincodes JSON.`)
        }
    }
}

async function subscribePincode(message: Message, pincode: string) {
    const pincodeValue: number = Number(pincode)
    const userId: string = message.author.id
    let pincodes: number[] = userPincodesMap.get(userId) || []

    // Check if user is already subscribed to pincode
    if (pincodes.length > 0 && pincodes.includes(pincodeValue)) {
        message.reply(`you are already subscribed to pincode ${pincode}`)
    } else {
        db.run(`insert into user_pincodes(user_id, pincode) values ('${userId}', ${pincodeValue})`, async (err: any, _row: any) => {
            if (err !== null) {
                message.reply(`an error occured while subscribing to pincde ${pincode}, don't worry, the admins will fix this soon!`);
                (<TextChannel>message.guild.channels.cache
                    .get(errorAlertsChannelID))
                    .send(`<@&${adminsID}> an error occured while inserting pincode ${pincode} into DB for user ${message.author.username} with userID ${message.author.id}, please insert it manually first and then analyse the issue - ${err}`)
            } else {
                // Update pincodes cache as it is inserted in DB already
                userPincodesMap.set(userId, pincodes.concat(pincodeValue))

                // District name cannot be null or undefined, because if district doesn't exist, this function wouldn't be called
                const districtName: string = pincodeDistrictMap.get(pincodeValue).toLowerCase().trim()

                // Create new channel if one doesn't exist already for this district and get channelID
                const channelID: string = await checkChannelAndGetID(districtName) || await createNewChannelForPincode(message, pincodeValue, districtName)

                // Check whether channelID is still undefined or null - this means that an error occured while creating new channel
                if (channelID) {
                    setUserAsMemberAndAddToChannel(message, channelID, pincode)
                }
            }
        })
    }
}

async function unsubscribePincode(message: Message, pincode: string) {
    const pincodeValue: number = Number(pincode)
    const userId: string = message.author.id
    let pincodes: number[] = userPincodesMap.get(userId)
    if (pincodes === undefined || !pincodes.includes(pincodeValue)) {
        message.reply(`cannot unsubscribe as you are not currently subscribed to pincode ${pincode}. To subscribe please enter +${pincode}`)
    } else {
        db.run(`delete from user_pincodes where user_id = '${userId}' and pincode = ${pincodeValue}`, async (err: any, _row: any) => {
            if (err !== null) {
                message.reply(`an error occured while unsubscribing to pincde ${pincode}, don't worry, the admins will fix this soon!`);
                (<TextChannel>message.guild.channels.cache
                    .get(errorAlertsChannelID))
                    .send(`<@&${adminsID}> an error occured when ${message.author.username} tried to unsubscribe to pincode ${pincode}, while deleting entry from DB - ${err}`)
            } else {
                pincodes.splice(pincodes.indexOf(pincodeValue), 1)
                userPincodesMap.set(userId, pincodes)

                const districtName: string = pincodeDistrictMap.get(pincodeValue).toLowerCase().trim()
                const channelID: string = await checkChannelAndGetID(districtName)
                message.reply(`successfully unsubscribed to pincode ${pincode}`)

                if (channelID) {
                    removeUserFromChannel(message, channelID)
                } else {
                    (<TextChannel>message.guild.channels.cache
                        .get(errorAlertsChannelID))
                        .send(`<@&${adminsID}> user ${message.author.username} tried to unsubscribe to pincode ${pincode} for a district ${districtName} whose alert channel doesn't exist. That should not happen :neutral_face:. Please remove him from a channel that I couldn't find.`)
                }
            }
        })
    }
}

async function createNewChannelForPincode(message: Message, pincodeValue: number, districtName: string): Promise<string | undefined> {
    const currentDistrict: District = districts.find(district => district.district_name.toLowerCase() === districtName)

    // Check whether this pincode's district, as per the json file, matches with a district loaded from cowin website
    if (currentDistrict) {
        const newChannelMessageForAdmins: string = await createChannel(message, currentDistrict)
        if (newChannelMessageForAdmins) {
            updateDistrictsList(message, currentDistrict.district_name);

            (<TextChannel>message.guild.channels.cache
                .get(newDistrictsChannelID))
                .send(`<@&${adminsID}> \n**For pincode ${pincodeValue} -**\n${newChannelMessageForAdmins}`)

            return checkChannelAndGetID(districtName)
        } else {
            message.reply(`an error occured while subscribing to pincode ${pincodeValue}, don't worry, the admins will contact you soon`)
            // this error message is sent to error-alerts channel while creating the channel itself
            return undefined
        }
    } else {
        message.reply(`an error occured while subscribing to pincode ${pincodeValue}, don't worry, the admins will contact you soon`);
        (<TextChannel>message.guild.channels.cache
            .get(errorAlertsChannelID))
            .send(`<@&${adminsID}> user ${message.author.username} tried to subscribe to pincode ${pincodeValue} and data is inserted in DB. The corresponding district ${districtName} does not exist in the list of districts provided on cowin website, please check!!!`)
        return undefined
    }
}