
// ===================================================
// HERRYHACKS BOT - FULL FEATURED CODE (FIXED AI)
// ===================================================

const { Client, GatewayIntentBits, Collection, REST, Routes, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField, ChannelType } = require('discord.js');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences
    ]
});

client.commands = new Collection();
const commands = [];

// Track message history
const userMessageHistory = new Map();
const chatContextHistory = new Map();

// Dynamic Fallback Replies
const ownerFallbacks = [
    "Herry Sir, boliye kya karna hai?",
    "Boss, main online hu, command bataiye!",
    "Herry Sir, aaj kya plan hai server ka?",
    "Ji Boss, sun raha hu!"
];

const vipRespectFallbacks = [
    "Aapka welcome hai sir, bataiye kya madad karun?",
    "Ji respected member, main aapki service me hu.",
    "Bataiye sir, aapke liye kya script ya details chahiye?"
];

const bakchodiFallbacks = [
    "Abe saale mero se hi bakchodi kar raha hai?",
    "Tu kitna bhi VIP ban ja, bakchodi karega to dhe daalunga!",
    "Chal chal ziada here wat ban, sidha bol kya scene hai!",
    "Abe tu VIP role leke bakchodi kar raha hai? Baap ko mat sikhaye!"
];

const politeFallbacks = [
    "Haan bhai, kaise ho?",
    "Bolo brother, kya help chahiye?",
    "Haan ji, bataiye kya masla hai?",
    "Suno bhai, main yahin hu bolo."
];

const rudeFallbacks = [
    "Abe saale abhi bhi kya tamasha hai!",
    "Bar bar tag kya kar raha hai bsdk?",
    "Kaam bol apna, faltu me tag mat kar!",
    "Kya hai abe? Ek baar me bol jo bolna hai!"
];

function getRandomFallback(array) {
    return array[Math.floor(Math.random() * array.length)];
}

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "YOUR_GEMINI_API_KEY");
const aiModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// Slash Command Handler
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
            commands.push(command.data.toJSON());
        }
    }
}

client.once('ready', async () => {
    console.log(`🤖 Logged in successfully as ${client.user.tag}! HerryHacks System Active.`);
    
    const botToken = process.env.TOKEN || process.env.DISCORD_TOKEN;
    const clientId = process.env.CLIENT_ID || process.env.CLIENTID;

    if (!botToken || !clientId) {
        console.error("❌ TOKEN or CLIENT_ID missing in Railway Environment Variables!");
        return;
    }

    const rest = new REST({ version: '10' }).setToken(botToken);
    try {
        console.log("🔄 Refreshing application (/) commands...");
        await rest.put(
            Routes.applicationCommands(clientId),
            { body: commands }
        );
        console.log("✅ Successfully reloaded application (/) commands.");
    } catch (error) {
        console.error("Slash Command Error:", error);
    }
});

// Ticket System & Interaction Handler
client.on('interactionCreate', async interaction => {
    try {
        if (interaction.isButton()) {
            if (interaction.customId === 'create_ticket') {
                const guild = interaction.guild;
                const rawCategoryId = process.env.TICKET_CATEGORY_ID;
                const categoryId = (rawCategoryId && rawCategoryId.length > 5) ? rawCategoryId : null;
                const staffRoleId = process.env.STAFF_ROLE_ID;

                const permissionOverwrites = [
                    { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                    { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] }
                ];

                if (staffRoleId && staffRoleId.length > 10) {
                    permissionOverwrites.push({
                        id: staffRoleId,
                        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
                    });
                }

                const channelOptions = {
                    name: `ticket-${interaction.user.username}`,
                    type: ChannelType.GuildText,
                    permissionOverwrites: permissionOverwrites
                };

                if (categoryId) channelOptions.parent = categoryId;

                const channel = await guild.channels.create(channelOptions);
                const embed = new EmbedBuilder()
                    .setColor('#FFD700')
                    .setTitle('🎫 Support Ticket')
                    .setDescription(`Welcome ${interaction.user}, your ticket is created! Describe your issue below.`);

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('close_ticket')
                        .setLabel('🔒 Close Ticket')
                        .setStyle(ButtonStyle.Danger)
                );

                await channel.send({ content: `${interaction.user}`, embeds: [embed], components: [row] });
                await interaction.reply({ content: `✅ Ticket created: ${channel}`, ephemeral: true });
            }

            if (interaction.customId === 'close_ticket') {
                await interaction.reply({ content: '🔒 Closing ticket in 5 seconds...' });
                setTimeout(() => {
                    if (interaction.channel) interaction.channel.delete().catch(() => {});
                }, 5000);
            }
            return;
        }

        if (!interaction.isChatInputCommand()) return;
        const command = client.commands.get(interaction.commandName);
        if (!command) return;
        await command.execute(interaction);
    } catch (error) {
        console.error("Interaction Error:", error);
    }
});

