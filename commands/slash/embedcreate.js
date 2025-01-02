const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('createembed')
        .setDescription('Create a custom embed.')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The channel to send the embed.')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('title')
                .setDescription('The title of the embed.')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('content')
                .setDescription('The main content of the embed.')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('color')
                .setDescription('The color of the embed (hex code, e.g., #ff0000).')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('image')
                .setDescription('The URL of the image to include.')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('thumbnail')
                .setDescription('The URL of the thumbnail image to include.')
                .setRequired(false)
        ),
    async execute(interaction) {
        const allowedRoleId = '1318803148017500191'; // Replace with the ID of the role allowed to execute this command

        if (!interaction.member.roles.cache.has(allowedRoleId)) {
            return interaction.reply({
                content: 'You do not have the required role to execute this command.',
                ephemeral: true,
            });
        }

        const channel = interaction.options.getChannel('channel') || interaction.channel;
        const title = interaction.options.getString('title');
        const content = interaction.options.getString('content');
        const color = interaction.options.getString('color');
        const image = interaction.options.getString('image');
        const thumbnail = interaction.options.getString('thumbnail');

        const embed = new EmbedBuilder();

        if (title) embed.setTitle(title);
        if (content) embed.setDescription(content);

        if (color) {
            if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
                embed.setColor(color);
            } else {
                return interaction.reply({
                    content: 'Invalid color format. Please use a hex code like #ff0000.',
                    ephemeral: true,
                });
            }
        }

        if (image) embed.setImage(image);
        if (thumbnail) embed.setThumbnail(thumbnail);
        embed.setTimestamp();

        try {
            await channel.send({ embeds: [embed] });
            await interaction.reply({ content: 'Embed successfully created and sent.', ephemeral: true });
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: `An error occurred while creating the embed: ${error.message}`, ephemeral: true });
        }
    },
};
