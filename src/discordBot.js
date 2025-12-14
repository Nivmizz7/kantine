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
  getMenus,
  getMessageState,
  registerMessage,
  formatReservationTable,
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
    const embed = this.buildEmbed(title, getMenus(), 'Aucune réservation pour le moment.');
    const message = await channel.send({
      embeds: [embed],
      components: buildButtons()
    });

    await registerMessage({
      messageId: message.id,
      channelId: message.channelId,
      title
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
      const embed = this.buildEmbed(state.title, getMenus(), formatReservationTable(state));
      await message.edit({
        embeds: [embed],
        components: buildButtons()
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

  buildEmbed(title, menus, reservationsText) {
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

    if (customId.startsWith('slot:')) {
      const slot = customId.split(':')[1];
      await interaction.reply({
        ephemeral: true,
        content: `Choisissez votre menu pour ${slot}`,
        components: [buildSelect(slot, message.id)]
      });
      return;
    }

    if (customId.startsWith('status:')) {
      const status = customId.split(':')[1];
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

    const [, slot, messageId] = customId.split(':');
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

function buildButtons() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('slot:11h-12h').setLabel('11h-12h').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('slot:12h-13h').setLabel('12h-13h').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('status:Absence').setLabel('Absence').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('status:Bench').setLabel('Bench').setStyle(ButtonStyle.Secondary)
    )
  ];
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
