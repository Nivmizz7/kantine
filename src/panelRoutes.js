import express from 'express';
import { getMenus, getSettings, updateMenus } from './state.js';

export function createPanelRouter(bot) {
  const router = express.Router();

  router.get('/state', (req, res) => {
    res.json({
      menus: getMenus(),
      settings: getSettings()
    });
  });

  router.post('/menus', async (req, res, next) => {
    try {
      const menusPayload = req.body?.menus ?? req.body;
      const menus = await updateMenus(menusPayload);
      res.json({ menus });
    } catch (error) {
      next(error);
    }
  });

  router.post('/send', async (req, res, next) => {
    try {
      const { channelId, title } = req.body ?? {};
      if (!channelId) {
        res.status(400).json({ error: 'channelId requis' });
        return;
      }

      const settings = getSettings();
      const finalTitle = title?.trim() || settings.lastTitle || 'Menus de la semaine';
      const message = await bot.sendKantineMessage(channelId, finalTitle);

      res.json({
        messageId: message.id,
        channelId: message.channelId
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
