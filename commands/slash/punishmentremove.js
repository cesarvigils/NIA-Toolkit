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
        .setName('punishmentremove')
        .setDescription('Remove a punishment from a user.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user whose punishment you want to remove.')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option.setName('id')
                .setDescription('The ID of the punishment to remove.')
                .setRequired(true)
        ),
    async execute(interaction) {
        const allowedRoleId = '1318803148017500191'; // Replace with the role ID allowed to execute this command
        const targetUser = interaction.options.getUser('user');
        const punishmentId = interaction.options.getInteger('id');
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
            const [rows] = await db.query(
                'SELECT * FROM punishments WHERE id = ? AND punished_user_id = ?',
                [punishmentId, targetUser.id]
            );

            if (rows.length === 0) {
                return interaction.editReply({
                    content: `No punishment with ID **${punishmentId}** found for ${targetUser.tag}.`,
                    ephemeral: true,
                });
            }

            await db.query('DELETE FROM punishments WHERE id = ?', [punishmentId]);

            const embed = new EmbedBuilder()
                .setTitle('Punishment Removed')
                .setDescription(`The punishment for **${targetUser.tag}** has been successfully removed.`)
                .addFields(
                    { name: 'Punishment ID', value: punishmentId.toString(), inline: true },
                    { name: 'Executor', value: `${executor.tag} (${executor.id})`, inline: true }
                )
                .setColor('#00FF00')
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error(error);
            await interaction.editReply({
                content: `An error occurred while removing the punishment: ${error.message}`,
                ephemeral: true,
            });
        }
    },
};
