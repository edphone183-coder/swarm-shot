# Swarm Shot: your own game server

This folder is the whole game plus its online server. Anyone who opens your server's address in a browser can play together: shared world, friends, parties, chat and Duos dungeons. Nobody needs a claude.ai account.

The server:

- serves the game from `public/index.html`;
- runs the multiplayer connection at `/ws`.

The game connects to it on its own, with no settings to change. The first time someone plays online, the game asks them for a player name.

You need **Node.js 18 or newer** (download it from nodejs.org). The server uses no other packages.

## Option A: play tonight from your own computer (free, about 5 minutes)

1. Open a terminal in this folder and run:

   ```
   node server.js
   ```

   It prints `Swarm Shot server on port 8787`. Open `http://localhost:8787` to check that the game loads.

2. Give it a public address. One easy, free way is a Cloudflare quick tunnel:
   1. Install `cloudflared` from Cloudflare's website.
   2. In a second terminal, run:

      ```
      cloudflared tunnel --url http://localhost:8787
      ```

   It prints an address like `https://something-random.trycloudflare.com`.

3. Send that address to your friend. You both open it, enter the world, and you'll see each other.

The address only works while your computer is on and both terminals are running. You get a new address each time you start the tunnel.

## Option B: always online (a free or cheap host)

Any Node.js host works. The example below uses Render, but Railway, Fly.io or a small VPS work the same way.

1. Put this folder in a GitHub repository. `server.js`, `package.json` and the `public` folder must sit at the top level.
2. On Render, create a **Web Service** from that repository:
   - Build command: none.
   - Start command: `node server.js`.
3. Render gives you an `https://….onrender.com` address. That address is your game's share link.

Free plans on most hosts go to sleep when nobody is playing. The first visit after a quiet spell can then take up to a minute to load. Check your host's current plan details.

## Updating the game

Replace `public/index.html` with the newest `swarm-shot.html` and restart, or redeploy.

## Good to know

- **Saves stay in each player's browser.** That covers progress, coins, friends and blocks, just like on claude.ai. The server keeps nothing.
- **Names are self-chosen.** There are no accounts on your own server. If two people pick the same name they can't be told apart by name, but the game still tells them apart internally.
- **Built-in protections are basic:** rate limits, size limits, a cap on connected players (400, set with `MAX_CLIENTS`), private messages encrypted between the two players, and the server dropping connections that go quiet.
- **Cheating isn't fully prevented.** A determined player could still change their own game or save.
- **Health check:** `/health` shows how many players are connected.
- **Ports:** the server uses the `PORT` your host sets. To pick one yourself, run `node server.js 9000`.