// Main AI & Auto-Moderation Engine
client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    const lowerQuery = message.content.toLowerCase().trim();
    const isMentioned = message.mentions.has(client.user);
    const ownerId = process.env.OWNER_ID;
    const isOwner = ownerId ? (message.author.id === ownerId.trim()) : false;

    // Special VIP Roles Check
    const vipRoleIds = ["1529467733161283034", "1529467634956112063", "1529467634956112064"];
    const hasVipRole = message.member ? message.member.roles.cache.some(r => vipRoleIds.includes(r.id)) : false;

    // Bakchodi Detection Logic
    const bakchodiWords = ["bsdk", "saale", "chutiye", "bakchodi", "chutia"];
    const isDoingBakchodi = bakchodiWords.some(w => new RegExp(`\\b${w}\\b`, 'i').test(lowerQuery));

    const scriptLink = 'https://discord.com/channels/1529467083962843186/1529467733161283034';
    const setupLink = 'https://discord.com/channels/1529467083962843186/1529467733161283034';

    // 1. SEVERE ABUSE -> AUTO BAN
    const severeAbuses = ["maa", "behen", "behn", "madarchod", "bhenchod"];
    const containsSevereAbuse = severeAbuses.some(word => new RegExp(`\\b${word}\\b`, 'i').test(lowerQuery));

    if (containsSevereAbuse && !isOwner) {
        try {
            await message.delete().catch(() => {});
            if (message.guild.members.me.permissions.has(PermissionsBitField.Flags.BanMembers)) {
                await message.guild.members.ban(message.author.id, { reason: "Severe Abuse" });
                return message.channel.send(`🚨 **${message.author.tag}** was banned for severe abuse!`);
            }
        } catch (e) {
            console.error("Ban Execution Error:", e.message);
        }
    }

    // 2. FAKE OWNER CLAIMS -> 1 HOUR TIMEOUT
    const fakeOwnerClaims = ["i am herry", "iam herry", "im herry", "i am owner"];
    if (fakeOwnerClaims.some(phrase => lowerQuery.includes(phrase)) && !isOwner) {
        try {
            if (message.member && message.guild.members.me.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
                await message.member.timeout(60 * 60 * 1000, "Fake Owner Claim");
                return message.reply("⚠️ MENE DETECT KRLIYA BSDK BHAG YAHA SE! (1 Hour Timeout)");
            }
        } catch (e) {
            console.error("Fake Owner Timeout Error:", e.message);
        }
    }

    // 3. COMPETITOR HACKS
    if (["adi1", "yuvraj", "rudra"].some(c => lowerQuery.includes(c))) {
        return message.reply("Abe saale un 3rd class scammer logon ka naam mat le yahan!");
    }

    // 4. GC HACK SPECIFIC QUERY
    if (lowerQuery.includes("gc hack") || lowerQuery.includes("gchack")) {
        if (lowerQuery.includes("kab") || lowerQuery.includes("when")) {
            return message.reply("We working on it. If we find Way to create GC Hack, we will release it!");
        }
        return message.reply("GC Hack is Unavailable.");
    }

    // 5. BACHA / KID CALLING -> 3 DAYS TIMEOUT
    if (["bacha", "bachha", "kid", "pappu"].some(w => new RegExp(`\\b${w}\\b`, 'i').test(lowerQuery)) && !isOwner) {
        try {
            if (message.member && message.guild.members.me.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
                await message.member.timeout(3 * 24 * 60 * 60 * 1000, "Calling someone kid/bacha");
                return message.reply(`🚨 ${message.author} tu kisse bacha bol raha hai bsdk! (3 Days Timeout)`);
            }
        } catch (e) {
            console.error("Bacha Timeout Error:", e.message);
        }
    }

    // 6. OWNER QUERY CHECK
    if (["who is owner", "owner kon he", "owner kaun hai", "owner kon hai"].some(q => lowerQuery.includes(q))) {
        return message.reply("👑 **Herry Sir** is the official owner of HerryHacks!");
    }

    // 7. SCRIPT & SETUP REQUESTS
    if (lowerQuery.includes("link") && ["reversozz", "lulubox", "devvip"].some(k => lowerQuery.includes(k))) {
        return message.reply(`🔗 **Official Script Link:**\n${scriptLink}`);
    }
    if (lowerQuery.includes("where is posya") || lowerQuery.includes("where is script")) {
        return message.reply(`🔗 **HerryPosya Script Link:**\n${scriptLink}`);
    }
    if (["setup guide", "guide link", "kaise kare link", "install link"].some(k => lowerQuery.includes(k))) {
        return message.reply(`🔗 **Setup Guide Link:**\n${setupLink}`);
    }

    // 8. SPAM DETECTION
    const now = Date.now();
    const userHistory = userMessageHistory.get(message.author.id) || [];
    userHistory.push({ text: lowerQuery, time: now });
    const recentHistory = userHistory.filter(m => now - m.time < 10000);
    userMessageHistory.set(message.author.id, recentHistory);

    if (recentHistory.filter(m => m.text === lowerQuery).length >= 3 && !isOwner) {
        try {
            if (message.member && message.guild.members.me.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
                await message.member.timeout(1 * 24 * 60 * 60 * 1000, "Spamming same message");
                return message.channel.send(`⚠️ ${message.author} ne same message spam kiya. Timeout Applied!`);
            }
        } catch (e) {
            console.error("Spam Handling Error:", e.message);
        }
    }

    if (!isMentioned) return;

    // 9. DYNAMIC AI RESPONSE ENGINE (FIXED GEMINI SYSTEM)
    try {
        await message.channel.sendTyping();
        const cleanUserQuery = message.content.replace(/<@!?\d+>/g, '').trim();

        const isPoliteUser = ["bhai", "sir", "bro", "dear", "pyaare", "pyare"].some(p => lowerQuery.includes(p));
        let activePrompt = "";

        if (isOwner) {
            activePrompt = "You are HerryBot in HerryHacks Server. The user is your creator and owner Herry. Be super respectful, talk in Roman Urdu/English.";
        } else if (hasVipRole) {
            if (isDoingBakchodi) {
                activePrompt = "You are HerryBot in HerryHacks Server. The user has VIP role but is acting rude. Answer smartly with attitude in Roman Urdu.";
            } else {
                activePrompt = "You are HerryBot in HerryHacks Server. The user is a VIP Member. Be very helpful and respectful.";
            }
        } else if (isPoliteUser) {
            activePrompt = "You are HerryBot. User is asking politely. Be helpful and polite in Roman Urdu/English.";
        } else {
            activePrompt = "You are HerryBot. User is a regular member. Give direct and smart answers in Roman Urdu/English.";
        }

        // Call Gemini AI
        const promptText = `${activePrompt}\nUser (${message.author.username}) says: ${cleanUserQuery}`;
        const result = await aiModel.generateContent(promptText);
        let replyText = result.response.text();

        // Backup Fallback if API response is empty
        if (!replyText || replyText.trim() === '') {
            if (isOwner) replyText = getRandomFallback(ownerFallbacks);
            else if (hasVipRole && isDoingBakchodi) replyText = getRandomFallback(bakchodiFallbacks);
            else if (hasVipRole) replyText = getRandomFallback(vipRespectFallbacks);
            else if (isPoliteUser) replyText = getRandomFallback(politeFallbacks);
            else replyText = getRandomFallback(rudeFallbacks);
        }

        let cleanText = replyText
            .replace(/<think>[\s\S]*?<\/think>/gi, '')
            .replace(/^['"]|['"]$/g, '')
            .trim();

        if (isOwner && !cleanText.toLowerCase().startsWith("herry sir")) {
            cleanText = `Herry Sir, ${cleanText}`;
        }

        await message.reply(cleanText.length > 1900 ? cleanText.substring(0, 1900) : cleanText);

    } catch (error) {
        console.error("Main AI Handler Error:", error.message);
        // Fallback on AI error
        let fallbackMsg = isOwner ? getRandomFallback(ownerFallbacks) : getRandomFallback(politeFallbacks);
        await message.reply(fallbackMsg);
    }
});

