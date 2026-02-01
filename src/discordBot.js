import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  StringSelectMenuBuilder
} from 'discord.js';
import {
  MENU_KEYS,
  SLOT_KEYS,
  STATUS_KEYS,
  SCHEDULE_SLOT_KEYS,
  SCHEDULE_STATUS_KEYS,
  getMenus,
  getMessageState,
  registerMessage,
  formatReservationTable,
  formatScheduleTable,
  upsertReservation
} from './state.js';

export class KantineBot {
  constructor() {
    this.client = new Client({
      intents: [GatewayIntentBits.Guilds]
    });

    this.client.on('interactionCreate', (interaction) => this.handleInteraction(interaction));
  }

  async login(token) {
    if (!token) {
      throw new Error('DISCORD_TOKEN manquant');
    }

    await this.client.login(token);
    return this.client;
  }

  async sendKantineMessage(channelId, title) {
    const channel = await this.fetchChannel(channelId);
    const embed = this.buildMenuEmbed(title, getMenus(), 'Aucune réservation pour le moment.');
    const message = await channel.send({
      embeds: [embed],
      components: buildMenuButtons()
    });

    await registerMessage({
      messageId: message.id,
      channelId: message.channelId,
      title,
      type: 'menus'
    });

    return message;
  }

  async sendScheduleMessage(channelId, title) {
    const channel = await this.fetchChannel(channelId);
    const embed = this.buildScheduleEmbed(title, 'Aucune réservation pour le moment.');
    const message = await channel.send({
      embeds: [embed],
      components: buildScheduleButtons()
    });

    await registerMessage({
      messageId: message.id,
      channelId: message.channelId,
      title,
      type: 'schedule'
    });

    return message;
  }

