import { readFile, writeFile } from 'fs/promises';
import { dirname } from 'path';
import { mkdir } from 'fs/promises';

const defaultState = {
  menus: {
    Kantine: [],
    Amerikain: [],
    Italien: []
  },
  messages: {},
  settings: {
    defaultChannelId: '',
    lastTitle: 'Menus de la semaine'
  }
};

async function ensureDir(filePath) {
  const dir = dirname(filePath);
  await mkdir(dir, { recursive: true });
}

export default class Storage {
  constructor(filePath) {
    this.filePath = filePath;
    this.state = null;
    this.writeQueue = Promise.resolve();
  }

  async init() {
    if (this.state) {
      return this.state;
    }

    await ensureDir(this.filePath);
    try {
      const raw = await readFile(this.filePath, 'utf8');
      this.state = JSON.parse(raw);
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.state = structuredClone(defaultState);
        await this.persist();
      } else {
        throw error;
      }
    }

    return this.state;
  }

  getState() {
    if (!this.state) {
      throw new Error('Storage not initialized');
    }

    return this.state;
  }

  async update(mutator) {
    await this.init();
    const draft = structuredClone(this.state);
    const result = mutator(draft);
    this.state = draft;
    await this.persist();
    return result ?? this.state;
  }

  async persist() {
    const payload = JSON.stringify(this.state, null, 2);
    this.writeQueue = this.writeQueue.then(() => writeFile(this.filePath, payload));
    return this.writeQueue;
  }
}

function structuredClone(value) {
  return JSON.parse(JSON.stringify(value));
}
