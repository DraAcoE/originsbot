const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require('discord.js');

const { TOKEN, SERVER_ADDRESS, SEEDLOAF_DASHBOARD, STATUS_CHANNEL_ID } = require('./config');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Fetch server status from mcstatus.io
async function getServerStatus() {
  try {
    const res = await fetch(`https://api.mcstatus.io/v2/status/java/${SERVER_ADDRESS}`);
    const data = await res.json();
    return data;
  } catch (err) {
    console.error('Failed to fetch server status:', err);
    return null;
  }
}

// Build a rich status embed
async function buildStatusEmbed() {
  const status = await getServerStatus();

  if (!status) {
    return new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle('Could not fetch server status')
      .setDescription('There was an error connecting to the status API. Try again later.')
      .setTimestamp();
  }

  const online = status.online;
  const playerCount = status?.players?.online ?? 0;
  const maxPlayers = status?.players?.max ?? 0;
  const playerList = status?.players?.list ?? [];
  const version = status?.version?.name_clean ?? 'Unknown';
  const motd = status?.motd?.clean ?? 'No description';

  let playersText = '> No players online';
  if (playerList.length > 0) {
    playersText = playerList.map(p => `> **${p.name_clean ?? p.name}**`).join('\n');
  } else if (online && playerCount > 0) {
    playersText = `> ${playerCount} player(s) online (names hidden by server)`;
  }

  const embed = new EmbedBuilder()
    .setColor(online ? 0x57f287 : 0xff4444)
    .setTitle(online ? 'Origins Server - ONLINE' : 'Origins Server - OFFLINE')
    .setDescription(online ? `**MOTD:** ${motd}` : 'The server is offline. Start it from the dashboard!')
    .addFields(
      { name: 'Address', value: `\`${SERVER_ADDRESS}\``, inline: true },
      { name: 'Version', value: version, inline: true },
      { name: `Players (${playerCount}/${maxPlayers})`, value: playersText },
    )
    .setFooter({ text: 'Seedloaf shuts down after 5 min of inactivity' })
    .setTimestamp();

  return embed;
}

// Bot ready
client.on('ready', () => {
  console.log(`Bot online as ${client.user.tag}`);
  client.user.setActivity('Watching the Origins server', { type: 3 });
});

// Message commands
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const content = message.content.toLowerCase().trim();

  // !startserver
  if (content === '!startserver') {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('Open Seedloaf Dashboard')
        .setStyle(ButtonStyle.Link)
        .setURL(SEEDLOAF_DASHBOARD),
    );

    await message.reply({
      content: '**Click below to start the Origins server!**\n> Note: it will auto-shutdown after **5 minutes** of no players.',
      components: [row],
    });
  }

  // !status
  if (content === '!status') {
    const thinking = await message.reply('Checking server status...');
    const embed = await buildStatusEmbed();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('Open Dashboard')
        .setStyle(ButtonStyle.Link)
        .setURL(SEEDLOAF_DASHBOARD),
      new ButtonBuilder()
        .setCustomId('refresh_status')
        .setLabel('Refresh')
        .setStyle(ButtonStyle.Secondary),
    );

    await thinking.edit({ content: '', embeds: [embed], components: [row] });
  }

  // !players
  if (content === '!players') {
    const status = await getServerStatus();

    if (!status || !status.online) {
      return message.reply('The server is **offline** - no players to show!');
    }

    const playerList = status?.players?.list ?? [];
    const playerCount = status?.players?.online ?? 0;

    if (playerCount === 0) {
      return message.reply('The server is online but nobody is playing right now.');
    }

    if (playerList.length === 0) {
      return message.reply(`There are **${playerCount}** player(s) online, but the server has hidden their names.`);
    }

    const names = playerList.map((p, i) => `**${i + 1}.** ${p.name_clean ?? p.name}`).join('\n');
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`Online Players (${playerCount})`)
      .setDescription(names)
      .setTimestamp();

    await message.reply({ embeds: [embed] });
  }

  // !ip
  if (content === '!ip') {
    await message.reply(`**Server IP:** \`${SERVER_ADDRESS}\`\n> Join in Minecraft under **Multiplayer - Add Server**!`);
  }

  // !help
  if (content === '!help') {
    const embed = new EmbedBuilder()
      .setColor(0xfee75c)
      .setTitle('Origins Bot Commands')
      .addFields(
        { name: '`!startserver`', value: 'Get a link to start the server from the dashboard' },
        { name: '`!status`', value: 'Check if the server is online and player count' },
        { name: '`!players`', value: 'See who is currently in the server' },
        { name: '`!ip`', value: 'Get the server IP address' },
        { name: '`!help`', value: 'Show this help menu' },
      )
      .setFooter({ text: 'Seedloaf auto-shuts down after 5 min of inactivity' });

    await message.reply({ embeds: [embed] });
  }
});

// Button: Refresh status
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  if (interaction.customId === 'refresh_status') {
    await interaction.deferUpdate();
    const embed = await buildStatusEmbed();
    await interaction.editReply({ embeds: [embed] });
  }
});

client.login(TOKEN);