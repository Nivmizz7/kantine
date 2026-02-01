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
  getMenus,
  getMessageState,
  registerMessage,
  formatReservationTable,
  formatScheduleTable,
  upsertReservation,
  upsertScheduleSelection,
  markScheduleAbsence
} from './state.js';
import { getScheduleConfig } from './scheduleConfig.js';

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
    const scheduleConfig = await getScheduleConfig();
    const embed = this.buildScheduleEmbed(
      title,
      formatScheduleTable({ reservations: {} }, scheduleConfig)
    );
    const message = await channel.send({
      embeds: [embed],
      components: buildScheduleComponents(scheduleConfig)
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
      let embed = null;
      let components = null;
      if (isSchedule) {
        const scheduleConfig = await getScheduleConfig();
        embed = this.buildScheduleEmbed(state.title, formatScheduleTable(state, scheduleConfig));
        components = buildScheduleComponents(scheduleConfig);
      } else {
        embed = this.buildMenuEmbed(state.title, getMenus(), formatReservationTable(state));
        components = buildMenuButtons();
      }
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

    if (customId === 'schedule-absence') {
      if (messageState.type !== 'schedule') {
        await interaction.reply({ content: 'Ce message ne peut plus être mis à jour.', ephemeral: true });
        return;
      }

      await interaction.deferReply({ ephemeral: true });
      await markScheduleAbsence(message.id, {
        userId: interaction.user.id,
        userTag: interaction.user.tag,
        displayName: getDisplayName(interaction)
      });
      await this.refreshMessage(message.id);
      await interaction.editReply('Tu es maintenant marqué en Absence.');
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
    if (customId.startsWith('schedule-select:')) {
      const period = customId.slice('schedule-select:'.length);
      if (period !== 'matin' && period !== 'apresmidi') {
        return;
      }
      const messageState = getMessageState(interaction.message.id);
      if (!messageState || messageState.type !== 'schedule') {
        await interaction.reply({ content: 'Ce message ne peut plus être mis à jour.', ephemeral: true });
        return;
      }

      const time = values[0];
      await interaction.deferUpdate();
      await upsertScheduleSelection(interaction.message.id, {
        userId: interaction.user.id,
        userTag: interaction.user.tag,
        displayName: getDisplayName(interaction),
        period,
        time
      });

      await this.refreshMessage(interaction.message.id);
      await interaction.followUp({
        ephemeral: true,
        content: `Horaire ${period} enregistré (${time}).`
      });
      return;
    }

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

function buildScheduleComponents(scheduleConfig) {
  const rows = [];
  const morningOptions = toSelectOptions(scheduleConfig?.matin ?? []);
  const afternoonOptions = toSelectOptions(scheduleConfig?.apresmidi ?? []);

  if (morningOptions.length) {
    rows.push(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('schedule-select:matin')
          .setPlaceholder('Choisissez votre horaire matin')
          .addOptions(morningOptions)
      )
    );
  }

  if (afternoonOptions.length) {
    rows.push(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('schedule-select:apresmidi')
          .setPlaceholder('Choisissez votre horaire apres-midi')
          .addOptions(afternoonOptions)
      )
    );
  }

  rows.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('schedule-absence').setLabel('Absence').setStyle(ButtonStyle.Secondary)
    )
  );

  return rows;
}

function buildButtonRows(buttons) {
  const rows = [];
  for (let i = 0; i < buttons.length; i += 5) {
    rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
  }
  return rows;
}

function toSelectOptions(values) {
  return values
    .map((value) => String(value).trim())
    .filter((value) => value.length > 0)
    .slice(0, 25)
    .map((value) => ({
      label: value,
      value
    }));
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
