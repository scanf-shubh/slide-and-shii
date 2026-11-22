const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8080;
const ROOT = __dirname;
const MAX_PLAYERS = 4;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.map': 'application/json; charset=utf-8',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, rooms: rooms.size }));
    return;
  }
  let file = decodeURIComponent(url.pathname);
  if (file === '/') file = '/index.html';
  const target = path.normalize(path.join(ROOT, file));
  if (!target.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  fs.readFile(target, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    const ext = path.extname(target).toLowerCase();
    const noStore = ext === '.html' || ext === '.js' || ext === '.css' || ext === '.json';
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': noStore ? 'no-store' : 'public, max-age=3600',
    });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server });
const rooms = new Map();
let nextId = 1;

function code() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 5; i++) s += chars[(Math.random() * chars.length) | 0];
  return s;
}

function send(ws, msg) {
  if (ws && ws.readyState === 1) {
    try {
      ws.send(JSON.stringify(msg));
    } catch (e) {}
  }
}

function broadcast(room, msg, exceptId) {
  room.clients.forEach((client, id) => {
    if (id !== exceptId) send(client.ws, msg);
  });
}

wss.on('connection', (ws) => {
  const id = 's_' + nextId++;
  ws.meta = { id: id, room: null };

  send(ws, { type: 'hello', id: id });

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch (e) {
      return;
    }
    if (!msg || !msg.type) return;

    if (msg.type === 'join_room') {
      const rc = String(msg.room || 'MAIN').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'MAIN';
      let room = rooms.get(rc);
      if (!room) {
        room = { code: rc, clients: new Map(), hostId: null };
        rooms.set(rc, room);
      }
      if (room.clients.size >= MAX_PLAYERS) {
        send(ws, { type: 'room_full', room: rc });
        return;
      }
      const isHost = room.clients.size === 0;
      if (isHost) room.hostId = id;
      room.clients.set(id, { ws: ws, name: String(msg.name || 'Player').slice(0, 16), skin: msg.skin || 'steve' });
      ws.meta.room = rc;
      send(ws, { type: 'welcome', id: id, isHost: isHost, room: rc });
      broadcast(room, { type: 'player_joined', id: id }, id);
      return;
    }

    if (msg.type === 'ping') {
      send(ws, { type: 'pong', t: msg.t });
      return;
    }

    const room = rooms.get(ws.meta.room);
    if (!room) return;
    msg.id = id;
    msg.from = id;
    msg.host = room.hostId === id;
    if (msg.to) {
      const target = room.clients.get(msg.to);
      if (target) send(target.ws, msg);
    } else {
      broadcast(room, msg, id);
    }
  });

  ws.on('close', () => {
    const rc = ws.meta.room;
    if (!rc) return;
    const room = rooms.get(rc);
    if (!room) return;
    room.clients.delete(id);
    broadcast(room, { type: 'player_left', id: id });
    if (room.hostId === id) {
      const first = room.clients.keys().next();
      if (first.done) {
        rooms.delete(rc);
      } else {
        room.hostId = first.value;
        broadcast(room, { type: 'host_changed', id: room.hostId });
      }
    }
    if (room.clients.size === 0) rooms.delete(rc);
  });
});

server.listen(PORT, () => {
  console.log('VOX Parkour server running:');
  console.log('  http://localhost:' + PORT);
  console.log('  WebSocket + static hosting on the same port');
});
