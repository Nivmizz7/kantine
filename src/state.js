import path from 'path';
import { fileURLToPath } from 'url';
import Storage from './storage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataPath = path.resolve(__dirname, '../data/state.json');

export const MENU_KEYS = ['Kantine', 'Amerikain', 'Italien'];
export const SLOT_KEYS = ['11h-12h', '12h-13h'];
export const STATUS_KEYS = ['Absence', 'Bench'];
export const SCHEDULE_SLOT_KEYS = ['Matin', 'Fin'];
export const SCHEDULE_STATUS_KEYS = ['Absence'];

export const storage = new Storage(dataPath);

export async function initState() {
  await storage.init();
}

export function getMenus() {
  return storage.getState().menus;
}

export async function updateMenus(menusPayload) {
  const sanitizedMenus = {};
  MENU_KEYS.forEach((key) => {
    const value = menusPayload?.[key];
    if (Array.isArray(value)) {
      sanitizedMenus[key] = value.map((item) => String(item).trim()).filter(Boolean);
    } else if (typeof value === 'string') {
      sanitizedMenus[key] = value
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean);
    } else {
      sanitizedMenus[key] = [];
    }
  });

  await storage.update((state) => {
    state.menus = sanitizedMenus;
    return state;
  });

  return sanitizedMenus;
}

export function getSettings() {
  return storage.getState().settings;
}

export async function updateSettings(patch) {
  return storage.update((state) => {
    state.settings = {
      ...state.settings,
      ...patch
    };
    return state.settings;
  });
}

export async function registerMessage({ messageId, channelId, title, type = 'menus' }) {
  return storage.update((state) => {
    const finalType = type === 'schedule' ? 'schedule' : 'menus';
    state.messages[messageId] = {
      channelId,
      title,
      type: finalType,
      createdAt: Date.now(),
      reservations: {}
    };

    state.settings.defaultChannelId = channelId;
    if (finalType === 'schedule') {
      state.settings.lastScheduleTitle = title;
    } else {
      state.settings.lastTitle = title;
    }

    return state.messages[messageId];
  });
}

export function getMessageState(messageId) {
  const message = storage.getState().messages[messageId];
  if (!message) {
    return message;
  }

  if (!message.type) {
    return {
      ...message,
      type: 'menus'
    };
  }

  return message;
}

export async function upsertReservation(messageId, { userId, userTag, displayName, slot, choice }) {
  return storage.update((state) => {
    const message = state.messages[messageId];
    if (!message) {
      throw new Error('MESSAGE_NOT_FOUND');
    }

    message.reservations[userId] = {
      userId,
      userTag,
      displayName,
      slot,
      choice: choice ?? null,
      updatedAt: Date.now()
    };

    return message;
  });
}

export async function removeReservation(messageId, userId) {
  return storage.update((state) => {
    const message = state.messages[messageId];
    if (!message) {
      throw new Error('MESSAGE_NOT_FOUND');
    }

    delete message.reservations[userId];
    return message;
  });
}

export function formatReservationTable(message) {
  if (!message) {
    return 'Aucune réservation enregistrée.';
  }

  const bucket = {};
  SLOT_KEYS.forEach((slot) => {
    bucket[slot] = {};
    MENU_KEYS.forEach((menu) => {
      bucket[slot][menu] = [];
    });
  });
  STATUS_KEYS.forEach((status) => {
    bucket[status] = [];
  });

  Object.values(message.reservations ?? {}).forEach((entry) => {
    const label = entry.displayName ?? entry.userTag;
    if (STATUS_KEYS.includes(entry.slot)) {
      bucket[entry.slot].push(label);
      return;
    }

    const slotBucket = bucket[entry.slot];
    if (slotBucket && entry.choice && slotBucket[entry.choice]) {
      slotBucket[entry.choice].push(label);
    }
  });

  const lines = [];
  SLOT_KEYS.forEach((slot) => {
    lines.push(`**${slot}**`);
    MENU_KEYS.forEach((menu) => {
      const values = bucket[slot][menu];
      lines.push(`• ${menu}: ${values.length ? values.join(', ') : '—'}`);
    });
    lines.push('');
  });

  STATUS_KEYS.forEach((status) => {
    const values = bucket[status];
    lines.push(`**${status}**: ${values.length ? values.join(', ') : '—'}`);
  });

  return lines.join('\n').trim();
}

export function formatScheduleTable(message) {
  if (!message) {
    return 'Aucune réservation enregistrée.';
  }

  const bucket = {};
  SCHEDULE_SLOT_KEYS.forEach((slot) => {
    bucket[slot] = [];
  });
  SCHEDULE_STATUS_KEYS.forEach((status) => {
    bucket[status] = [];
  });

  Object.values(message.reservations ?? {}).forEach((entry) => {
    const label = entry.displayName ?? entry.userTag;
    if (bucket[entry.slot]) {
      bucket[entry.slot].push(label);
    }
  });

  const lines = [];
  SCHEDULE_SLOT_KEYS.forEach((slot) => {
    const values = bucket[slot];
    lines.push(`**${slot}**: ${values.length ? values.join(', ') : '—'}`);
  });

  SCHEDULE_STATUS_KEYS.forEach((status) => {
    const values = bucket[status];
    lines.push(`**${status}**: ${values.length ? values.join(', ') : '—'}`);
  });

  return lines.join('\n').trim();
}
