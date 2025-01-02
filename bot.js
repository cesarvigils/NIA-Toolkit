const { Client, GatewayIntentBits, REST, Routes, ActivityType, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ],
    partials: ['USER', 'CHANNEL', 'GUILD_MEMBER', 'MESSAGE', 'REACTION']
});

client.slashCommands = new Collection();
client.prefixCommands = new Collection();
const prefix = 'n!';

const loadSlashCommands = async () => {
    try {
        const commands = [];
        const slashCommandsPath = path.join(__dirname, 'commands', 'slash');
        if (!fs.existsSync(slashCommandsPath)) return;

        const commandFiles = fs.readdirSync(slashCommandsPath).filter(file => file.endsWith('.js'));
        for (const file of commandFiles) {
            const command = require(path.join(slashCommandsPath, file));
            if (command.data && command.execute) {
                client.slashCommands.set(command.data.name, command);
                commands.push(command.data.toJSON());
            }
        }

        const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
        await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
    } catch (error) {
        console.error('Error loading slash commands:', error);
    }
};

const loadPrefixCommands = async () => {
    try {
        const prefixCommandsPath = path.join(__dirname, 'commands', 'prefix');
        if (!fs.existsSync(prefixCommandsPath)) return;

        const commandFiles = fs.readdirSync(prefixCommandsPath).filter(file => file.endsWith('.js'));
        for (const file of commandFiles) {
            const command = require(path.join(prefixCommandsPath, file));
            if (command.name && command.execute) {
                client.prefixCommands.set(command.name, command);
            }
        }
    } catch (error) {
        console.error('Error loading prefix commands:', error);
    }
};

client.once('ready', async () => {
    try {
        client.user.setPresence({
            activities: [{ name: 'National Intelligence Agency', type: ActivityType.Watching }],
            status: 'dnd',
        });

        await loadSlashCommands();
        await loadPrefixCommands();

        console.log(`Logged in as ${client.user.tag}`);
    } catch (error) {
        console.error('Error during client ready event:', error);
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;
    const command = client.slashCommands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error('Error executing slash command:', error);
        await interaction.reply({ content: 'There was an error executing this command.', ephemeral: true });
    }
});

client.on('messageCreate', async message => {
    if (!message.content.startsWith(prefix) || message.author.bot) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    const command = client.prefixCommands.get(commandName);

    if (!command) return;

    try {
        await command.execute(message, args);
    } catch (error) {
        console.error('Error executing prefix command:', error);
        message.reply('There was an error executing this command.');
    }
});

client.login(process.env.TOKEN).catch(error => {
    console.error('Error logging in:', error);
});