# Kantine Bot + Admin Panel

Discord bot inspired by Raid-Helper, with a lightweight web admin panel to manage three lunch menus (Kantine, American, Italian) and post an interactive message in a chosen Discord channel.

Team members can reserve their time slot (11:00–12:00, 12:00–13:00) and restaurant using buttons and dropdown menus, or mark themselves as Absent / Bench.

---

## Prerequisites

- Node.js 18+
- npm
- A Discord account with administrator access to the target server
- (Optional) A GitHub account for versioning and deployment

---

## 1. Prepare the GitHub Repository

1. Initialize the local repository (already done here).
2. Create an empty repository on GitHub.
3. Add it as a remote:
   git remote add origin git@github.com:YOUR_ACCOUNT/kantine.git
4. Push the code:
   git push -u origin main
5. Any further changes can be versioned using:
   git add
   git commit
   git push

---

## 2. Create and Configure the Discord Application

1. Go to the Discord Developer Portal: https://discord.com/developers/applications → New Application.
2. In the Bot tab, create a bot and copy the Bot Token (store it in .env).
3. Enable the following privileged intents:
   - SERVER MEMBERS INTENT
   - MESSAGE CONTENT INTENT
4. In OAuth2 → URL Generator:
   - Scopes: bot, applications.commands
   - Bot permissions:
     - Send Messages
     - Embed Links
     - Read Message History
     - Use Slash Commands
5. Use the generated URL to invite the bot to your server.

---

## 3. Local Project Setup

cp .env.example .env
npm install
npm run dev

Or for production:
npm start

The admin panel is available at:
http://localhost:3000/kantine

To expose it on your local network (192.168.1.x), run the server on the target machine and use its local IP:
http://192.168.1.N:3000/kantine

You may also add a local DNS entry or use a reverse proxy (Nginx / Traefik) if you want a cleaner URL such as:
http://192.168.1.x/kantine

---

## 4. Using the Admin Panel

1. Menus
   Fill each textarea (one dish per line) and click Save menus.

2. Send to Discord
   Enter the Channel ID (right-click the channel in Discord → Copy Channel ID).
   Optionally set a custom title, then click Send message.

3. The bot posts:
   - An embed displaying the three menus
   - A dynamic reservation table

   Buttons below the message allow users to:
   - Select 11:00–12:00 or 12:00–13:00, then choose Kantine / American / Italian
   - Mark themselves as Absent / Bench

4. Every interaction automatically updates the embed.

---

## 5. Technical Structure

- src/index.js — starts Express and the Discord bot
- src/discordBot.js — Discord logic (embeds, buttons, reservations)
- src/state.js & src/storage.js — JSON persistence (data/state.json)
- public/ — lightweight HTML/JS/CSS admin UI served at /kantine

---

## 6. Deployment / Production

- For a persistent service, run the app with PM2, systemd, or Docker using npm start.
- Regularly back up data/state.json if you want to keep reservation and message history.
- To secure the admin panel on wider networks:
  - Place it behind a reverse proxy with authentication (basic auth, SSO, etc.)
  - Or restrict access via firewall or VPN.

---

## 7. Additional Notes

- Updating menus in the admin panel does not update previously sent messages. Send a new message after significant menu changes.
- To manage multiple weeks, keep the IDs of sent messages (stored in data/state.json).
- For larger setups (multi-server, database, cloud hosting), version changes and deploy using GitHub Actions or your preferred CI/CD pipeline.
