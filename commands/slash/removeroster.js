const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { google } = require('googleapis');
require('dotenv').config();

async function getAuth() {
    const rawCredentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    rawCredentials.private_key = rawCredentials.private_key.replace(/\\n/g, '\n');

    return new google.auth.GoogleAuth({
        credentials: rawCredentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
}

async function removeFromEmployeeRoster(auth, spreadsheetId, userId) {
    const sheets = google.sheets({ version: 'v4', auth });
    const range = 'NIA | Employee Data!B23:F';
    const response = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    const rows = response.data.values || [];

    let rowIndex = null;

    for (let i = 0; i < rows.length; i++) {
        if (rows[i][2]?.trim() === userId) {
            rowIndex = i + 23;
            break;
        }
    }

    if (!rowIndex) {
        throw new Error(`User ID ${userId} not found in the Employee Roster.`);
    }

    const updateRange = `NIA | Employee Data!C${rowIndex}:F${rowIndex}`;
    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: updateRange,
        valueInputOption: 'RAW',
        resource: { values: [['', '', '', '']] },
    });

    return rowIndex;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('roster-remove')
        .setDescription('Remove a user from the Employee Roster.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to remove from the roster.')
                .setRequired(true)
        ),
    async execute(interaction) {
        const allowedRoleId = '1318803148017500191'; // Replace with the ID of the role allowed to execute this command
        const user = interaction.options.getUser('user');

        if (!interaction.member.roles.cache.has(allowedRoleId)) {
            return interaction.reply({
                content: 'You do not have the required role to execute this command.',
                ephemeral: true,
            });
        }

        const auth = await getAuth();
        const spreadsheetId = '1R2DIGdXzMPruokBxdj-yCTilgQ2WXZkmJdghjrw4U2c'; // Replace with your spreadsheet ID

        try {
            await interaction.deferReply();

            const rowIndex = await removeFromEmployeeRoster(auth, spreadsheetId, user.id);

            const embed = new EmbedBuilder()
                .setTitle('User Removed from Roster')
                .setDescription(`The user **${user.tag}** has been removed from the Employee Roster.`)
                .addFields(
                    { name: 'Row Cleared', value: rowIndex.toString(), inline: true },
                    { name: 'Columns Cleared', value: 'C, D, E, F', inline: true }
                )
                .setColor('#FF0000')
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error(error);
            await interaction.editReply({
                content: `An error occurred while removing the user from the roster: ${error.message}`,
                ephemeral: true,
            });
        }
    },
};
