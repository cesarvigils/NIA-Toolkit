module.exports = {
    name: 'ping',
    description: 'Responds with Pong! and latency.',
    execute(message) {
        const sent = message.reply('Pinging...').then(sentMessage => {
            const latency = sentMessage.createdTimestamp - message.createdTimestamp;
            const apiLatency = Math.round(message.client.ws.ping);

            sentMessage.edit(`🏓 Pong! Latency is **${latency}ms**, API Latency is **${apiLatency}ms**.`);
        });
    },
};
