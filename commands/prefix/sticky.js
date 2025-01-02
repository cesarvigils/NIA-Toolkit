const stickyMessages = new Map();

module.exports = {
    name: 'sticky',
    description: 'Manage sticky messages in the channel (stick/unstick).',
    async execute(message, args) {
        const subCommand = args.shift()?.toLowerCase();
        const channelId = message.channel.id;

        if (!subCommand) {
            return message.reply('Please specify either "stick" or "unstick".');
        }

        if (subCommand === 'stick') {
            if (!args.length) {
                return message.reply('Please provide a message to stick.');
            }

            const stickMessage = args.join(' ');

            if (stickyMessages.has(channelId)) {
                const existingSticky = stickyMessages.get(channelId);

                if (existingSticky.collector) {
                    existingSticky.collector.stop(); // Stop the existing collector
                }

                if (existingSticky.message && existingSticky.message.deletable) {
                    try {
                        await existingSticky.message.delete();
                    } catch (error) {
                        if (error.code !== 10008) {
                            console.error('Error deleting sticky message:', error);
                        }
                    }
                }
            }

            const sentMessage = await message.channel.send(stickMessage);

            const collector = message.channel.createMessageCollector({
                filter: m => !m.author.bot,
                idle: 60000,
            });

            collector.on('collect', async () => {
                const stickyMessageData = stickyMessages.get(channelId);

                if (stickyMessageData && stickyMessageData.message.deletable) {
                    try {
                        await stickyMessageData.message.delete();
                    } catch (error) {
                        if (error.code !== 10008) {
                            console.error('Error deleting sticky message:', error);
                        }
                    }
                }

                const newMessage = await message.channel.send(stickMessage);
                stickyMessages.set(channelId, { message: newMessage, content: stickMessage, collector });
            });

            collector.on('end', () => {
                stickyMessages.delete(channelId);
            });

            stickyMessages.set(channelId, { message: sentMessage, content: stickMessage, collector });
            return message.reply('Sticky message has been set.');
        }

        if (subCommand === 'unstick') {
            if (!stickyMessages.has(channelId)) {
                return message.reply('There is no sticky message set for this channel.');
            }

            const stickyMessageData = stickyMessages.get(channelId);

            try {
                if (stickyMessageData.collector) {
                    stickyMessageData.collector.stop(); // Stop the collector
                }

                if (stickyMessageData.message && stickyMessageData.message.deletable) {
                    await stickyMessageData.message.delete();
                }

                stickyMessages.delete(channelId);
                return message.reply('Sticky message successfully removed from this channel.');
            } catch (error) {
                if (error.code === 10008) {
                    stickyMessages.delete(channelId);
                    return message.reply('Sticky message was already removed.');
                } else {
                    console.error('Error removing sticky message:', error);
                    return message.reply('An error occurred while trying to remove the sticky message.');
                }
            }
        }

        return message.reply('Invalid subcommand. Use "stick" or "unstick".');
    },
};