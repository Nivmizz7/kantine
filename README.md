## Kantine bot + panel

Bot Discord inspiré de Raid-Helper avec panneau web pour gérer trois menus (Kantine, Amerikain, Italien) et envoyer un message interactif dans le salon de votre choix. Les collègues réservent leur créneau (11h‑12h, 12h‑13h) et leur restaurant via des boutons + menus déroulants, ou se déclarent Absence / Bench.

### Prérequis

- Node.js 18+
- npm
- Un compte Discord avec accès administrateur sur le serveur cible
- (Optionnel) un compte GitHub pour versionner/déployer

### 1. Préparer le dépôt GitHub

1. Initialisez le repo local (déjà fait ici).  
2. Créez un dépôt vide sur GitHub.  
3. Ajoutez-le comme remote : `git remote add origin git@github.com:VOTRE_COMPTE/kantine.git`.  
4. Poussez le code : `git push -u origin main`.  
5. Toute nouvelle modification pourra être versionnée avec `git add`, `git commit`, `git push`.

### 2. Créer et configurer l’application Discord

1. Rendez-vous sur [Discord Developer Portal](https://discord.com/developers/applications) → **New Application**.  
2. Dans l’onglet **Bot**, créez un bot et copiez le **Token** (mettez-le dans `.env`).  
3. Activez les intents **SERVER MEMBERS INTENT** et **MESSAGE CONTENT INTENT** (le bot lit les interactions).  
4. Dans **OAuth2 → URL Generator**, cochez `bot` + `applications.commands`, puis les permissions `Send Messages`, `Embed Links`, `Read Message History`, `Use Slash Commands`.  
5. Utilisez l’URL générée pour inviter le bot sur votre serveur.

### 3. Configurer le projet local

```bash
cp .env.example .env              # renseignez le token Discord + port éventuel
npm install                       # installe les dépendances
npm run dev                       # démarre en mode développement
# ou npm start pour lancer en production simple
```

Le panel est accessible sur `http://localhost:3000/kantine`. Pour l’exposer sur votre réseau 192.168.1.x, lancez le serveur sur la machine cible et utilisez son IP locale : `http://192.168.1.N:3000/kantine`. Ajoutez ensuite une entrée DNS locale ou un reverse-proxy (Nginx/Traefik) si vous souhaitez exactement `http://192.168.1.x/kantine`.

### 4. Utilisation du panel

1. **Menus** : remplissez chaque textarea (un plat par ligne) puis cliquez sur “Sauvegarder les menus”.  
2. **Envoi Discord** : renseignez l’ID du salon (clic droit sur le canal dans Discord → “Copier l’identifiant”) et, si besoin, un titre personnalisé. Cliquez sur “Envoyer le message”.  
3. Le bot poste un embed avec les trois menus en haut, puis un tableau dynamique de réservations. Les boutons sous le message permettent :
   - 11h‑12h ou 12h‑13h → ouvre un select pour choisir Kantine/Amerikain/Italien.
   - Absence / Bench → bascule directement le statut.
4. Chaque interaction met à jour l’embed automatiquement.

### 5. Structure technique

- `src/index.js` : démarre Express + Discord bot.
- `src/discordBot.js` : logique d’intégration (embed, boutons, réservations).
- `src/state.js` & `src/storage.js` : persistance JSON (`data/state.json`).
- `public/` : mini interface HTML/JS/CSS servie sur `/kantine`.

### 6. Déploiement / production

- Pour un service permanent, utilisez `pm2`, `systemd` ou Docker autour de `npm start`.
- Sauvegardez régulièrement `data/state.json` si vous souhaitez garder l’historique des réservations/messages.
- Pour sécuriser le panel sur un réseau plus large, placez-le derrière un reverse proxy avec authentification (basic auth, SSO, etc.) ou restreignez l’accès via firewall/VPN.

### 7. Notes supplémentaires

- Toute mise à jour des menus via le panel ne modifie pas automatiquement les anciens messages. Envoyez un nouveau message après chaque changement important.
- Si vous souhaitez historiser plusieurs semaines, conservez les IDs des messages envoyés via panel (ils restent stockés dans `data/state.json`).
- Pour étendre la solution (multi-serveur, base de données, hébergement cloud), versionnez les modifications et déployez via GitHub Actions ou votre pipeline préféré.
