require('dotenv').config();
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const mysql = require('mysql2/promise');
const { google } = require('googleapis');

let credentials;
try {
    credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
} catch (error) {
    throw new Error('Invalid GOOGLE_CREDENTIALS in .env');
}

let connection;

async function getConnection() {
    if (!connection || connection.state === 'disconnected') {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            port: process.env.DB_PORT,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
        });
    }
    return connection;
}

async function getBadgeNumberAndUpdateSheet(timezone, name, discordId, date) {
    const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    const spreadsheetId = '1R2DIGdXzMPruokBxdj-yCTilgQ2WXZkmJdghjrw4U2c';
    const employeeRange = 'NIA | Employee Data!B23:F';

    const employeeResponse = await sheets.spreadsheets.values.get({ spreadsheetId, range: employeeRange });
    const employeeRows = employeeResponse.data.values || [];

    let badgeNumber = null;
    let rowIndex = 23;

    for (const row of employeeRows) {
        if (!row[2]?.trim()) {
            badgeNumber = row[0];
            if (!badgeNumber) throw new Error('Badge number not found in column B.');

            await sheets.spreadsheets.values.update({
                spreadsheetId,
                range: `NIA | Employee Data!C${rowIndex}:F${rowIndex}`,
                valueInputOption: 'RAW',
                resource: {
                    values: [[name, discordId, timezone, date]],
                },
            });
            break;
        }
        rowIndex++;
    }

    if (!badgeNumber) {
        throw new Error('No available slot found in Employee Data.');
    }

    return badgeNumber;
}

async function updateMasterRoster(badgeNumber) {
    const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    const rosterSpreadsheetId = '1R2DIGdXzMPruokBxdj-yCTilgQ2WXZkmJdghjrw4U2c';
    const rosterRange = 'NIA | Master Roster!D234:D';

    const rosterResponse = await sheets.spreadsheets.values.get({ spreadsheetId: rosterSpreadsheetId, range: rosterRange });
    const rosterRows = rosterResponse.data.values || [];

    let nextRow = 234;
    for (const row of rosterRows) {
        if (!row[0]?.trim()) {
            break;
        }
        nextRow++;
    }

    const updateRange = `NIA | Master Roster!D${nextRow}`;
    await sheets.spreadsheets.values.update({
        spreadsheetId: rosterSpreadsheetId,
        range: updateRange,
        valueInputOption: 'RAW',
        resource: {
            values: [[badgeNumber]],
        },
    });

    return nextRow;
}

async function getMasterRosterValue(row) {
    const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    const rosterSpreadsheetId = '1R2DIGdXzMPruokBxdj-yCTilgQ2WXZkmJdghjrw4U2c';
    const range = `NIA | Master Roster!B${row}`;

    const response = await sheets.spreadsheets.values.get({ spreadsheetId: rosterSpreadsheetId, range });
    const value = response.data.values ? response.data.values[0][0] : null;

    if (!value) {
        throw new Error(`No value found in column B for row ${row}`);
    }

    return value;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('onboard-officer')
        .setDescription('Onboard an officer and update the roster.')
        .addStringOption(option =>
            option.setName('name_officer')
                .setDescription('The name of the officer.')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('timezone')
                .setDescription('Timezone of the officer.')
                .setRequired(true)
        )
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Discord user of the officer.')
                .setRequired(true)
        ),
    async execute(interaction) {
        const name = interaction.options.getString('name_officer');
        const timezone = interaction.options.getString('timezone');
        const user = interaction.options.getUser('user');
        const date = new Date().toISOString().split('T')[0];

        const allowedRoleId = '1318803166594207786';

        try {
            await interaction.deferReply({ ephemeral: true });

            const member = interaction.guild.members.cache.get(interaction.user.id);
            if (!member || !member.roles.cache.has(allowedRoleId)) {
                return await interaction.editReply({
                    content: 'You do not have the required role to use this command.',
                    ephemeral: true,
                });
            }

            const db = await getConnection();

            const badgeNumber = await getBadgeNumberAndUpdateSheet(timezone, name, user.id, date);

            const row = await updateMasterRoster(badgeNumber);
            const rosterValue = await getMasterRosterValue(row);

            await db.query(
                'INSERT INTO officers (name, timezone, user_id, badge_number) VALUES (?, ?, ?, ?)',
                [name, timezone, user.id, badgeNumber]
            );

            const nickname = `${rosterValue} | ${name}`;
            const userMember = interaction.guild.members.cache.get(user.id);
            if (userMember) await userMember.setNickname(nickname);

            const embed = new EmbedBuilder()
                .setTitle('Officer Onboarded')
                .setDescription(`Officer **${name}** has been successfully onboarded.`)
                .addFields(
                    { name: 'Badge Number', value: badgeNumber, inline: true },
                    { name: 'Timezone', value: timezone, inline: true },
                    { name: 'User', value: `<@${user.id}>`, inline: true }
                )
                .setColor('#110478')
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error(error);
            await interaction.editReply({ content: `An error occurred: ${error.message}`, ephemeral: false });
        }
    }
};