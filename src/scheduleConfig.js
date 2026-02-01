import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configPath = path.resolve(__dirname, '../data/schedule.json');

const defaultConfig = {
  matin: ['8h15', '9h10'],
  apresmidi: ['13h30', '14h15']
};

let cachedConfig = null;

function normalizeList(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => String(item).trim())
    .filter((item) => item.length > 0);
}

function sanitizeConfig(raw) {
  const matin = normalizeList(raw?.matin ?? raw?.morning);
  const apresmidi = normalizeList(raw?.apresmidi ?? raw?.afternoon ?? raw?.apresMidi);

  return {
    matin: matin.length ? matin : defaultConfig.matin,
    apresmidi: apresmidi.length ? apresmidi : defaultConfig.apresmidi
  };
}

export async function getScheduleConfig() {
  if (cachedConfig) {
    return cachedConfig;
  }

  try {
    const raw = await readFile(configPath, 'utf8');
    const parsed = JSON.parse(raw);
    cachedConfig = sanitizeConfig(parsed);
  } catch (error) {
    if (error.code === 'ENOENT') {
      cachedConfig = defaultConfig;
      await mkdir(path.dirname(configPath), { recursive: true });
      const payload = JSON.stringify(defaultConfig, null, 2);
      await writeFile(configPath, payload);
    } else {
      throw error;
    }
  }

  return cachedConfig;
}

export function getScheduleConfigPath() {
  return configPath;
}
