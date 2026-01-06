
import { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, 
SelectMenuBuilder, Events, ChannelType, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./config.json'));
const ticket = JSON.parse(fs.readFileSync('./config_ticket.json'));

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

client.once(Events.ClientReady, () => {
  console.log(`Bot online como ${client.user.tag}`);
});

client.on(Events.InteractionCreate, async interaction => {
  if (interaction.isButton() && interaction.customId === 'open_ticket') {
    if (ticket.limit_one_ticket_per_user) {
      const existing = interaction.guild.channels.cache.find(c => 
        c.name.includes(interaction.user.id)
      );
      if (existing) {
        return interaction.reply({ content: '❌ Você já possui um ticket aberto.', ephemeral: true });
      }
    }

    const menu = new SelectMenuBuilder()
      .setCustomId('ticket_select')
      .setPlaceholder('Selecione a categoria')
      .addOptions(
        Object.entries(ticket.ticket_categories).map(([k,v]) => ({
          label: v.label,
          description: v.description,
          value: k
        }))
      );

    return interaction.reply({
      components: [new ActionRowBuilder().addComponents(menu)],
      ephemeral: true
    });
  }

  if (interaction.isSelectMenu() && interaction.customId === 'ticket_select') {
    const cat = interaction.values[0];
    const channel = await interaction.guild.channels.create({
      name: `ticket-${cat}-${interaction.user.username}`,
      type: ChannelType.GuildText,
      parent: ticket.category_id,
      permissionOverwrites: [
        {
          id: interaction.guild.id,
          deny: [PermissionFlagsBits.ViewChannel]
        },
        {
          id: interaction.user.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
        }
      ]
    });

    const embed = new EmbedBuilder()
      .setTitle(ticket.ticket_categories[cat].label)
      .setDescription(ticket.ticket_categories[cat].description)
      .setColor(ticket.embed_color);

    const closeBtn = new ButtonBuilder()
      .setCustomId('close_ticket')
      .setLabel('🔒 Fechar Ticket')
      .setStyle(ButtonStyle.Danger);

    await channel.send({
      embeds: [embed],
      components: [new ActionRowBuilder().addComponents(closeBtn)]
    });

    const logId = ticket.logs_channels?.[cat];
    if (logId) {
      const log = interaction.guild.channels.cache.get(logId);
      if (log) log.send(`📥 Ticket aberto: ${channel.name} por ${interaction.user.tag}`);
    }

    interaction.reply({ content: '✅ Ticket criado!', ephemeral: true });
  }

  if (interaction.isButton() && interaction.customId === 'close_ticket') {
    const logChannels = ticket.logs_channels || {};
    for (const id of Object.values(logChannels)) {
      const log = interaction.guild.channels.cache.get(id);
      if (log) log.send(`🔒 Ticket fechado: ${interaction.channel.name}`);
    }
    await interaction.channel.delete();
  }
});

client.login(process.env.TOKEN);

