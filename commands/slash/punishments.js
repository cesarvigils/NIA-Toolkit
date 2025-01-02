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
        .setName('punishments')
        .setDescription('View all punishments of a user.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user whose punishments you want to view.')
                .setRequired(true)
        ),
    async execute(interaction) {
        const targetUser = interaction.options.getUser('user');

        try {
            await interaction.deferReply();

            const db = await getConnection();
            const [rows] = await db.query(
                'SELECT id, punishment_type, reason, executor_name, timestamp FROM punishments WHERE punished_user_id = ?',
                [targetUser.id]
            );

            if (rows.length === 0) {
                return interaction.editReply({
                    content: `No punishments found for ${targetUser.tag}.`,
                    ephemeral: true,
                });
            }

            const embed = new EmbedBuilder()
                .setTitle(`Punishments for ${targetUser.tag}`)
                .setDescription(`Showing all punishments for **${targetUser.username}**.`)
                .setColor('#FFA500')
                .setTimestamp();

            rows.forEach(punishment => {
                embed.addFields({
                    name: `ID: ${punishment.id} - ${punishment.punishment_type}`,
                    value: `**Reason:** ${punishment.reason}\n**Executor:** ${punishment.executor_name}\n**Date:** ${new Date(punishment.timestamp).toLocaleString()}`,
                });
            });

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error(error);
            await interaction.editReply({ content: `An error occurred: ${error.message}`, ephemeral: true });
        }
    },
};