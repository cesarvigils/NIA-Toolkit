require('dotenv').config();
const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const mysql = require('mysql2/promise');
const axios = require('axios');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

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

async function getUserBadgeAndName(userId) {
    const db = await getConnection();
    const [rows] = await db.query(
        'SELECT badge_number, name FROM officers WHERE user_id = ?',
        [userId]
    );
    if (rows.length === 0) {
        throw new Error('Badge number or name not found for this user.');
    }
    const badgeNumber = String(rows[0].badge_number).padStart(5, '0');
    return { badge_number: badgeNumber, name: rows[0].name };
}

async function generateBadgeImage(badgeNumber, rank, name, badgeType) {
    const badgeUrls = {
        hc: `https://www.visualbadge.com/badge.aspx?badge=S511&base=gold&textfont=BLOCK&textcolor=BLACK&text1=${encodeURIComponent(rank)}&text2=NATIONAL%20INTELLIGENCE&text3=&text4=${encodeURIComponent(name)}&text5=${badgeNumber}&text6=&seal=C125P&textsep=NONE&bcolor=`,
        lowcmd: `https://www.visualbadge.com/badge.aspx?badge=S511&base=gold&textfont=BLOCK&textcolor=BLACK&text1=${encodeURIComponent(rank)}&text2=NATIONAL%20INTELLIGENCE&text3=&text4=${encodeURIComponent(name)}&text5=${badgeNumber}&text6=&seal=C125BKE&textsep=NONE&bcolor=`,
        patrol: `https://www.visualbadge.com/badge.aspx?badge=S511&base=silver&textfont=BLOCK&textcolor=BLACK&text1=${encodeURIComponent(rank)}&text2=NATIONAL%20INTELLIGENCE&text3=&text4=${encodeURIComponent(name)}&text5=${badgeNumber}&text6=&seal=C125BKE&textsep=NONE&bcolor=`,
        supervisor: `https://www.visualbadge.com/badge.aspx?badge=S511&base=gons&textfont=BLOCK&textcolor=BLACK&text1=${encodeURIComponent(rank)}&text2=NATIONAL%20INTELLIGENCE&text3=&text4=${encodeURIComponent(name)}&text5=${badgeNumber}&text6=&seal=C125BKE&textsep=NONE&bcolor=`,
        triallowcmd: `https://www.visualbadge.com/badge.aspx?badge=S511&base=song&textfont=BLOCK&textcolor=BLACK&text1=${encodeURIComponent(rank)}&text2=NATIONAL%20INTELLIGENCE&text3=&text4=${encodeURIComponent(name)}&text5=${badgeNumber}&text6=&seal=C125BKE&textsep=NONE&bcolor=`,
    };

    if (!badgeUrls[badgeType]) {
        throw new Error('Invalid badge type.');
    }

    const response = await axios({
        url: badgeUrls[badgeType],
        responseType: 'arraybuffer',
    });

    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir);
    }

    const filePath = path.join(tempDir, `badge_${badgeNumber}.png`);
    const imageBuffer = await sharp(response.data)
        .resize(469, 469, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
        .toBuffer();

    fs.writeFileSync(filePath, imageBuffer);
    return filePath;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('badge')
        .setDescription('Generate a badge with your badge number, rank, and type.')
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Type of badge.')
                .setRequired(true)
                .addChoices(
                    { name: 'HC', value: 'hc' },
                    { name: 'Low Command', value: 'lowcmd' },
                    { name: 'Patrol', value: 'patrol' },
                    { name: 'Supervisor', value: 'supervisor' },
                    { name: 'Trial Low Command', value: 'triallowcmd' }
                )
        )
        .addStringOption(option =>
            option.setName('rank')
                .setDescription('Rank to display on the badge.')
                .setRequired(true)
        ),
    async execute(interaction) {
        const badgeType = interaction.options.getString('type');
        const rank = interaction.options.getString('rank');

        try {
            await interaction.deferReply();

            const userId = interaction.user.id;
            const { badge_number: badgeNumber, name } = await getUserBadgeAndName(userId);

            const filePath = await generateBadgeImage(badgeNumber, rank, name, badgeType);

            const attachment = new AttachmentBuilder(filePath, { name: 'badge.png' });

            await interaction.editReply({
                content: 'Here is your badge!',
                files: [attachment],
            });

            fs.unlinkSync(filePath);
        } catch (error) {
            console.error(error);
            await interaction.editReply({ content: `An error occurred: ${error.message}` });
        }
    },
};