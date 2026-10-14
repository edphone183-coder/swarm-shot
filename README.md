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

## Developer tools

- **Network diagnostics:** press **F8** in the game, or open it with `?netdbg=1`. The overlay shows:
  - ping;
  - updates per second in and out;
  - lost or merged updates;
  - the interpolation delay;
  - extrapolation and corrections;
  - frame rate;
  - simulation time.
- **World boss test schedule:** add `?wbtest=1` to the address. A portal then opens every 4 minutes and stays open for 2.5 minutes. Without it, portals open on every UTC half hour and stay open for 10 minutes. The server sends its clock to the game, so every player sees the same event.

## Creator panel (for you only)

A developer panel for testing everything without grinding: temporary unlocks of every item, stat and level overrides, region teleports, boss and attack triggers, and debug overlays. Everything in it is temporary and is undone by **End Test Session**.

**Turning it on, on this server:**

1. On Render, open the service's **Environment** settings.
2. Add a variable named `ADMINS` with the value `yourname:a-long-random-key`.
   - The key must be at least 16 characters. Treat it like a password.
   - For several creators, separate them with commas: `ed:key-one-…,sam:key-two-…`.
3. Save. Render restarts the server.
4. In the game, press **F2**, or add `#admin` to the address on a phone. Sign in with that name and key.

After you sign in, an **ADMIN** button appears on the right edge of the screen, on desktop and on mobile.

**How access is checked:**

- The allowlist and keys live only in the server's environment. They are not in the game's code, and nothing in browser storage counts.
- Signing in gives you a signed token. The server checks it before every admin action, and logs each action in the Render logs (keys and tokens are never logged).
- Removing your name from `ADMINS`, or changing your key, ends your access at your next action.
- Five wrong sign-ins from one address lock that address out for 15 minutes.
- With `ADMINS` unset, the panel doesn't exist on the server at all.

**On claude.ai**, there's nothing to set up. The panel opens only for the artifact's owner, and claude.ai confirms that before every action.

**What test mode does to your save:**

- Your real save is frozen while you test. The game runs on a working copy, so grants, boosts, level overrides and test coins never reach the real save.
- Items that drop for you during normal play are written into your real save too, so they stay yours.
- Coins, XP and materials you earn while testing are test-only, and are dropped at the end.
- Duos is switched off while testing, so nothing temporary enters another player's game.
- Test world-boss events and test bosses run only on your device. They never claim a reward or roll loot.

## Sound library

`sounds/` holds WAV exports of the Secret weapon sounds (celestial_*, tyrant_*). The game synthesises the same sounds in code at runtime, so these files are for reference and editing; the game does not load them.
