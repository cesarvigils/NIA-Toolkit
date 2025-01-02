const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
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

module.exports = {
    data: new SlashCommandBuilder()
        .setName('punish')
        .setDescription('Assign a punishment to a user.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to punish.')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('punishment')
                .setDescription('Type of punishment.')
                .setRequired(true)
                .addChoices(
                    { name: 'Verbal Warning', value: 'Verbal Warning' },
                    { name: 'Written Warning', value: 'Written Warning' },
                    { name: 'Strike', value: 'Strike' },
                    { name: 'Termination', value: 'Termination' }
                )
        )
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the punishment.')
                .setRequired(true)
        ),
    async execute(interaction) {
        const allowedRoleId = '1318803148017500191'; // Replace with the role ID that is allowed to use this command
        const punishedUser = interaction.options.getUser('user');
        const punishment = interaction.options.getString('punishment');
        const reason = interaction.options.getString('reason');
        const executor = interaction.user;

        if (!interaction.member.roles.cache.has(allowedRoleId)) {
            return interaction.reply({
                content: 'You do not have the required role to execute this command.',
                ephemeral: true,
            });
        }

        try {
            await interaction.deferReply();

            const db = await getConnection();
            const timestamp = new Date();

            await db.query(
                'INSERT INTO punishments (punished_user_id, punished_user_name, punishment_type, reason, executor_id, executor_name, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [
                    punishedUser.id,
                    punishedUser.username,
                    punishment,
                    reason,
                    executor.id,
                    executor.username,
                    timestamp,
                ]
            );

            const embed = new EmbedBuilder()
                .setTitle('Punishment Assigned')
                .addFields(
                    { name: 'Punished User', value: `${punishedUser.tag} (${punishedUser.id})`, inline: true },
                    { name: 'Punishment Type', value: punishment, inline: true },
                    { name: 'Reason', value: reason, inline: false },
                    { name: 'Executor', value: `${executor.tag} (${executor.id})`, inline: true },
                    { name: 'Timestamp', value: timestamp.toLocaleString(), inline: true }
                )
                .setColor(punishment === 'Termination' ? '#FF0000' : '#FFA500')
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error(error);
            await interaction.editReply({ content: `An error occurred while assigning the punishment: ${error.message}`, ephemeral: true });
        }
    },
};
