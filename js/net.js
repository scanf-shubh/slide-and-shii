// Online Multiplayer Manager: Supports WebSocket (server.js) AND Serverless WebRTC Rooms (PeerJS)
(function (global) {
  const VOX = (global.VOX = global.VOX || {});

  function genCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = '';
    for (let i = 0; i < 5; i++) s += chars[(Math.random() * chars.length) | 0];
    return s;
  }

  function loadPeerJS() {
    if (global.Peer) return Promise.resolve(global.Peer);
    const urls = [
      'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js',
      'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js',
    ];
    return new Promise((resolve, reject) => {
      let idx = 0;
      function tryNext() {
        if (idx >= urls.length) {
          reject(new Error('Could not load PeerJS signaling library (check internet connection or use LAN server.js).'));
          return;
        }
        const sc = document.createElement('script');
        sc.src = urls[idx++];
        sc.async = true;
        const timer = setTimeout(() => {
          sc.remove();
          tryNext();
        }, 6000);
        sc.onload = () => {
          clearTimeout(timer);
          if (global.Peer) resolve(global.Peer);
          else tryNext();
        };
        sc.onerror = () => {
          clearTimeout(timer);
          sc.remove();
          tryNext();
        };
        document.head.appendChild(sc);
      }
      tryNext();
    });
  }

  class NetManager {
    constructor() {
      this.mode = 'offline'; // 'offline' | 'ws' | 'peer-host' | 'peer-client'
      this.myId = 'local';
      this.roomCode = '';
      this.isHost = false;
      this.ws = null;
      this.peer = null;
      this.hostConn = null;
      this.clients = new Map(); // peerId -> { conn, id, name, skin, kills, deaths }
      this.handlers = {};
      this.pingMs = 0;
      this.pingTimer = null;
      this.hasServer = false;
    }

    on(ev, fn) {
      this.handlers[ev] = fn;
    }

    emit(ev, data) {
      if (this.handlers[ev]) this.handlers[ev](data);
    }

    async detectServer() {
      if (location.protocol === 'file:') {
        this.hasServer = false;
        return false;
      }
      try {
        const res = await fetch('/api/health', { cache: 'no-store' });
        if (res.ok) {
          const j = await res.json();
          this.hasServer = !!j.ok;
          return this.hasServer;
        }
      } catch (e) {}
      this.hasServer = false;
      return false;
    }

    disconnect() {
      if (this.pingTimer) {
        clearInterval(this.pingTimer);
        this.pingTimer = null;
      }
      if (this.ws) {
        try { this.ws.close(); } catch (e) {}
        this.ws = null;
      }
      if (this.hostConn) {
        try { this.hostConn.close(); } catch (e) {}
        this.hostConn = null;
      }
      this.clients.forEach((c) => {
        try { c.conn.close(); } catch (e) {}
      });
      this.clients.clear();
      if (this.peer) {
        try { this.peer.destroy(); } catch (e) {}
        this.peer = null;
      }
      this.mode = 'offline';
      this.isHost = false;
      this.roomCode = '';
      this.myId = 'local';
      this.pingMs = 0;
    }

    // ---------- 1) WebSocket Server Mode ----------
    connectWS(wsUrl, roomCode, playerInfo) {
      this.disconnect();
      return new Promise((resolve, reject) => {
        const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
        const url = wsUrl || `${proto}//${location.host}`;
        const ws = new WebSocket(url);
        this.ws = ws;
        this.mode = 'ws';
        this.roomCode = roomCode || 'MAIN';

        const timeout = setTimeout(() => {
          reject(new Error('WebSocket connection timed out.'));
          this.disconnect();
        }, 6000);

        ws.onopen = () => {
          clearTimeout(timeout);
          ws.send(JSON.stringify({
            type: 'join_room',
            room: this.roomCode,
            name: playerInfo.name,
            skin: playerInfo.skin,
            arenaId: playerInfo.arenaId,
          }));
          this.pingTimer = setInterval(() => {
            if (ws.readyState === 1) {
              ws.send(JSON.stringify({ type: 'ping', t: performance.now() }));
            }
          }, 2500);
        };

        ws.onmessage = (ev) => {
          let msg;
          try { msg = JSON.parse(ev.data); } catch (e) { return; }
          if (msg.type === 'welcome') {
            this.myId = msg.id;
            this.isHost = !!msg.isHost;
            this.roomCode = msg.room;
            resolve(msg);
          }
          if (msg.type === 'room_full') {
            clearTimeout(timeout);
            reject(new Error('That room is full (max 4 players).'));
            this.disconnect();
            return;
          }
          if (msg.type === 'pong') {
            this.pingMs = Math.round(performance.now() - msg.t);
            return;
          }
          this.emit('msg', msg);
        };

        ws.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('Could not connect to game server.'));
        };

        ws.onclose = () => {
          if (this.mode === 'ws') {
            this.emit('disconnect', 'Disconnected from server.');
            this.disconnect();
          }
        };
      });
    }

    // ---------- 2) Serverless PeerJS WebRTC Mode ----------
    async hostPeer(playerInfo, customCode) {
      this.disconnect();
      const Peer = await loadPeerJS();
      const code = (customCode || genCode()).toUpperCase().replace(/[^A-Z0-9]/g, '');
      const peerId = 'voxarena-' + code;

      return new Promise((resolve, reject) => {
        const peer = new Peer(peerId, {
          debug: 0,
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' },
            ],
          },
        });
        this.peer = peer;
        this.mode = 'peer-host';
        this.isHost = true;
        this.roomCode = code;
        this.myId = 'host';

        const timeout = setTimeout(() => {
          reject(new Error('Could not reach PeerJS room server. Try again or use LAN server.js.'));
          this.disconnect();
        }, 9000);

        peer.on('open', () => {
          clearTimeout(timeout);
          resolve({ room: code, id: 'host', isHost: true });
        });

        peer.on('connection', (conn) => {
          const cid = 'p_' + Math.random().toString(36).slice(2, 8);
          const clientRec = { conn, id: cid, name: 'Friend', skin: 'steve', kills: 0, deaths: 0 };
          this.clients.set(cid, clientRec);

          conn.on('data', (raw) => {
            let msg;
            try { msg = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (e) { return; }
            if (!msg || !msg.type) return;

            if (msg.type === 'ping') {
              conn.send({ type: 'pong', t: msg.t });
              return;
            }
            if (msg.type === 'join') {
              clientRec.name = String(msg.name || 'Friend').slice(0, 16);
              clientRec.skin = msg.skin || 'steve';
              clientRec.color = msg.color || '#ffd23f';
              // Notify host game to build welcome snapshot & broadcast roster
              this.emit('peer_join', { client: clientRec, conn });
              return;
            }

            // Stamp sender ID
            msg.id = cid;
            // Relay to all other guests
            this.broadcastPeer(msg, cid);
            // Deliver to host itself
            this.emit('msg', msg);
          });

          conn.on('close', () => {
            this.clients.delete(cid);
            this.broadcastPeer({ type: 'player_left', id: cid });
            this.emit('msg', { type: 'player_left', id: cid });
          });
        });

        peer.on('error', (err) => {
          clearTimeout(timeout);
          if (err && err.type === 'unavailable-id') {
            reject(new Error('Room code already in use, retrying...'));
          } else {
            reject(new Error(err?.message || 'PeerJS host error'));
          }
        });
      });
    }

    async joinPeer(roomCode, playerInfo) {
      this.disconnect();
      const Peer = await loadPeerJS();
      const code = String(roomCode || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (!code) throw new Error('Enter a valid Room Code.');

      return new Promise((resolve, reject) => {
        let settled = false;
        const fail = (err) => {
          if (settled) return;
          settled = true;
          reject(err);
          this.disconnect();
        };
        const peer = new Peer(undefined, {
          debug: 0,
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' },
            ],
          },
        });
        this.peer = peer;
        this.mode = 'peer-client';
        this.isHost = false;
        this.roomCode = code;

        const timeout = setTimeout(() => {
          fail(new Error('Timed out joining room ' + code + '. Check the code and ask host to keep their tab open.'));
        }, 10000);

        peer.on('open', () => {
          const conn = peer.connect('voxarena-' + code, { reliable: true });
          this.hostConn = conn;

          conn.on('open', () => {
            conn.send({ type: 'join', name: playerInfo.name, skin: playerInfo.skin, color: playerInfo.color });
            this.pingTimer = setInterval(() => {
              if (conn.open) conn.send({ type: 'ping', t: performance.now() });
            }, 2500);
          });

          conn.on('data', (raw) => {
            let msg;
            try { msg = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (e) { return; }
            if (!msg || !msg.type) return;
            if (msg.type === 'pong') {
              this.pingMs = Math.round(performance.now() - msg.t);
              return;
            }
            if (msg.type === 'welcome') {
              clearTimeout(timeout);
              this.myId = msg.id;
              settled = true;
              resolve(msg);
            }
            if (msg.type === 'room_full' || msg.type === 'room_closed') {
              clearTimeout(timeout);
              fail(new Error(msg.type === 'room_full' ? 'That room is full (max 4 players).' : 'That room is not accepting players right now.'));
              return;
            }
            this.emit('msg', msg);
          });

          conn.on('close', () => {
            clearTimeout(timeout);
            if (this.mode === 'peer-client') {
              if (!settled) fail(new Error('Host closed the room before joining.'));
              else {
                this.emit('disconnect', 'Host closed the room.');
                this.disconnect();
              }
            }
          });

          conn.on('error', (err) => {
            clearTimeout(timeout);
            fail(new Error(err?.message || 'Connection to host failed.'));
          });
        });

        peer.on('error', (err) => {
          clearTimeout(timeout);
          fail(new Error(err?.message || 'Could not find room ' + code));
        });
      });
    }

    broadcastPeer(msg, excludeId) {
      this.clients.forEach((c, cid) => {
        if (cid !== excludeId && c.conn && c.conn.open) {
          c.conn.send(msg);
        }
      });
    }

    sendToClient(cid, msg) {
      const c = this.clients.get(cid);
      if (c && c.conn && c.conn.open) {
        c.conn.send(msg);
      }
    }

    sendTo(id, msg) {
      if (this.mode === 'ws') {
        if (this.ws && this.ws.readyState === 1) {
          this.ws.send(JSON.stringify(Object.assign({}, msg, { to: id })));
        }
      } else if (this.mode === 'peer-host') {
        this.sendToClient(id, msg);
      }
    }

    isConnected() {
      return this.mode !== 'offline';
    }

    send(msg) {
      if (this.mode === 'offline') return;
      if (this.mode === 'ws') {
        if (this.ws && this.ws.readyState === 1) {
          this.ws.send(JSON.stringify(msg));
        }
      } else if (this.mode === 'peer-host') {
        msg.id = this.myId;
        this.broadcastPeer(msg);
      } else if (this.mode === 'peer-client') {
        if (this.hostConn && this.hostConn.open) {
          msg.id = this.myId;
          this.hostConn.send(msg);
        }
      }
    }
  }

  VOX.Net = new NetManager();
})(window);