// Moderation Prefix Commands (.kick, .ban, .unban, !timeout, !rta, !clear, !avatar, !pfp, !ping)
client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;
    const content = message.content.trim();

    // 1. Dot Commands (.kick, .ban, .unban)
    if (content.startsWith('.')) {
        const args = content.slice(1).trim().split(/ +/);
        const command = args.shift().toLowerCase();

        if (command === 'kick') {
            if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers)) return;
            const target = message.mentions.members.first();
            if (!target) return message.reply('❌ Mention a member.');
            const reason = args.slice(1).join(' ') || 'No reason';
            try {
                await target.kick(reason);
                message.channel.send(`👞 **${target.user.tag}** was kicked!`);
            } catch (e) {}
        }

        if (command === 'ban') {
            if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) return;
            const target = message.mentions.members.first();
            if (!target) return message.reply('❌ Mention a member.');
            const reason = args.slice(1).join(' ') || 'No reason';
            try {
                await target.ban({ reason });
                message.channel.send(`🔨 **${target.user.tag}** was banned!`);
            } catch (e) {}
        }

        if (command === 'unban') {
            if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) return;
            const userId = args[0];
            if (!userId) return message.reply('❌ Provide User ID.');
            try {
                await message.guild.members.unban(userId);
                message.channel.send(`✅ Unbanned User ID: **${userId}**`);
            } catch (e) {}
        }
    }

    // 2. Exclamation Commands (!timeout, !rta, !clear, !avatar, !pfp, !ping)
    if (content.startsWith('!')) {
        const args = content.slice(1).trim().split(/ +/);
        const command = args.shift().toLowerCase();

        if (command === 'timeout' || command === 'mute') {
            if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return;
            const target = message.mentions.members.first();
            const minutes = parseInt(args[1]);
            if (!target || !minutes || isNaN(minutes)) return message.reply('❌ Usage: `!timeout @user 10`');
            try {
                await target.timeout(minutes * 60 * 1000);
                message.channel.send(`⏳ **${target.user.tag}** timed out for ${minutes} minutes.`);
            } catch (e) {}
        }

        if (command === 'rta') {
            if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return;
            const target = message.mentions.members.first();
            if (!target) return message.reply('❌ Mention user.');
            try {
                await target.timeout(null);
                message.channel.send(`✅ Timeout removed for **${target.user.tag}**.`);
            } catch (e) {}
        }

        if (command === 'clear') {
            if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) return;
            const amount = parseInt(args[0]);
            if (!amount || amount < 1 || amount > 100) return message.reply('❌ Specify 1-100 messages.');
            try {
                await message.delete().catch(() => {});
                const deleted = await message.channel.bulkDelete(amount, true);
                const r = await message.channel.send(`🧹 Cleared **${deleted.size}** messages.`);
                setTimeout(() => r.delete().catch(() => {}), 4000);
            } catch (e) {
                message.channel.send('❌ Error clearing messages.');
            }
        }

        if (command === 'avatar' || command === 'pfp') {
            const target = message.mentions.users.first() || message.author;
            const embed = new EmbedBuilder()
                .setColor('#FFD700')
                .setTitle(`${target.username}'s Avatar`)
                .setImage(target.displayAvatarURL({ dynamic: true, size: 512 }));
            message.channel.send({ embeds: [embed] });
        }

        if (command === 'ping') {
            message.channel.send(`🏓 Pong! Latency: **${client.ws.ping}ms**`);
        }
    }

    if (content === '!HerryHacksyt') message.channel.send('🔴 Official YouTube: **Star Vlogs PK / Grandhacks**');
});

// Member Join/Leave Events
client.on('guildMemberAdd', async member => {
    const channelId = process.env.WELCOME_CHANNEL_ID;
    if (!channelId) return;
    const channel = member.guild.channels.cache.get(channelId);
    if (channel) {
        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('👑 Welcome To HerryHacks Server 👑')
            .setDescription(`Welcome ${member}!\n\nMention the bot for Grand Mobile RP help.`)
            .addFields({ name: '📊 Total Members', value: `${member.guild.memberCount}` })
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }));
        channel.send({ content: `👋 **WELCOME** ${member}`, embeds: [embed] });
    }
});

client.on('guildMemberRemove', async member => {
    const channelId = process.env.LEAVE_CHANNEL_ID;
    if (!channelId) return;
    const channel = member.guild.channels.cache.get(channelId);
    if (channel) {
        const embed = new EmbedBuilder()
            .setColor('#FF4D4D')
            .setTitle('👋 Member Left')
            .setDescription(`**${member.user.tag}** has left the server.`)
            .addFields({ name: '📊 Remaining Members', value: `${member.guild.memberCount}` });
        channel.send({ embeds: [embed] });
    }
});

// Bot Login
const botToken = process.env.TOKEN || process.env.DISCORD_TOKEN;
client.login(botToken);
