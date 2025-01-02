const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { google } = require('googleapis');
const mysql = require('mysql2/promise');
require('dotenv').config();

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

const RANK_RANGES = {
    "Field Commander": "D31:D33",
    "Field Deputy Commander": "D34:D37",
    "Special Agent in Charge (SAC)": "D38:D41",
    "Assistant Special Agent in Charge (ASAC)": "D45:D54",
    "Supervisory Special Agent": "D55:D64",
    "Lead Special Agent": "D65:D94",
    "Senior Special Agent": "D98:D129",
    "Special Agent": "D133:D151",
    "Agent": "D152:D192",
    "Probationary Agent": "D196:D225",
    "Agent In Training": "D228:D229",
    "Reserves": "D282:D291",
};

async function getAuth() {
    const rawCredentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    rawCredentials.private_key = rawCredentials.private_key.replace(/\\n/g, '\n');

    return new google.auth.GoogleAuth({
        credentials: rawCredentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
}

async function getBadgeNumberByDiscordIdFromSQL(discordId) {
    const db = await getConnection();
    const [rows] = await db.query(
        'SELECT badge_number FROM officers WHERE user_id = ?',
        [discordId]
    );
    if (rows.length === 0) {
        throw new Error(`Badge number not found for Discord ID: ${discordId}`);
    }
    return rows[0].badge_number.toString().padStart(5, '0');
}

async function moveBadgeNumber(auth, spreadsheetId, badgeNumber, rank) {
    const sheets = google.sheets({ version: 'v4', auth });
    const masterRosterRange = 'NIA | Master Roster!D2:D300';
    const newRankRange = `NIA | Master Roster!${RANK_RANGES[rank]}`;

    const masterResponse = await sheets.spreadsheets.values.get({ spreadsheetId, range: masterRosterRange });
    const rows = masterResponse.data.values || [];

    let currentCell = null;

    for (let i = 0; i < rows.length; i++) {
        if (rows[i]?.[0]?.padStart(5, '0') === badgeNumber) {
            currentCell = `D${i + 2}`;
            break;
        }
    }

    if (!currentCell) {
        throw new Error(`Badge number ${badgeNumber} not found in the Master Roster.`);
    }

    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `NIA | Master Roster!${currentCell}`,
        valueInputOption: 'RAW',
        resource: { values: [['']] },
    });

    const newRankResponse = await sheets.spreadsheets.values.get({ spreadsheetId, range: newRankRange });
    const newRankRows = newRankResponse.data.values || [];
    const rangeStartRow = parseInt(RANK_RANGES[rank].split(':')[0].substring(1));
    let newCellRow = null;

    for (let i = 0; i < newRankRows.length; i++) {
        if (!newRankRows[i]?.[0]?.trim()) {
            newCellRow = rangeStartRow + i;
            break;
        }
    }

    if (!newCellRow) {
        newCellRow = rangeStartRow + newRankRows.length;
    }

    const newCell = `D${newCellRow}`;
    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `NIA | Master Roster!${newCell}`,
        valueInputOption: 'RAW',
        resource: { values: [[badgeNumber]] },
    });

    const rowRange = `NIA | Master Roster!B${newCellRow}:C${newCellRow}`;
    const rowResponse = await sheets.spreadsheets.values.get({ spreadsheetId, range: rowRange });
    const rowData = rowResponse.data.values || [];

    if (rowData.length === 0 || rowData[0].length < 2) {
        throw new Error('Failed to retrieve nickname components from Master Roster.');
    }

    return {
        prefix: rowData[0][0],
        name: rowData[0][1],
    };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('move')
        .setDescription('Move a user to a new rank.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to move.')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('rank')
                .setDescription('The new rank to assign.')
                .setRequired(true)
                .addChoices(
                    { name: 'Field Commander', value: 'Field Commander' },
                    { name: 'Field Deputy Commander', value: 'Field Deputy Commander' },
                    { name: 'Special Agent in Charge (SAC)', value: 'Special Agent in Charge (SAC)' },
                    { name: 'Assistant Special Agent in Charge (ASAC)', value: 'Assistant Special Agent in Charge (ASAC)' },
                    { name: 'Supervisory Special Agent', value: 'Supervisory Special Agent' },
                    { name: 'Lead Special Agent', value: 'Lead Special Agent' },
                    { name: 'Senior Special Agent', value: 'Senior Special Agent' },
                    { name: 'Special Agent', value: 'Special Agent' },
                    { name: 'Agent', value: 'Agent' },
                    { name: 'Probationary Agent', value: 'Probationary Agent' },
                    { name: 'Agent In Training', value: 'Agent In Training' },
                    { name: 'Reserves', value: 'Reserves' }
                )
        ),
    async execute(interaction) {
        const user = interaction.options.getUser('user');
        const rank = interaction.options.getString('rank');
        const auth = await getAuth();
        const spreadsheetId = '1R2DIGdXzMPruokBxdj-yCTilgQ2WXZkmJdghjrw4U2c';

        try {
            await interaction.deferReply();

            const badgeNumber = await getBadgeNumberByDiscordIdFromSQL(user.id);
            const { prefix, name } = await moveBadgeNumber(auth, spreadsheetId, badgeNumber, rank);

            await interaction.guild.members.cache.get(user.id).setNickname(`${prefix} | ${name}`);

            const embed = new EmbedBuilder()
                .setTitle('User Moved')
                .setDescription(`**${user.username}** has been moved to the rank **${rank}**.`)
                .addFields({ name: 'Badge Number', value: badgeNumber, inline: true })
                .setColor('#110478')
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error(error);
            await interaction.editReply({
                content: `An error occurred: ${error.message}`,
                ephemeral: true,
            });
        }
    },
};