  async refreshMessage(messageId) {
    const state = getMessageState(messageId);
    if (!state) {
      return;
    }

    try {
      const channel = await this.fetchChannel(state.channelId);
      const message = await channel.messages.fetch(messageId);
      const isSchedule = state.type === 'schedule';
      const embed = isSchedule
        ? this.buildScheduleEmbed(state.title, formatScheduleTable(state))
        : this.buildMenuEmbed(state.title, getMenus(), formatReservationTable(state));
      const components = isSchedule ? buildScheduleButtons() : buildMenuButtons();
      await message.edit({
        embeds: [embed],
        components
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Impossible de rafraîchir le message', error);
    }
  }

  async fetchChannel(channelId) {
    if (!channelId) {
      throw new Error('Channel ID obligatoire');
    }

    const channel = await this.client.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) {
      throw new Error('Salon introuvable ou non textuel');
    }

    return channel;
  }

  buildMenuEmbed(title, menus, reservationsText) {
    const embed = new EmbedBuilder().setTitle(title).setColor(0xf1c40f).setTimestamp(new Date());

    MENU_KEYS.forEach((key) => {
      const lines = menus[key]?.length ? menus[key].map((item, index) => `${index + 1}. ${item}`) : ['—'];
      embed.addFields({
        name: key,
        value: lines.join('\n'),
        inline: true
      });
    });

    embed.addFields({
      name: 'Réservations',
      value: reservationsText || 'Aucune réservation pour le moment.',
      inline: false
    });

    embed.setFooter({
      text: 'kantine by Niv - https://github.com/Nivmizz7/kantine'
    });

    return embed;
  }

  buildScheduleEmbed(title, reservationsText) {
    const embed = new EmbedBuilder().setTitle(title).setColor(0x3498db).setTimestamp(new Date());

    embed.addFields({
      name: 'Horaires',
      value: reservationsText || 'Aucune réservation pour le moment.',
      inline: false
    });

    embed.setFooter({
      text: 'kantine by Niv - https://github.com/Nivmizz7/kantine'
    });

    return embed;
  }

  async handleInteraction(interaction) {
    if (interaction.isButton()) {
      await this.handleButton(interaction);
      return;
    }

    if (interaction.isStringSelectMenu()) {
      await this.handleSelect(interaction);
    }
  }

  async handleButton(interaction) {
    const { customId, message } = interaction;
    const messageState = getMessageState(message.id);

    if (!messageState) {
      await interaction.reply({ content: 'Ce message ne peut plus être mis à jour.', ephemeral: true });
      return;
    }

    if (customId.startsWith('schedule:')) {
      const slot = customId.slice('schedule:'.length);
      await interaction.deferReply({ ephemeral: true });
      await upsertReservation(message.id, {
        userId: interaction.user.id,
        userTag: interaction.user.tag,
        displayName: getDisplayName(interaction),
        slot,
        choice: null
      });
      await this.refreshMessage(message.id);
      const label = SCHEDULE_STATUS_KEYS.includes(slot) ? `en ${slot}` : `sur ${slot}`;
      await interaction.editReply(`Tu es maintenant marqué ${label}.`);
      return;
    }

    if (customId.startsWith('slot:')) {
      const slot = customId.slice('slot:'.length);
      await interaction.reply({
        ephemeral: true,
        content: `Choisissez votre menu pour ${slot}`,
        components: [buildSelect(slot, message.id)]
      });
      return;
    }

    if (customId.startsWith('status:')) {
      const status = customId.slice('status:'.length);
      await interaction.deferReply({ ephemeral: true });
      await upsertReservation(message.id, {
        userId: interaction.user.id,
        userTag: interaction.user.tag,
        displayName: getDisplayName(interaction),
        slot: status,
        choice: null
      });
      await this.refreshMessage(message.id);
      await interaction.editReply(`Tu es maintenant marqué en ${status}.`);
      return;
    }
  }

  async handleSelect(interaction) {
    const { customId, values } = interaction;
    if (!customId.startsWith('choose:')) {
      return;
    }

    const rest = customId.slice('choose:'.length);
    const lastColon = rest.lastIndexOf(':');
    if (lastColon === -1) {
      return;
    }
    const slot = rest.slice(0, lastColon);
    const messageId = rest.slice(lastColon + 1);
    const choice = values[0];

    await interaction.deferUpdate();
    await upsertReservation(messageId, {
      userId: interaction.user.id,
      userTag: interaction.user.tag,
      displayName: getDisplayName(interaction),
      slot,
      choice
    });

    await this.refreshMessage(messageId);

    await interaction.followUp({
      ephemeral: true,
      content: `Réservation enregistrée pour ${slot} (${choice}).`
    });
  }
}

function buildMenuButtons() {
  const buttons = [];
  SLOT_KEYS.forEach((slot) => {
    buttons.push(
      new ButtonBuilder().setCustomId(`slot:${slot}`).setLabel(slot).setStyle(ButtonStyle.Primary)
    );
  });
  STATUS_KEYS.forEach((status) => {
    buttons.push(
      new ButtonBuilder().setCustomId(`status:${status}`).setLabel(status).setStyle(ButtonStyle.Secondary)
    );
  });

  return buildButtonRows(buttons);
}

function buildScheduleButtons() {
  const buttons = [];
  SCHEDULE_SLOT_KEYS.forEach((slot) => {
    buttons.push(
      new ButtonBuilder().setCustomId(`schedule:${slot}`).setLabel(slot).setStyle(ButtonStyle.Primary)
    );
  });
  SCHEDULE_STATUS_KEYS.forEach((status) => {
    buttons.push(
      new ButtonBuilder().setCustomId(`schedule:${status}`).setLabel(status).setStyle(ButtonStyle.Secondary)
    );
  });

  return buildButtonRows(buttons);
}

function buildButtonRows(buttons) {
  const rows = [];
  for (let i = 0; i < buttons.length; i += 5) {
    rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
  }
  return rows;
}

function buildSelect(slot, messageId) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`choose:${slot}:${messageId}`)
      .setPlaceholder('Sélectionnez un menu')
      .addOptions(
        MENU_KEYS.map((key) => ({
          label: key,
          value: key
        }))
      )
  );
}

function getDisplayName(interaction) {
  return (
    interaction.member?.nickname ??
    interaction.user.globalName ??
    interaction.user.username ??
    interaction.user.tag
  );
}
