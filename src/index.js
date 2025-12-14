import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { KantineBot } from './discordBot.js';
import { createPanelRouter } from './panelRoutes.js';
import { initState } from './state.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, '../public');

async function bootstrap() {
  await initState();

  const bot = new KantineBot();
  await bot.login(process.env.DISCORD_TOKEN);

  const app = express();
  app.use(express.json());

  app.use('/kantine/api', createPanelRouter(bot));
  app.use('/kantine', express.static(publicDir));
  app.get('/kantine/*', (req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });

  app.use((err, req, res, next) => {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ error: err.message || 'Erreur inconnue' });
  });

  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Panel disponible sur http://localhost:${port}/kantine`);
  });
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Erreur au démarrage', error);
  process.exit(1);
});
