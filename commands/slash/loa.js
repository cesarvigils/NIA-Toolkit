const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const schedule = require('node-schedule'); // To schedule role removal after the specified time

module.exports = {
    data: new SlashCommandBuilder()
        .setName('loa')
        .setDescription('Request a leave of absence (LOA).')
        .addIntegerOption(option =>
            option.setName('days')
                .setDescription('Number of days for the leave.')
                .setRequired(true)
        ),
    async execute(interaction) {
        const user = interaction.user;
        const guild = interaction.guild;
        const days = interaction.options.getInteger('days');

        const approverRoleId = '1318803142338412565'; // Replace with the ID of the approver role
        const loaRoleId = '1318803220549865484'; // Replace with the ID of the LOA role
        const loaRequestChannelId = '1318803338006888468'; // Replace with the ID of the LOA request channel

        if (days <= 0) {
            return interaction.reply({ content: 'The number of days must be greater than zero.', ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setTitle('Leave of Absence Request')
            .setDescription(`${user} has requested a leave of absence for **${days} day(s)**.`)
            .addFields({ name: 'Status', value: 'Pending', inline: true })
            .setColor('#FFA500')
            .setTimestamp();

        const approveButton = new ButtonBuilder()
            .setCustomId(`approve-${user.id}-${days}`)
            .setLabel('Approve')
            .setStyle(ButtonStyle.Success);

        const declineButton = new ButtonBuilder()
            .setCustomId(`decline-${user.id}-${days}`)
            .setLabel('Decline')
            .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder().addComponents(approveButton, declineButton);

        const loaRequestChannel = guild.channels.cache.get(loaRequestChannelId);
        if (!loaRequestChannel) {
            return interaction.reply({ content: 'The LOA request channel could not be found.', ephemeral: true });
        }

        const requestMessage = await loaRequestChannel.send({
            embeds: [embed],
            components: [row],
        });

        await interaction.reply({ content: `Your LOA request has been sent to <#${loaRequestChannelId}>.`, ephemeral: true });

        const collector = requestMessage.createMessageComponentCollector({ time: 3600000 }); // 1 hour

        collector.on('collect', async i => {
            if (!i.member.roles.cache.has(approverRoleId)) {
                return i.reply({ content: 'You are not authorized to approve or decline LOA requests.', ephemeral: true });
            }

            const [action, userId, duration] = i.customId.split('-');
            const targetUser = await guild.members.fetch(userId);

            if (!targetUser) {
                return i.reply({ content: 'The user could not be found.', ephemeral: true });
            }

            if (action === 'approve') {
                const loaRole = guild.roles.cache.get(loaRoleId);
                if (!loaRole) {
                    return i.reply({ content: 'The LOA role could not be found.', ephemeral: true });
                }

                await targetUser.roles.add(loaRole);

                const removalDate = new Date();
                removalDate.setDate(removalDate.getDate() + parseInt(duration));

                schedule.scheduleJob(removalDate, async () => {
                    if (targetUser.roles.cache.has(loaRoleId)) {
                        await targetUser.roles.remove(loaRole);
                    }
                });

                embed.setFields({ name: 'Status', value: `Approved by ${i.user.tag} for ${duration} day(s)`, inline: true }).setColor('#00FF00');
                await requestMessage.edit({ embeds: [embed], components: [] });
                return i.reply({ content: `LOA for **${targetUser.user.username}** has been approved for ${duration} day(s).`, ephemeral: true });
            } else if (action === 'decline') {
                embed.setFields({ name: 'Status', value: `Declined by ${i.user.tag}`, inline: true }).setColor('#FF0000');
                await requestMessage.edit({ embeds: [embed], components: [] });
                return i.reply({ content: `LOA request for **${targetUser.user.username}** has been declined.`, ephemeral: true });
            }
        });

        collector.on('end', collected => {
            if (collected.size === 0) {
                embed.setFields({ name: 'Status', value: 'Timed Out', inline: true }).setColor('#808080');
                requestMessage.edit({ embeds: [embed], components: [] });
            }
        });
    },
};
