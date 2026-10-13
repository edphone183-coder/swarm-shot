// Swarm Shot game server: serves the game and relays multiplayer over WebSockets.
// Same model as claude.ai live rooms (named rooms, one presence object per player per room), so the game code
// is identical either way. Anyone who opens this server's address can play together - no accounts needed.
//   node relay.js                 (port from $PORT, default 8787; serves ./public, or this folder)
//   node relay.js 8787 /some/dir  (port and folder to serve)
// Players just open http(s)://your-server/ . For testing: ?mp=ws://host:port/ws&name=Alice&lag=120
const http = require('http'), crypto = require('crypto'), fs = require('fs'), path = require('path'), url = require('url');
const PORT = +process.argv[2] || +process.env.PORT || 8787;
const ROOT = path.resolve(process.argv[3] || (fs.existsSync(path.join(__dirname, 'public')) ? path.join(__dirname, 'public') : process.cwd()));
const MAX_PRESENCE = 4096, RATE = 70, BURST = 140, MAX_CLIENTS = +process.env.MAX_CLIENTS || 400, MAX_FRAME = 64*1024;
const rooms = new Map();          // room name -> Map(peer -> client)
let clients = 0, nextPeer = 1;
const TYPES = {'.html':'text/html; charset=utf-8', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.svg':'image/svg+xml', '.ico':'image/x-icon'};
const server = http.createServer((req, res) => {
  const u = url.parse(req.url); let p = decodeURIComponent(u.pathname || '/');
  if (p === '/health'){ res.writeHead(200, {'content-type':'text/plain'}); return res.end('ok ' + clients); }
  if (p === '/') p = fs.existsSync(path.join(ROOT, 'index.html')) ? '/index.html' : '/test.html';
  const f = path.join(ROOT, path.normalize(p).replace(/^(\.\.[\/\\])+/, ''));
  if (!f.startsWith(ROOT)){ res.writeHead(403); return res.end(); }
  fs.readFile(f, (err, d) => { if (err){ res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, {'content-type':TYPES[path.extname(f)] || 'application/octet-stream', 'cache-control':'no-cache'}); res.end(d); });
});
function frame(str, op=0x1){ const b = Buffer.from(str), n = b.length; let h;
  if (n < 126) h = Buffer.from([0x80 | op, n]); else if (n < 65536){ h = Buffer.alloc(4); h[0] = 0x80 | op; h[1] = 126; h.writeUInt16BE(n, 2); } else { h = Buffer.alloc(10); h[0] = 0x80 | op; h[1] = 127; h.writeBigUInt64BE(BigInt(n), 2); }
  return Buffer.concat([h, b]); }
const clean = (s, re, n) => String(s || '').replace(re, '').slice(0, n);
server.on('upgrade', (req, sock) => {
  const q = url.parse(req.url, true).query, key = req.headers['sec-websocket-key'];
  if (!key || clients >= MAX_CLIENTS){ sock.destroy(); return; }
  const acc = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + acc + '\r\n\r\n');
  sock.setNoDelay(true); clients++;
  const name = clean(q.name, /[^\w \-]/g, 20) || 'Player', dev = clean(String(q.id || '').toLowerCase(), /[^a-z0-9]/g, 24);
  // the player id: from the browser's own random device id (so two "Player"s never collide), else from the name
  const C = {sock, peer:'k' + (nextPeer++).toString(36) + crypto.randomBytes(3).toString('hex'), by:'u-' + (dev.length >= 8 ? dev : name.toLowerCase().replace(/\s+/g, '-') + '-' + crypto.randomBytes(3).toString('hex')),
    name, lag:Math.min(2000, +q.lag || 0), jit:Math.min(1000, +q.jit || 0), lastAt:0, rooms:new Map(), tok:BURST, t:Date.now(), buf:Buffer.alloc(0), alive:true, pong:Date.now()};
  const raw = s => { if (C.alive) try { sock.write(s); } catch(e){} };
  // test options: ?lag= adds a fixed delay, ?jit= adds random extra delay (order is kept, like a real network)
  C.send = o => { const s = frame(JSON.stringify(o)); if (C.lag || C.jit){ const at = Math.max(C.lastAt, Date.now() + C.lag + Math.random()*C.jit); C.lastAt = at; setTimeout(() => raw(s), at - Date.now()); } else raw(s); };
  const view = (c, rn) => ({peer:c.peer, by:c.by, presence:c.rooms.get(rn) || {}});
  // changes go out as small updates; a newcomer gets the whole room once
  const tell = (rn, msg, except) => { const r = rooms.get(rn); if (r) for (const c of r.values()) if (c !== except) c.send(msg); };
  const leave = rn => { const r = rooms.get(rn); if (r){ r.delete(C.peer); if (!r.size) rooms.delete(rn); else tell(rn, {op:'left', room:rn, peer:C.peer}); } C.rooms.delete(rn); };
  const onMsg = txt => {
    const now = Date.now(); C.tok = Math.min(BURST, C.tok + (now - C.t)/1000*RATE); C.t = now; if (C.tok < 1) return; C.tok--;     // rate limit, like the platform
    let m; try { m = JSON.parse(txt); } catch(e){ return; } if (!m || typeof m !== 'object') return;
    const work = () => { if (!C.alive) return;
      if (m.op === 'hello') C.send({op:'welcome', id:C.by, name:C.name, peer:C.peer, now:Date.now()});
      else if (m.op === 'join' && typeof m.room === 'string' && /^[a-z0-9][a-z0-9_.-]{0,47}$/.test(m.room) && (C.rooms.has(m.room) || C.rooms.size < 17)){
        if (!rooms.has(m.room)) rooms.set(m.room, new Map()); const r = rooms.get(m.room); if (!C.rooms.has(m.room)) C.rooms.set(m.room, {});
        r.set(C.peer, C); C.send({op:'peers', room:m.room, you:C.peer, peers:[...r.values()].map(c => view(c, m.room))}); tell(m.room, {op:'upd', room:m.room, ...view(C, m.room)}, C); }
      else if (m.op === 'leave' && C.rooms.has(m.room)) leave(m.room);
      else if (m.op === 'presence' && C.rooms.has(m.room) && m.patch && typeof m.patch === 'object' && !Array.isArray(m.patch)){
        const cur = Object.assign({}, C.rooms.get(m.room)); for (const k in m.patch){ if (m.patch[k] === null) delete cur[k]; else cur[k] = m.patch[k]; }
        if (Buffer.byteLength(JSON.stringify(cur)) > MAX_PRESENCE) return; C.rooms.set(m.room, cur); tell(m.room, {op:'upd', room:m.room, ...view(C, m.room)}); }
    };
    if (C.lag) setTimeout(work, C.lag); else work();
  };
  sock.on('data', d => { C.buf = Buffer.concat([C.buf, d]); if (C.buf.length > MAX_FRAME*2){ sock.destroy(); return; }
    while (C.buf.length >= 2){ const b0 = C.buf[0], b1 = C.buf[1], op = b0 & 0x0f, masked = b1 & 0x80; let len = b1 & 0x7f, off = 2;
      if (len === 126){ if (C.buf.length < 4) return; len = C.buf.readUInt16BE(2); off = 4; } else if (len === 127){ if (C.buf.length < 10) return; len = Number(C.buf.readBigUInt64BE(2)); off = 10; }
      if (len > MAX_FRAME){ sock.destroy(); return; }
      const mk = masked ? C.buf.slice(off, off + 4) : null; if (masked) off += 4; if (C.buf.length < off + len) return;
      let pl = C.buf.slice(off, off + len); if (mk){ pl = Buffer.from(pl); for (let i=0;i<pl.length;i++) pl[i] ^= mk[i & 3]; } C.buf = C.buf.slice(off + len);
      if (op === 0x8){ raw(Buffer.from([0x88, 0])); sock.end(); return; }
      if (op === 0x9){ raw(frame(pl.toString('binary'), 0xA)); continue; }
      if (op === 0xA){ C.pong = Date.now(); continue; }
      if (op === 0x1) onMsg(pl.toString()); } });
  const bye = () => { if (!C.alive) return; C.alive = false; clients--; clearInterval(C.ping); for (const rn of [...C.rooms.keys()]) leave(rn); };
  // keep-alive: proxies drop idle sockets; a dead connection is noticed within a minute
  C.ping = setInterval(() => { if (Date.now() - C.pong > 60000){ sock.destroy(); return; } raw(Buffer.from([0x89, 0])); }, 25000);
  sock.on('close', bye); sock.on('error', bye); sock.on('end', bye);
});
server.listen(PORT, () => console.log('Swarm Shot server on port', PORT, 'serving', ROOT));
