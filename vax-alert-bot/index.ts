import { Client, TextChannel } from 'discord.js';
import { loadChannels } from './discord/channelManager';
import { loadRoles } from './discord/roleManager';
import { loadVaxAlertDatabase } from './subscriptions/pincodeManager';
import { initDistricts, manageSubscription } from './subscriptions/subscriptionManager';

require('dotenv').config({ path: './config/.env' });

const client = new Client()

client.login(process.env.BOT_TOKEN)

client.on('ready', () => {
    // Getting the first guild only because this bot is used in only 1 server currently
    loadChannels(client.guilds.cache.array()[0])
    loadRoles(client.guilds.cache.array()[0])
    initDistricts()
    loadVaxAlertDatabase()

    console.log(`${process.env.BOT_NAME} is ready`);
});

client.on('message', (message) => {
    const textChannel: TextChannel = <TextChannel>message.channel
    if (textChannel.name === process.env.SUBSCRIPTIONS && message.author.username !== process.env.BOT_NAME) {
        manageSubscription(message)
    }
});


