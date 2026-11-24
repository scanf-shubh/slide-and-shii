// VOX ARENA â€” unified solo, race, duel, team, bot and bridge game loop.
(function (global) {
  const VOX = (global.VOX = global.VOX || {});
  const THREE = global.THREE;
  const P = VOX.Physics;
  const C = VOX.Combat;
  const LG = VOX.LevelGen;

  const PVP_ARENAS = ['field', 'courtyard', 'sumo', 'inferno', 'frostbite', 'dunes'];
  const HOTBAR = [
    { type: 'wool_red', label: 'Wool', color: '#c8372d' },
    { type: 'planks', label: 'Plank', color: '#b98a53' },
    { type: 'stone_brick', label: 'Stone', color: '#8a8f98' },
    { type: 'glowstone', label: 'Glow', color: '#ffd76a' },
    { type: 'wool_blue', label: 'Blue', color: '#2f5fd0' },
  ];
  const TEAM_COLORS = ['#35e0e8', '#ff5b5b'];
  const TICK = 1 / 60;
  const TPS = 1 / TICK;
  const WEAPON_SLOTS = [
    { id: 'sword', label: '1 Sword', color: '#4ae8f5' },
    { id: 'spear', label: '2 Spear', color: '#d8dee6' },
    { id: 'grapple', label: '3 Hook', color: '#ffd23f' },
    { id: 'bow', label: '4 Bow', color: '#8be02a' },
  ];

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const angleTo = (a, b) => {
    let d = (b - a) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
  };
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const fmtTime = (t) => Math.max(0, t).toFixed(2) + 's';
  const clock = (t) => {
    t = Math.max(0, t);
    const m = Math.floor(t / 60), s = Math.floor(t % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  };
  const ordinal = (n) => {
    const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };
  const makeCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = '';
    for (let i = 0; i < 5; i++) s += chars[(Math.random() * chars.length) | 0];
    return s;
  };
  const load = (key, def) => {
    try {
      const v = localStorage.getItem(key);
      return v ? Object.assign({}, def, JSON.parse(v) || {}) : def;
    } catch (e) { return def; }
  };
  const store = (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {} };

  const App = {
    state: 'loading',
    profile: load('voxarena.profile', { name: 'Player' + ((Math.random() * 90 + 10) | 0), skin: 'steve', color: '#35e0e8' }),
    solo: load('voxarena.solo', { difficulty: 'standard', theme: '', arena: '' }),
    settings: load('voxarena.settings', { sens: 1, fov: 75, vol: 0.6, quality: 'high', xh: true, fovk: true, tp: false, invert: false, bob: true }),
    stats: load('voxarena.stats', { runs: 0, finishes: 0, bestTime: 0, kills: 0, deaths: 0, bestKills: 0 }),

    myId: 'local', room: null, netMode: 'offline', serverAvailable: false, ping: 0,
    mode: null, matchPlayers: [], myIndex: 0, scores: {}, raceResults: [], remotes: new Map(), bot: null, me: null,
    keys: {}, jumpPressed: false, sprintDouble: false, lastW: 0,
    mouseLeft: false, mouseRight: false, attackCD: 0, attackBuffer: 0, spearCharge: 0, spearChargeActive: false, useCD: 0, swing: 0, stepT: 0, boostCD: 0,
    selected: 0, thirdPerson: false, hadLock: false, pauseFrom: null, pauseStart: 0, inspectId: null,
    moveT: 0, acc: 0, hudAcc: 0, last: 0, lastStateSent: 0, lastSolo: null, currentSkin: 'steve',
    renderScale: 1, perfT: 0, perfN: 0,
    hitPause: 0, shake: 0, shakeT: 0, shakeDur: 0.18, impactFlash: 0, prevLocal: null,
    lookYaw: 0, lookPitch: 0, targetYaw: 0, targetPitch: 0, lookReady: false, lookIgnoreUntil: 0,
    slidePressed: false, grappleHeld: false, grappleCD: 0, grappleRope: null, swingWeapon: 'sword',
    playerHook: null, arrows: [], arrowSeq: 0,

    saveProfile() {
      store('voxarena.profile', this.profile);
      store('voxarena.solo', this.solo);
      store('voxarena.settings', this.settings);
      store('voxarena.stats', this.stats);
    },

    applySettings() {
      VOX.Audio.setVolume(this.settings.vol);
      if (this.world) this.world.setQuality(this.settings.quality);
      if (this.camera) {
        this.camera.fov = this.settings.fov;
        this.camera.updateProjectionMatrix();
      }
      this.applyResolution();
      this.saveProfile();
    },

    applyResolution() {
      if (!this.renderer) return;
      const dpr = global.devicePixelRatio || 1;
      const caps = { low: 1, medium: 1.25, high: 1.5 };
      const cap = caps[this.settings.quality] || 1.25;
      const ratio = Math.max(0.85, Math.min(dpr, cap) * (this.renderScale || 1));
      this.renderer.setPixelRatio(ratio);
    },

    trackPerf(dt) {
      if (this.state !== 'playing' && this.state !== 'countdown' && this.state !== 'finished') {
        this.perfT = 0; this.perfN = 0; return;
      }
      this.perfT += dt;
      this.perfN++;
      if (this.perfT < 1.0) return;
      const avg = this.perfT / this.perfN;
      this.perfT = 0; this.perfN = 0;
      const s = this.renderScale || 1;
      if (avg > 0.026 && s > 0.85) {
        this.renderScale = Math.max(0.85, s - 0.05);
        this.applyResolution();
      } else if (avg < 0.015 && s < 1) {
        this.renderScale = Math.min(1, s + 0.05);
        this.applyResolution();
      }
    },

    init() {
      this.saveProfile();
      this.thirdPerson = !!this.settings.tp;
      this.currentSkin = this.profile.skin;
      this.net = VOX.Net;
      this.setupRenderer();
      this.bindEvents();
      this.applySettings();
      this.world.setTheme(LG.THEMES.meadow);
      this.world.setQuality(this.settings.quality);

      this.net.on('msg', (m) => this.onNet(m));
      this.net.on('peer_join', (d) => this.onPeerJoin(d));
      this.net.on('disconnect', (why) => this.onDisconnect(why));

      VOX.UI.init(this);
      this.state = 'menu';
      this.last = performance.now();
      requestAnimationFrame((t) => this.loop(t));

      const done = () => { VOX.UI.hideLoading(); VOX.UI.showMenu(); const roomCode = this.roomCodeFromLocation(); if (roomCode) setTimeout(() => { if (this.state === 'menu') this.joinRoom(roomCode); }, 350); };
      this.net.detectServer().then((ok) => { this.serverAvailable = !!ok; done(); }).catch(done);
    },

    setupRenderer() {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
      this.renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, 1.5));
      this.renderer.setSize(global.innerWidth, global.innerHeight);
      this.renderer.autoClear = false;
      this.renderer.outputEncoding = THREE.sRGBEncoding;
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFShadowMap;
      document.body.insertBefore(this.renderer.domElement, document.getElementById('hud'));

      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(this.settings.fov, global.innerWidth / global.innerHeight, 0.05, 420);
      this.camera.rotation.order = 'YXZ';
      this.world = new VOX.World.WorldView(this.scene);
      this.initGrappleRope();
    },

    bindEvents() {
      global.addEventListener('resize', () => {
        this.camera.aspect = global.innerWidth / global.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(global.innerWidth, global.innerHeight);
      });
      document.addEventListener('keydown', (e) => this.onKey(e, true));
      document.addEventListener('keyup', (e) => this.onKey(e, false));
      this.renderer.domElement.addEventListener('wheel', (e) => this.onWheel(e), { passive: true });
      global.addEventListener('blur', () => {
        this.keys = {}; this.jumpPressed = false; this.mouseLeft = false; this.mouseRight = false;
        this.lookReady = false;
      });
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.lookReady = false;
          this.keys = {}; this.jumpPressed = false; this.mouseLeft = false; this.mouseRight = false;
        }
      });
      document.addEventListener('mousemove', (e) => this.onMouseMove(e));
      document.addEventListener('mousedown', (e) => this.onMouseDown(e));
      document.addEventListener('mouseup', (e) => this.onMouseUp(e));
      document.addEventListener('contextmenu', (e) => e.preventDefault());
      document.addEventListener('pointerlockchange', () => this.onPointerLock());
      this.renderer.domElement.addEventListener('click', () => {
        if (this.state === 'playing' || this.state === 'countdown') this.requestLock();
      });
    },

    requestLock() {
      if (document.pointerLockElement === this.renderer.domElement) return;
      try {
        const p = this.renderer.domElement.requestPointerLock();
        if (p && p.catch) p.catch(() => {});
      } catch (e) {}
    },

    onPointerLock() {
      if (document.pointerLockElement === this.renderer.domElement) {
        this.hadLock = true;
        this.lookReady = false;
        this.lookIgnoreUntil = performance.now() + 110;
        if (this.me) {
          this.targetYaw = this.lookYaw = this.me.yaw;
          this.targetPitch = this.lookPitch = this.me.pitch;
        }
        return;
      }
      this.lookReady = false;
      if (this.hadLock && (this.state === 'playing' || this.state === 'countdown')) this.showPause();
    },

    updateLook(dt) {
      if (!this.me) return;
      const k = 1 - Math.exp(-Math.max(0, dt) * 46);
      this.lookYaw += angleTo(this.lookYaw, this.targetYaw) * k;
      this.lookPitch += (this.targetPitch - this.lookPitch) * k;
      this.lookPitch = clamp(this.lookPitch, -1.55, 1.55);
      if (Math.abs(angleTo(this.lookYaw, this.targetYaw)) < 0.0002) this.lookYaw = this.targetYaw;
      this.me.yaw = this.lookYaw;
      this.me.pitch = this.lookPitch;
    },

    pickInspectTarget() {
      const candidates = [];
      const add = (e) => {
        if (!e || e.id === this.myId || e.dead || e.finished) return;
        candidates.push(e);
      };
      if (this.mode === 'race') {
        this.remotes.forEach((e) => add(e));
        if (this.bot && this.bot.id !== this.myId) add(this.bot);
      } else if (this.mode === 'bot') {
        add(this.bot);
      }
      const target = candidates[0] || null;
      this.inspectId = target ? target.id : null;
      return this.inspectId;
    },

    onWheel(e) {
      if (this.state !== 'playing' && this.state !== 'countdown') return;
      const dir = e.deltaY > 0 ? 1 : -1;
      let n = this.selected + dir;
      if (this.mode === 'bridge') {
        n = ((n % HOTBAR.length) + HOTBAR.length) % HOTBAR.length;
        if (n !== this.selected) { this.selected = n; this.updateHeldSlot(); }
        return;
      }
      n = ((n % WEAPON_SLOTS.length) + WEAPON_SLOTS.length) % WEAPON_SLOTS.length;
      if (n === this.selected) return;
      this.selected = n;
      if (this.me) {
        this.me.weapon = WEAPON_SLOTS[n].id;
        this.cancelSpearCharge();
        this.updateHeldSlot();
        this.buildHud(performance.now());
        VOX.UI.updateHUD(this);
      }
    },

    onKey(e, down) {
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      const k = e.code;
      if (down) this.keys[k] = true; else this.keys[k] = false;
      if (k === 'Space') e.preventDefault();
      if (!down) {
        if (k === 'KeyW') this.sprintDouble = false;
        if (k === 'KeyE') { this.grappleHeld = false; this.releaseGrapple(); }
        return;
      }
      if (e.repeat) return;
      if (k === 'Escape') {
        if (this.state === 'paused') this.resumeGame();
        else if (this.state === 'playing' || this.state === 'countdown') {
          if (document.pointerLockElement) document.exitPointerLock();
          else this.showPause();
        }
        return;
      }
      if (this.state === 'paused') return;
      if (this.state !== 'playing' && this.state !== 'countdown') return;

      if (k === 'Space' && this.state === 'playing') this.jumpPressed = true;
      if (k === 'KeyW') {
        const now = performance.now();
        if (now - this.lastW < 300) this.sprintDouble = true;
        this.lastW = now;
      }
      if (k === 'KeyV') {
        this.thirdPerson = !this.thirdPerson;
        this.settings.tp = this.thirdPerson;
        this.saveProfile();
      }
      if (k === 'KeyR' && this.state === 'playing') this.manualRespawn();
      if (k === 'KeyF' && this.state === 'playing') this.placeBlock();
      if (k === 'KeyG' && this.state === 'playing') this.breakBlock();
      if (k === 'KeyC' && this.state === 'playing') this.slidePressed = true;
      if (k === 'KeyE' && this.state === 'playing') {
        this.grappleHeld = true;
        this.startGrapple();
      }
      if (k === 'KeyI' && this.state === 'playing') {
        this.inspectId = this.pickInspectTarget();
      }
      if (k.indexOf('Digit') === 0) {
        const n = +k.slice(5) - 1;
        if (this.mode === 'bridge') {
          if (n >= 0 && n < HOTBAR.length) {
            this.selected = n;
            this.updateHeldSlot();
          }
        } else if (n >= 0 && n < WEAPON_SLOTS.length && this.me) {
          if (this.me.weapon !== WEAPON_SLOTS[n].id) this.cancelSpearCharge();
          this.me.weapon = WEAPON_SLOTS[n].id;
          this.updateHeldSlot();
          this.buildHud(performance.now());
          VOX.UI.updateHUD(this);
        }
      }
    },

    onMouseMove(e) {
      if (document.pointerLockElement !== this.renderer.domElement || !this.me) return;
      if (this.state !== 'playing' && this.state !== 'countdown') return;
      const now = performance.now();
      if (!this.lookReady) {
        if (now < this.lookIgnoreUntil) return;
        this.lookReady = true;
      }
      const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      let dx = 0, dy = 0;
      for (let i = 0; i < events.length; i++) {
        const mx = events[i].movementX, my = events[i].movementY;
        if (Number.isFinite(mx)) dx += mx;
        if (Number.isFinite(my)) dy += my;
      }
      if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
      if (Math.abs(dx) > 1600 || Math.abs(dy) > 1600) return;
      const s = 0.0022 * this.settings.sens;
      this.targetYaw -= clamp(dx, -140, 140) * s;
      const pitchDelta = (this.settings.invert ? dy : -dy);
      this.targetPitch = clamp(this.targetPitch + clamp(pitchDelta, -140, 140) * s, -1.55, 1.55);
    },

    onMouseDown(e) {
      if (this.state !== 'playing' && this.state !== 'countdown') return;
      if (document.pointerLockElement !== this.renderer.domElement) { this.requestLock(); return; }
      if (this.state !== 'playing' || !this.me || this.me.dead || this.me.finished) return;
      if (e.button === 0) {
        this.mouseLeft = true;
        if (this.spearChargeActive) this.cancelSpearCharge();
        if (this.mode === 'bridge') this.breakBlock();
        else if (this.me.weapon === 'grapple') this.startGrapple();
        else if (this.me.weapon === 'bow') this.requestAttack();
        else if (this.canFight()) this.requestAttack();
      } else if (e.button === 2) {
        this.mouseRight = true;
        if (this.mode === 'bridge') this.placeBlock();
        else if (this.me.weapon === 'spear' && this.canFight()) this.startSpearCharge();
      }
    },

    onMouseUp(e) {
      if (e.button === 0) this.mouseLeft = false;
      if (e.button === 2) {
        this.mouseRight = false;
        if (this.spearChargeActive) this.releaseSpearCharge();
      }
    },

    loop(now) {
      requestAnimationFrame((t) => this.loop(t));
      const dt = Math.min(0.1, Math.max(0.0001, (now - this.last) / 1000));
      this.last = now;
      this.ping = this.net.isConnected() ? (this.net.pingMs || 0) : 0;
      if (this.state === 'playing' || this.state === 'countdown') this.updateLook(dt);

      if (this.state === 'countdown') this.updateCountdown(now);
      if (this.state === 'playing') {
        this.acc += dt;
        let steps = 0;
        while (this.acc >= TICK && steps < 5) {
          this.acc -= TICK;
          steps++;
          this.fixedStep(TICK);
        }
        this.sendState(now);
      }
      if (this.me && (this.state === 'playing' || this.state === 'finished')) this.updateRespawn(now);

      this.syncRigs(dt, now);
      this.render(dt, now);

      if (this.me && (this.state === 'playing' || this.state === 'countdown' || this.state === 'finished')) {
        this.hudAcc += dt;
        if (this.hudAcc >= 0.08) {
          this.hudAcc = 0;
          this.buildHud(now);
          VOX.UI.updateHUD(this);
        }
      }
      this.trackPerf(dt);
    },

    fixedStep(dt) {
      if (!this.me) return;
      this.moveT += dt;
      this.updateMovers();
      const st = this.me.st;
      const bx = st.x, by = st.y, bz = st.z;
      if (this.hitPause > 0) {
        this.hitPause = Math.max(0, this.hitPause - dt);
        this.prevLocal = { x: st.x, y: st.y, z: st.z };
        return;
      }
      if (this.spearChargeActive && (this.me.dead || this.me.finished)) this.cancelSpearCharge();
      if (!this.me.dead && !this.me.finished) {
        if (this.me.hookPull) this.updateHookPull();
        this.tickLocal(dt);
      }
      if (this.playerHook) this.tickPlayerHook();
      this.tickArrows();
      if (this.mode === 'bot' && this.bot && !this.bot.dead) this.tickBot(dt);
      for (const entry of this.remotes.values()) {
        if (entry !== this.bot) C.tickStatus(entry);
      }
      const mdx = st.x - bx, mdy = st.y - by, mdz = st.z - bz;
      this.prevLocal = (mdx * mdx + mdy * mdy + mdz * mdz > 6.25)
        ? { x: st.x, y: st.y, z: st.z }
        : { x: bx, y: by, z: bz };
      if (this.attackCD > 0) this.attackCD--;
      if (this.useCD > 0) this.useCD--;
      if (this.boostCD > 0) this.boostCD--;
      if (this.grappleCD > 0) this.grappleCD--;
      if (this.attackBuffer > 0) {
        this.attackBuffer--;
        if (this.attackCD <= 0) {
          this.attackBuffer = 0;
          this.tryAttack();
        }
      }
      if (this.swing > 0) this.swing = Math.max(0, this.swing - dt * 5);
    },

    localRenderPos() {
      const st = this.me && this.me.st;
      if (!st) return { x: 0, y: 0, z: 0 };
      const p = this.prevLocal;
      if (!p) return { x: st.x, y: st.y, z: st.z };
      const a = this.state === 'playing' ? clamp(this.acc / TICK, 0, 1) : 1;
      return {
        x: p.x + (st.x - p.x) * a,
        y: p.y + (st.y - p.y) * a,
        z: p.z + (st.z - p.z) * a,
      };
    },

    updateMovers() {
      if (!this.movers || !this.movers.length) return;
      for (let i = 0; i < this.movers.length; i++) {
        const m = this.movers[i], mv = m.mover;
        if (!mv) continue;
        const ox = m.x, oy = m.y, oz = m.z;
        const s = Math.sin(this.moveT * mv.speed + mv.phase);
        m.x = mv.bx + (mv.axis === 'x' ? s * mv.amp : 0);
        m.y = mv.by + (mv.axis === 'y' ? s * mv.amp : 0);
        m.z = mv.bz + (mv.axis === 'z' ? s * mv.amp : 0);
        m._dx = m.x - ox; m._dy = m.y - oy; m._dz = m.z - oz;
      }
    },

    tickLocal(dt) {
      const me = this.me, st = me.st;
      if (this.spearChargeActive) {
        if (!this.mouseRight || me.weapon !== 'spear' || !this.canFight() || this.attackCD > 0) {
          this.cancelSpearCharge();
        } else {
          this.spearCharge = Math.min(C.weapon('spear').chargeMax, this.spearCharge + 1);
        }
      }
      const block = (this.mode === 'duel' || this.mode === 'team' || this.mode === 'bot') && this.mouseRight && me.weapon !== 'spear';
      me.block = block;
      const inp = {
        f: !!this.keys.KeyW, b: !!this.keys.KeyS, l: !!this.keys.KeyA, r: !!this.keys.KeyD,
        jumpPressed: this.jumpPressed, jump: !!this.keys.Space,
        slide: !!this.keys.KeyC, slidePressed: this.slidePressed,
        sneak: !!this.keys.ShiftLeft || !!this.keys.ShiftRight,
        sprintKey: !!(this.keys.ControlLeft || this.keys.ControlRight || this.sprintDouble),
        yaw: me.yaw, slow: block ? 0.62 : 1,
      };
      this.jumpPressed = false;
      this.slidePressed = false;

      const ev = P.tick(st, inp, this.pworld, this.voidY);
      C.tickStatus(me);

      if (st.on && st.on.mover) {
        st.x += st.on._dx || 0; st.y += st.on._dy || 0; st.z += st.on._dz || 0;
      }
      if (ev.jumped) VOX.Audio.play(ev.airJumped ? 'doubleJump' : 'jump');
      if (ev.slid) {
        VOX.Audio.play('slide');
        this.world.spark(st.x, st.y + 0.1, st.z, 0xc9d8e8, 7, 2.2);
      }
      if (ev.bounced) {
        VOX.Audio.play('bounce');
        this.world.spark(st.x, st.y + 0.2, st.z, 0x7cf05a, 8, 4);
      }
      if (ev.landed && ev.landSpeed < -0.08) {
        if (ev.landSpeed < -0.16) {
          VOX.Audio.play('land');
          this.world.spark(st.x, st.y + 0.1, st.z, 0xd9c6a0, 6, 2.4);
        }
      }

      const speed = Math.hypot(st.vx, st.vz) * TPS;
      if (st.ground && speed > 1.2) {
        this.stepT -= dt;
        if (this.stepT <= 0) { this.stepT = st.sprint ? 0.2 : 0.3; VOX.Audio.play('step'); }
      } else this.stepT = 0;

      if (st.on && st.on.t === 'speed') {
        const fx = -Math.sin(me.yaw), fz = -Math.cos(me.yaw);
        st.boostT = 45;
        st.vx = clamp(st.vx + fx * 0.017, -0.46, 0.46);
        st.vz = clamp(st.vz + fz * 0.017, -0.46, 0.46);
        if (this.boostCD <= 0) {
          this.boostCD = 72;
          VOX.Audio.play('boost');
          this.world.spark(st.x, st.y + 0.1, st.z, 0x35e0e8, 6, 3);
        }
      }

      this.checkHazards();
      if (this.mode === 'solo' || this.mode === 'race') {
        this.checkCheckpoints();
        this.checkFinish();
        if (ev.fell) this.raceFall(false);
      } else if (this.mode === 'bridge') {
        if (ev.fell) this.bridgeFall();
      } else if (this.isPvp()) {
        if (ev.fell) this.pvpDeath('void', me.lastAttacker);
      }
    },

    updateRespawn(now) {
      const me = this.me;
      if (!me) return;
      if (me.dead && now >= me.deadUntil) {
        me.dead = false;
        me.hp = C.MAX_HP;
        me.invuln = 60;
        me.lastHit = 0;
        me.lastAttacker = null;
        this.placeAtSpawn();
        if (this.localRig) this.localRig.root.visible = this.thirdPerson;
        VOX.Audio.play('respawn');
      }
      if (this.bot && this.bot.dead && now >= this.bot.deadUntil && this.state === 'playing') this.respawnBot();
    },

    checkCheckpoints() {
      const me = this.me;
      if (!this.level || !this.level.checkpoints || me.finished) return;
      const st = me.st;
      for (let i = 0; i < this.level.checkpoints.length; i++) {
        const b = this.level.checkpoints[i];
        if (b.cpIndex !== me.cp) continue;
        if (Math.abs(st.x - b.x) < b.w / 2 + 0.55 &&
            Math.abs(st.z - b.z) < b.d / 2 + 0.55 &&
            st.y > b.y - 1.2 && st.y < b.y + 2.2) {
          me.cp++;
          this.spawnPoint = { x: b.x, y: b.y + 0.02, z: b.z, yaw: 0 };
          me.hp = C.MAX_HP;
          VOX.Audio.play('cp');
          this.world.spark(b.x, b.y + 0.4, b.z, 0x35e0e8, 14, 3.5);
          VOX.UI.toast('Checkpoint ' + me.cp + ' / ' + this.cpTotal, '#35e0e8');
          break;
        }
      }
    },

    checkFinish() {
      const me = this.me;
      if (me.finished || !this.level || !this.level.finishBox || me.cp < this.cpTotal) return;
      const b = this.level.finishBox, st = me.st;
      if (Math.abs(st.x - b.x) < b.w / 2 + 0.4 &&
          Math.abs(st.z - b.z) < b.d / 2 + 0.4 &&
          st.y > b.y - 1.4 && st.y < b.y + 2.4) {
        const t = (performance.now() - this.matchStart) / 1000;
        me.finished = true;
        me.finishTime = t;
        me.hp = C.MAX_HP;
        this.onLocalFinish(t);
      }
    },

    checkHazards() {
      if (!this.hazards || !this.hazards.length) return;
      const st = this.me.st;
      for (let i = 0; i < this.hazards.length; i++) {
        const b = this.hazards[i], th = b.th || 1;
        if (st.x + 0.3 > b.x - b.w / 2 && st.x - 0.3 < b.x + b.w / 2 &&
            st.y + 1.7 > b.y - th && st.y < b.y &&
            st.z + 0.3 > b.z - b.d / 2 && st.z - 0.3 < b.z + b.d / 2) {
          this.world.spark(st.x, st.y + 0.4, st.z, 0xff7a30, 18, 4);
          if (this.isPvp()) this.pvpDeath('void', null);
          else if (this.mode === 'bridge') this.bridgeFall();
          else this.raceFall(true);
          break;
        }
      }
    },

    raceFall(hazard) {
      const me = this.me;
      if (!me || me.finished) return;
      this.cancelSpearCharge();
      me.falls = (me.falls || 0) + 1;
      VOX.Audio.play(hazard ? 'hurt' : 'fall');
      this.world.spark(me.st.x, me.st.y + 0.4, me.st.z, hazard ? 0xff7a30 : 0x9fd8ff, 10, 3);
      this.placeAtSpawn();
      VOX.Audio.play('respawn');
      const where = me.cp > 0 ? ' checkpoint ' + me.cp + '/' + this.cpTotal : ' the start';
      VOX.UI.toast((hazard ? 'Burned! Back to' : 'Fell! Back to') + where, '#ff7a45');
    },

    bridgeFall() {
      this.cancelSpearCharge();
      VOX.Audio.play('fall');
      this.placeAtSpawn();
      VOX.UI.toast('Back to the bridge', '#8be02a');
    },

    isPvp() { return this.mode === 'duel' || this.mode === 'team' || this.mode === 'bot'; },

    isRace() { return this.mode === 'race'; },

    canFight() { return this.isPvp() || this.isRace(); },

    isEnemy(p) {
      if (!this.me) return false;
      if (this.mode === 'team') return (p.team & 1) !== (this.me.team & 1);
      return p.id !== this.me.id;
    },

    impactFrames(crit, allowPause) {
      const power = crit ? 1.45 : 1;
      this.shake = Math.max(this.shake || 0, 0.17 * power);
      this.shakeT = Math.max(this.shakeT || 0, this.shakeDur);
      this.impactFlash = Math.max(this.impactFlash || 0, crit ? 0.12 : 0.075);
      if (allowPause && !this.multiplayer) {
        this.hitPause = Math.max(this.hitPause || 0, crit ? 0.05 : 0.04);
      }
    },

    requestAttack() {
      const me = this.me;
      if (!me || me.dead || me.finished || this.state !== 'playing' || !this.canFight()) return;
      if (this.attackCD > 0) {
        this.attackBuffer = 10;
        return;
      }
      this.tryAttack();
    },

    tryAttack() {
      const me = this.me;
      if (!me || me.dead || me.finished || this.attackCD > 0) return;
      const w = C.weapon(me.weapon);
      if (w.id === 'bow') {
        this.fireBow();
        return;
      }
      this.attackCD = w.cooldown;
      this.attackBuffer = 0;
      this.swing = 1;
      VOX.Audio.play(w.id === 'spear' ? 'spear' : 'swing');
      if (w.id === 'spear') {
        const target = this.pickSpearTarget(w);
        if (target) this.spearDash(target, w);
      }
      const eye = C.eye(me.st, !!this.keys.ShiftLeft);
      const dir = C.dirFrom(me.yaw, me.pitch);
      const hits = [];
      for (const entry of this.remotes.values()) {
        if (entry.dead || !this.isEnemy(entry)) continue;
        const t = C.hitTest(eye, dir, entry.st, w.reach, w.cone);
        if (t >= 0) hits.push({ entry, t });
      }
      hits.sort((a, b) => a.t - b.t);
      for (let i = 0; i < Math.min(w.maxHits, hits.length); i++) this.hitTarget(hits[i].entry, w);
      me.st.vx -= Math.sin(me.yaw) * 0.012;
      me.st.vz -= Math.cos(me.yaw) * 0.012;
    },

    pickSpearTarget(w, range, cone) {
      const me = this.me;
      const eye = C.eye(me.st, !!this.keys.ShiftLeft);
      const dir = C.dirFrom(me.yaw, me.pitch);
      let best = null;
      const maxRange = range || w.dashRange || w.reach;
      const maxCone = cone === undefined ? Math.max(w.cone, 0.82) : cone;
      for (const entry of this.remotes.values()) {
        if (entry.dead || !this.isEnemy(entry)) continue;
        const t = C.hitTest(eye, dir, entry.st, maxRange, maxCone);
        if (t < 0 || this.lineBlocked(eye, dir, t - 0.3)) continue;
        if (!best || t < best.t) best = { entry: entry, t: t };
      }
      return best ? best.entry : null;
    },

    startSpearCharge() {
      const me = this.me;
      if (!me || me.dead || me.finished || this.state !== 'playing') return;
      if (!this.canFight() || me.weapon !== 'spear' || this.attackCD > 0) return;
      if (this.spearChargeActive) return;
      this.spearChargeActive = true;
      this.spearCharge = 0;
      VOX.Audio.play('spearCharge');
    },

    cancelSpearCharge() {
      this.spearChargeActive = false;
      this.spearCharge = 0;
    },

    releaseSpearCharge() {
      if (!this.spearChargeActive) return;
      const me = this.me;
      const w = C.weapon('spear');
      const charge = this.spearCharge;
      this.spearChargeActive = false;
      this.spearCharge = 0;
      if (!me || me.dead || me.finished || this.state !== 'playing' || !this.canFight() || me.weapon !== 'spear') return;
      if (charge < w.chargeMin) {
        VOX.Audio.play('miss');
        return;
      }
      const target = this.pickSpearTarget(w, w.chargeRange, 0.74);
      if (!target) {
        VOX.Audio.play('miss');
        return;
      }
      const ratio = clamp((charge - w.chargeMin) / Math.max(1, w.chargeMax - w.chargeMin), 0, 1);
      const hitW = {
        id: 'spear', reach: w.reach, damage: Math.round(w.damage + (w.chargeDamage - w.damage) * ratio),
        kb: w.kb + (w.chargeKb - w.kb) * ratio, block: w.block,
      };
      this.attackCD = w.chargeCooldown;
      this.attackBuffer = 0;
      this.swing = 1;
      VOX.Audio.play('spearDash');
      this.spearChargeDash(target, hitW, ratio);
    },

    spearChargeDash(target, hitW, ratio) {
      const me = this.me, st = me.st;
      const dx = target.st.x - st.x, dz = target.st.z - st.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.001) return;
      const ux = dx / dist, uz = dz / dist;
      const stop = 1.35;
      const step = 0.18;
      const maxSteps = Math.min(70, Math.ceil(Math.max(0, dist - stop) / step));
      let x = st.x, z = st.z, moved = false;
      for (let i = 0; i < maxSteps; i++) {
        const nx = x + ux * step, nz = z + uz * step;
        if (P.boxHit(this.pworld, nx, st.y, nz)) break;
        x = nx;
        z = nz;
        moved = true;
        if (Math.hypot(target.st.x - x, target.st.z - z) <= stop) break;
      }
      if (moved) {
        st.x = x;
        st.z = z;
        st.vx += ux * (0.06 + ratio * 0.05);
        st.vz += uz * (0.06 + ratio * 0.05);
        st.vy = Math.max(st.vy, 0.018);
        this.world.spark(x, st.y + 0.8, z, 0xd8dee6, 10, 3.2);
      }
      const remain = Math.hypot(target.st.x - st.x, target.st.z - st.z);
      if (remain > Math.min(hitW.reach, 3.8)) return;
      const yaw = Math.atan2(-(target.st.x - st.x), -(target.st.z - st.z));
      this.hitTarget(target, hitW, yaw);
    },

    spearDash(target) {
      const me = this.me, st = me.st;
      const dx = target.st.x - st.x, dz = target.st.z - st.z;
      const dist = Math.hypot(dx, dz);
      if (dist <= 1.55) return;
      const ux = dx / dist, uz = dz / dist;
      const stop = 1.45;
      const step = 0.16;
      const maxSteps = Math.min(36, Math.ceil((dist - stop) / step));
      let x = st.x, z = st.z, moved = false;
      for (let i = 0; i < maxSteps; i++) {
        const nx = x + ux * step, nz = z + uz * step;
        if (P.boxHit(this.pworld, nx, st.y, nz)) break;
        x = nx;
        z = nz;
        moved = true;
        if (Math.hypot(target.st.x - x, target.st.z - z) <= stop) break;
      }
      if (!moved) return;
      st.x = x;
      st.z = z;
      st.vx += ux * 0.055;
      st.vz += uz * 0.055;
      st.vy = Math.max(st.vy, 0.015);
      this.world.spark(x, st.y + 0.8, z, 0xd8dee6, 8, 2.8);
    },

    lineBlocked(origin, dir, maxDist) {
      if (maxDist <= 0) return false;
      const hit = P.raycastWorld(this.pworld, origin, dir, maxDist, { includeWalls: true });
      return !!(hit && hit.t < maxDist - 0.25);
    },

    hitTarget(target, weapon, yawOverride) {
      const me = this.me;
      const w = weapon || C.weapon(me.weapon);
      const yaw = yawOverride === undefined ? me.yaw : yawOverride;
      const crit = C.crit(me.st);
      const dmg = P.dmgOf(w.damage, crit);
      let kb = w.kb;
      if (me.st.sprint && me.st.kb) { kb *= 1.9; me.st.kb = false; }
      if (crit) kb *= 1.15;
      this.world.spark(target.st.x, target.st.y + 1.1, target.st.z, crit ? 0xffd23f : 0xff5c5c, crit ? 12 : 7, 3);
      target.hitFlash = 12;
      target.swing = 0.7;
      this.impactFrames(crit, true);
      VOX.Audio.play('impact');

      if (this.isRace()) {
        const kx = Math.sin(yaw) * kb, kz = Math.cos(yaw) * kb;
        target.st.vx -= kx;
        target.st.vz -= kz;
        target.st.vy = 0.11;
        target.lastAttacker = me.id;
        if (this.multiplayer) {
          this.net.send({ type: 'bump', victim: target.id, by: this.myId, kb: kb, yaw: yaw });
        }
        VOX.Audio.play(crit ? 'crit' : 'hit');
        return;
      }

      if (this.multiplayer) {
        this.net.send({ type: 'hit', victim: target.id, dmg: dmg, crit: crit, kb: kb, yaw: yaw, by: this.myId, weapon: w.id });
        VOX.Audio.play(crit ? 'crit' : 'hit');
        return;
      }
      const applied = C.applyDamage(target, dmg);
      if (applied > 0) {
        const st = target.st;
        st.vx -= Math.sin(yaw) * kb;
        st.vz -= Math.cos(yaw) * kb;
        st.vy = 0.135;
        target.lastAttacker = me.id;
        target.lastWeapon = w.id;
        VOX.Audio.play(crit ? 'crit' : 'hit');
        if (target.hp <= 0) this.onBotDeath(target);
      } else VOX.Audio.play('hit');
    },

    receiveHit(msg) {
      const me = this.me;
      if (!me || me.dead || me.finished || this.state !== 'playing') return;
      const w = C.weapon(msg.weapon);
      let dmg = msg.dmg || w.damage || C.BASE_DAMAGE;
      if (me.block) dmg = Math.max(1, Math.round(dmg * (C.weapon(me.weapon).block || C.SWORD_BLOCK_MULT)));
      const applied = C.applyDamage(me, dmg);
      if (applied <= 0) return;
      me.lastAttacker = msg.by || null;
      const kb = msg.kb || w.kb || 0.135;
      me.st.vx -= Math.sin(msg.yaw || 0) * kb;
      me.st.vz -= Math.cos(msg.yaw || 0) * kb;
      me.st.vy = msg.vy || 0.135;
      me.hitFlash = 12;
      this.impactFrames(!!msg.crit, false);
      if (me.block) VOX.Audio.play('block');
      else VOX.Audio.play(msg.crit ? 'crit' : 'hurt');
      VOX.Audio.play('impact');
      this.world.spark(me.st.x, me.st.y + 1.2, me.st.z, 0xff5c5c, 8, 3);
      if (me.hp <= 0) this.pvpDeath('kill', msg.by);
    },

    receiveBump(msg) {
      const me = this.me;
      if (!me || me.dead || me.finished || !this.isRace() || this.state !== 'playing') return;
      const kb = msg.kb || 0.1;
      me.st.vx -= Math.sin(msg.yaw || 0) * kb;
      me.st.vz -= Math.cos(msg.yaw || 0) * kb;
      me.st.vy = msg.vy || 0.11;
      me.hitFlash = 12;
      me.lastAttacker = msg.by || null;
      this.impactFrames(false, false);
      VOX.Audio.play('hit');
      this.world.spark(me.st.x, me.st.y + 1.2, me.st.z, 0xffd23f, 7, 3);
    },

    fireBow() {
      const me = this.me;
      if (!me || me.dead || me.finished || this.state !== 'playing') return;
      const w = C.weapon('bow');
      this.attackCD = w.cooldown;
      this.attackBuffer = 0;
      this.swing = 1;
      VOX.Audio.play('bow');
      const eye = C.eye(me.st, !!this.keys.ShiftLeft);
      const dir = C.dirFrom(me.yaw, me.pitch);
      const a = {
        aid: this.myId + ':' + (++this.arrowSeq),
        x: eye.x + dir.x * 0.55,
        y: eye.y + dir.y * 0.55,
        z: eye.z + dir.z * 0.55,
        vx: dir.x * w.speed,
        vy: dir.y * w.speed,
        vz: dir.z * w.speed,
        ttl: w.ttl,
        owner: this.myId,
        remote: false,
        mesh: null,
      };
      this.spawnArrow(a);
      this.arrows.push(a);
      if (this.multiplayer) {
        this.net.send({
          type: 'arrow', aid: a.aid, owner: this.myId,
          x: a.x, y: a.y, z: a.z, vx: a.vx, vy: a.vy, vz: a.vz, ttl: a.ttl,
        });
      }
    },

    spawnArrow(a) {
      const mesh = VOX.Player.makeArrow();
      mesh.scale.setScalar(1.08);
      mesh.rotation.order = 'YXZ';
      this.scene.add(mesh);
      a.mesh = mesh;
      this.syncArrowMesh(a);
    },

    syncArrowMesh(a) {
      if (!a.mesh) return;
      a.mesh.position.set(a.x, a.y, a.z);
      const speed = Math.hypot(a.vx, a.vy, a.vz);
      if (speed > 1e-5) {
        a.mesh.rotation.y = Math.atan2(-a.vx, -a.vz);
        a.mesh.rotation.x = Math.asin(clamp(a.vy / speed, -1, 1));
      }
    },

    tickArrows() {
      if (!this.arrows || !this.arrows.length) return;
      const w = C.weapon('bow');
      for (let i = this.arrows.length - 1; i >= 0; i--) {
        const a = this.arrows[i];
        if (--a.ttl <= 0) {
          this.finishArrow(a, true);
          continue;
        }
        const speed = Math.hypot(a.vx, a.vy, a.vz);
        if (speed < 0.01) {
          this.finishArrow(a, true);
          continue;
        }
        const dir = { x: a.vx / speed, y: a.vy / speed, z: a.vz / speed };
        const travel = Math.max(0.1, a.ttl * (w.speed / 60));
        const worldHit = P.raycastWorld(this.pworld, { x: a.x, y: a.y, z: a.z }, dir, travel, { includeWalls: true });
        const wallHit = worldHit && worldHit.t <= travel ? worldHit : null;
        let hitT = worldHit ? worldHit.t : Infinity;
        let target = null;
        if (!a.remote) {
          for (const entry of this.remotes.values()) {
            if (entry.dead || !this.isEnemy(entry)) continue;
            const t = C.hitTest({ x: a.x, y: a.y, z: a.z }, dir, entry.st, travel, w.cone);
            if (t >= 0 && t < hitT) {
              hitT = t;
              target = entry;
            }
          }
        }
        if (wallHit && wallHit.t <= hitT) {
          a.x += dir.x * hitT;
          a.y += dir.y * hitT;
          a.z += dir.z * hitT;
          this.world.spark(a.x, a.y, a.z, 0xe9eff7, 5, 1.8);
          this.finishArrow(a, true);
          continue;
        }
        if (target) {
          a.x += dir.x * hitT;
          a.y += dir.y * hitT;
          a.z += dir.z * hitT;
          this.syncArrowMesh(a);
          this.arrowHit(target, a, w);
          this.finishArrow(a, true);
          continue;
        }
        if (worldHit && worldHit.t <= travel) {
          a.x += dir.x * hitT;
          a.y += dir.y * hitT;
          a.z += dir.z * hitT;
          this.world.spark(a.x, a.y, a.z, 0xe9eff7, 5, 1.8);
          this.finishArrow(a, true);
          continue;
        }
        a.x += a.vx;
        a.y += a.vy;
        a.z += a.vz;
        a.vy -= w.gravity;
        this.syncArrowMesh(a);
      }
    },

    arrowHit(target, a, w) {
      const yaw = Math.atan2(-a.vx, -a.vz);
      this.world.spark(target.st.x, target.st.y + 1.1, target.st.z, 0xffd23f, 7, 2.8);
      target.hitFlash = 10;
      this.impactFrames(false, true);
      VOX.Audio.play('arrow');
      if (this.isRace()) {
        const kb = w.kb;
        target.st.vx -= Math.sin(yaw) * kb;
        target.st.vz -= Math.cos(yaw) * kb;
        target.st.vy = w.kbVy || 0.1;
        if (this.multiplayer) {
          this.net.send({ type: 'bump', victim: target.id, by: this.myId, kb: kb, vy: w.kbVy || 0.1, yaw: yaw });
        }
        VOX.Audio.play('hit');
        return;
      }
      if (this.multiplayer) {
        this.net.send({
          type: 'hit', victim: target.id, dmg: w.damage, crit: false,
          kb: w.kb, vy: w.kbVy || 0.135, yaw: yaw, by: this.myId, weapon: 'bow',
        });
        VOX.Audio.play('hit');
        return;
      }
      const applied = C.applyDamage(target, w.damage);
      if (applied > 0) {
        target.st.vx -= Math.sin(yaw) * w.kb;
        target.st.vz -= Math.cos(yaw) * w.kb;
        target.st.vy = w.kbVy || 0.11;
        target.lastAttacker = this.myId;
        target.lastWeapon = 'bow';
        VOX.Audio.play('hit');
        if (target.hp <= 0) this.onBotDeath(target);
      } else VOX.Audio.play('hit');
    },

    finishArrow(a, notify) {
      if (a.mesh) {
        this.scene.remove(a.mesh);
        a.mesh.traverse((o) => {
          if (o.geometry) o.geometry.dispose();
          if (o.material && o.material.dispose) o.material.dispose();
        });
        a.mesh = null;
      }
      const i = this.arrows.indexOf(a);
      if (i >= 0) this.arrows.splice(i, 1);
      if (notify && this.multiplayer && !a.remote) {
        this.net.send({ type: 'arrow_end', aid: a.aid, owner: this.myId });
      }
    },

    onRemoteArrow(msg) {
      if (!msg || !msg.aid || msg.owner === this.myId) return;
      if (this.arrows.some((a) => a.aid === msg.aid)) return;
      const a = {
        aid: msg.aid, x: msg.x, y: msg.y, z: msg.z,
        vx: msg.vx || 0, vy: msg.vy || 0, vz: msg.vz || 0,
        ttl: msg.ttl || 90, owner: msg.owner || msg.id, remote: true, mesh: null,
      };
      this.spawnArrow(a);
      this.arrows.push(a);
    },

    onRemoteArrowEnd(msg) {
      if (!msg || !msg.aid) return;
      for (let i = this.arrows.length - 1; i >= 0; i--) {
        if (this.arrows[i].aid === msg.aid) this.finishArrow(this.arrows[i], false);
      }
    },

    pvpDeath(cause, byId) {
      const me = this.me;
      if (!me || me.dead) return;
      this.cancelSpearCharge();
      me.dead = true;
      me.hp = 0;
      me.deadUntil = performance.now() + 1500;
      me.lastAttacker = byId || me.lastAttacker || null;
      if (this.localRig) this.localRig.root.visible = false;
      VOX.Audio.play('kill');
      this.world.spark(me.st.x, me.st.y + 1, me.st.z, 0xff5c5c, 16, 4);
      VOX.UI.toast('Knocked out', '#ff5b5b', byId ? 'by ' + this.nameOf(byId) : '');
      this.placeAtSpawn();
      if (this.multiplayer) {
        if (this.isHost()) this.hostResolveDeath(this.myId, me.lastAttacker, cause);
        else this.net.send({ type: 'death', by: me.lastAttacker || null, cause: cause });
      } else if (this.mode === 'bot' && this.bot) {
        this.addScore(this.bot.id, 'kills');
        this.addScore(this.myId, 'deaths');
        this.setScores(this.scores);
        this.killFeed(this.bot.id, this.myId, cause);
        if (this.scores[this.bot.id].kills >= 5) this.endBotMatch(false);
      }
    },

    onBotDeath(bot) {
      if (!bot || bot.dead) return;
      bot.dead = true;
      bot.hp = 0;
      bot.deadUntil = performance.now() + 1400;
      if (bot.rig) bot.rig.root.visible = false;
      VOX.Audio.play('kill');
      this.addScore(this.myId, 'kills');
      this.addScore(bot.id, 'deaths');
      this.setScores(this.scores);
      this.killFeed(this.myId, bot.id, 'kill');
      VOX.UI.toast('Knockout!', '#ffd23f', this.scores[this.myId].kills + ' KOs');
      if (this.scores[this.myId].kills >= 5) this.endBotMatch(true);
    },

    addScore(id, field) {
      if (!this.scores[id]) this.scores[id] = { kills: 0, deaths: 0 };
      this.scores[id][field] = (this.scores[id][field] || 0) + 1;
    },

    setScores(sc) {
      this.scores = {};
      const keys = Object.keys(sc || {});
      for (let i = 0; i < keys.length; i++) {
        const s = sc[keys[i]] || {};
        this.scores[keys[i]] = { kills: s.kills || 0, deaths: s.deaths || 0 };
      }
      const mine = this.scores[this.myId];
      if (mine) {
        const dk = mine.kills - (this._statK || 0);
        const dd = mine.deaths - (this._statD || 0);
        if (dk > 0) this.stats.kills += dk;
        if (dd > 0) this.stats.deaths += dd;
        this._statK = mine.kills;
        this._statD = mine.deaths;
        if (dk > 0 || dd > 0) this.saveProfile();
      }
    },

    scoresSnapshot() {
      const out = {};
      Object.keys(this.scores || {}).forEach((id) => {
        out[id] = { kills: this.scores[id].kills || 0, deaths: this.scores[id].deaths || 0 };
      });
      return out;
    },

    nameOf(id) {
      const p = this.matchPlayers.find((x) => x.id === id);
      if (p) return p.name;
      if (id === this.myId) return this.profile.name;
      if (id === 'bot') return 'Trainer Bot';
      return 'Player';
    },

    colorOf(id) {
      const p = this.matchPlayers.find((x) => x.id === id);
      if (p && this.mode === 'team') return TEAM_COLORS[p.team & 1];
      return p ? (p.color || '#e9eff7') : '#e9eff7';
    },

    killFeed(killerId, victimId, cause) {
      const kn = killerId ? esc(this.nameOf(killerId)) : 'The void';
      const vn = esc(this.nameOf(victimId));
      const kc = killerId ? this.colorOf(killerId) : '#8b98a8';
      VOX.UI.killfeed('<b style="color:' + kc + '">' + kn + '</b> knocked out <b>' + vn + '</b>');
      if (killerId === this.myId) VOX.UI.toast('Knockout!', '#ffd23f');
    },

    hostResolveDeath(victimId, byId, cause) {
      if (!this.isHost() || this.state !== 'playing') return;
      if (!this.scores[victimId]) return;
      this.addScore(victimId, 'deaths');
      if (byId && this.scores[byId] && byId !== victimId) this.addScore(byId, 'kills');
      this.setScores(this.scores);
      this.killFeed(byId, victimId, cause);
      this.net.send({ type: 'kill', victim: victimId, killer: byId || null, cause: cause, scores: this.scoresSnapshot() });
      this.checkHostWin();
    },

    checkHostWin() {
      if (!this.multiplayer || !this.isHost()) return;
      if (this.mode === 'duel') {
        for (const id in this.scores) if (this.scores[id].kills >= 5) return this.hostEndMatch(id, null);
      } else if (this.mode === 'team') {
        for (const t of [0, 1]) if (this.teamKills(t) >= 15) return this.hostEndMatch(null, t);
      }
    },

    hostEndMatch(winnerId, winnerTeam) {
      const result = {
        mode: this.mode, winnerId: winnerId, winnerTeam: winnerTeam,
        scores: this.scoresSnapshot(),
        title: winnerTeam !== null && winnerTeam !== undefined
          ? (winnerTeam === 0 ? 'CYAN TEAM WINS' : 'RED TEAM WINS')
          : (this.nameOf(winnerId) + ' WINS'),
      };
      this.net.send({ type: 'match_over', result: result });
      this.endPvpMatch(result);
    },

    endPvpMatch(result) {
      if (this.state === 'finished') return;
      this.state = 'finished';
      const mine = this.scores[this.myId] || { kills: 0, deaths: 0 };
      if (mine.kills > this.stats.bestKills) { this.stats.bestKills = mine.kills; this.saveProfile(); }
      this.showPvpResults(result);
    },

    endBotMatch(win) {
      if (this.state === 'finished') return;
      this.state = 'finished';
      const mine = this.scores[this.myId] || { kills: 0, deaths: 0 };
      if (mine.kills > this.stats.bestKills) { this.stats.bestKills = mine.kills; this.saveProfile(); }
      this.showPvpResults({
        mode: 'bot', winnerId: win ? this.myId : (this.bot ? this.bot.id : null),
        scores: this.scoresSnapshot(),
      });
    },

    tickBot(dt) {
      const bot = this.bot, st = bot.st, me = this.me;
      if (!bot || bot.dead || !me) return;
      C.tickStatus(bot);
      const dx = me.st.x - st.x, dz = me.st.z - st.z;
      const dist = Math.hypot(dx, dz);
      const want = Math.atan2(-dx, -dz);
      bot.yaw += angleTo(bot.yaw, want) * 0.14;
      bot.pitch = clamp(Math.atan2(me.st.y + 1.4 - (st.y + 1.5), Math.max(0.1, dist)) * 0.6, -1, 1);

      const fx = -Math.sin(bot.yaw), fz = -Math.cos(bot.yaw);
      const safe = this.groundAhead(st.x + fx * 0.8, st.z + fz * 0.8, st.y);
      const blocked = P.boxHit(this.pworld, st.x + fx * 0.6, st.y, st.z + fz * 0.6);
      const inp = {
        f: dist > 1.9 && safe, b: false,
        l: !safe && dist > 1.2 && Math.sin(this.moveT * 2.1) > 0,
        r: !safe && dist > 1.2 && Math.sin(this.moveT * 2.1) <= 0,
        jumpPressed: blocked || (st.ground && dist > 3 && Math.random() < 0.012),
        jump: false, sneak: false, sprintKey: dist > 5, yaw: bot.yaw, slow: 1,
      };
      const ev = P.tick(st, inp, this.pworld, this.voidY);
      if (ev.fell || st.y < (this.basinY || this.voidY + 2)) { this.onBotDeath(bot); return; }
      bot.target.x = st.x; bot.target.y = st.y; bot.target.z = st.z;
      bot.cur.x = st.x; bot.cur.y = st.y; bot.cur.z = st.z;

      bot.swing = Math.max(0, bot.swing - dt * 5);
      bot.attackCD = Math.max(0, (bot.attackCD || 0) - 1);
      if (dist < 2.7 && Math.abs(angleTo(bot.yaw, want)) < 0.9 && bot.attackCD <= 0) {
        if (Math.random() < 0.55) {
          bot.attackCD = 15 + ((Math.random() * 8) | 0);
          bot.swing = 1;
          VOX.Audio.play('swing');
          let dmg = C.BASE_DAMAGE;
          if (me.block) dmg = Math.max(1, Math.round(dmg * C.SWORD_BLOCK_MULT));
          const applied = C.applyDamage(me, dmg);
          if (applied > 0) {
            const kb = 0.135;
            me.st.vx -= Math.sin(bot.yaw) * kb;
            me.st.vz -= Math.cos(bot.yaw) * kb;
            me.st.vy = 0.135;
            me.lastAttacker = bot.id;
            me.hitFlash = 12;
            this.impactFrames(false, true);
            if (me.block) VOX.Audio.play('block');
            else VOX.Audio.play('hurt');
            VOX.Audio.play('impact');
            this.world.spark(me.st.x, me.st.y + 1.2, me.st.z, 0xff5c5c, 8, 3);
            if (me.hp <= 0) this.pvpDeath('kill', bot.id);
          }
        } else bot.attackCD = 6;
      }
      this.updateBotLabel(bot);
    },

    groundAhead(x, z, y) {
      for (let i = 0; i < this.pworld.length; i++) {
        const b = this.pworld[i], th = b.th || 1;
        if (x > b.x - b.w / 2 && x < b.x + b.w / 2 &&
            z > b.z - b.d / 2 && z < b.z + b.d / 2 &&
            b.y <= y + 0.35 && b.y - th >= y - 3.2) return true;
      }
      return false;
    },

    respawnBot() {
      const bot = this.bot;
      if (!bot) return;
      const idx = this.matchPlayers.findIndex((p) => p.id === bot.id);
      const s = this.spawnFor(idx);
      const st = bot.st;
      st.x = s.x; st.y = s.y; st.z = s.z;
      st.vx = st.vy = st.vz = 0; st.ground = false; st.on = null; st.kb = true;
      st.slideT = 0; st.slideCD = 0; st.boostT = 0; st.grapple = null;
      st.airJumps = P.CFG.airJumps; st.coyote = 0; st.jumpCut = false;
      bot.hp = C.MAX_HP; bot.invuln = 60; bot.lastHit = 0; bot.dead = false;
      bot.yaw = s.yaw; bot.pitch = 0;
      if (bot.rig) bot.rig.root.visible = true;
      this.updateBotLabel(bot);
    },

    updateBotLabel(bot) {
      if (!bot.rig) return;
      const now = performance.now();
      if (!bot._labelAt || now - bot._labelAt > 300) {
        bot._labelAt = now;
        bot.rig.setLabel(bot.name, Math.max(0, bot.hp), C.MAX_HP);
      }
    },

    placeBlock() {
      if (!this.allowBuild || this.useCD > 0 || !this.me || this.me.dead) return;
      this.useCD = 5;
      const eye = C.eye(this.me.st, false);
      const dir = C.dirFrom(this.me.yaw, this.me.pitch);
      const hit = P.raycastWorld(this.pworld, eye, dir, P.CFG.reach);
      if (!hit) return;
      const players = [];
      if (this.me) players.push(this.me.st);
      this.remotes.forEach((e) => { if (!e.dead) players.push(e.st); });
      if (!P.canPlaceBlock(this.pworld, hit.placeCell, players)) return;
      const cell = hit.placeCell;
      const b = { x: cell[0] + 0.5, y: cell[1] + 1, z: cell[2] + 0.5, w: 1, d: 1, th: 1, t: HOTBAR[this.selected].type };
      this.addBlockObject(b);
      VOX.Audio.play('place');
      this.world.spark(b.x, b.y - 0.5, b.z, 0xffffff, 4, 2);
      if (this.multiplayer) this.net.send({ type: 'block_place', b: b });
    },

    breakBlock() {
      if (!this.allowBuild || this.useCD > 0 || !this.me || this.me.dead) return;
      this.useCD = 5;
      const eye = C.eye(this.me.st, false);
      const dir = C.dirFrom(this.me.yaw, this.me.pitch);
      const hit = P.raycastWorld(this.pworld, eye, dir, P.CFG.reach);
      if (!hit || !hit.box) return;
      const b = hit.box;
      if (b.t === 'wall' || b.isStart || b.isFinish || b.isEnclosure) return;
      this.world.spark(b.x, b.y - 0.5, b.z, 0xd9c6a0, 8, 2.5);
      VOX.Audio.play('break');
      this.removeBlockObject(b);
      if (this.multiplayer) this.net.send({ type: 'block_break', b: { x: b.x, y: b.y, z: b.z, t: b.t } });
    },

    addBlockObject(b) {
      this.blocks.push(b);
      this.pworld.push(b);
      this.world.addBox(b);
      this.placedCount = (this.placedCount || 0) + 1;
    },

    removeBlockObject(b) {
      let i = this.pworld.indexOf(b);
      if (i >= 0) this.pworld.splice(i, 1);
      i = this.blocks.indexOf(b);
      if (i >= 0) this.blocks.splice(i, 1);
      if (!this.world.removeBox(b)) {
        this.world.build(this.blocks, this.theme);
        this.world.setQuality(this.settings.quality);
      }
      this.placedCount = Math.max(0, (this.placedCount || 0) - 1);
    },

    onRemotePlace(b) {
      if (!this.allowBuild || !b) return;
      this.addBlockObject(Object.assign({}, b));
      VOX.Audio.play('place');
    },

    onRemoteBreak(d) {
      if (!this.allowBuild || !d) return;
      for (let i = 0; i < this.blocks.length; i++) {
        const b = this.blocks[i];
        if (Math.abs(b.x - d.x) < 0.01 && Math.abs(b.y - d.y) < 0.01 &&
            Math.abs(b.z - d.z) < 0.01 && b.t === d.t) {
          this.removeBlockObject(b);
          VOX.Audio.play('break');
          break;
        }
      }
    },

    updateHeldSlot() {
      if (this.mode === 'bridge') {
        const type = HOTBAR[this.selected] ? HOTBAR[this.selected].type : 'wool_red';
        if (this.viewmodel) this.viewmodel.setSlot(1, type);
        if (this.localRig) this.localRig.setHeldSlot(1, type);
        return;
      }
      const weapon = (this.me && this.me.weapon) || 'sword';
      if (this.viewmodel && this.viewmodel.setWeapon) this.viewmodel.setWeapon(weapon);
      if (this.localRig && this.localRig.setWeapon) this.localRig.setWeapon(weapon);
    },

    initGrappleRope() {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      const mat = new THREE.LineBasicMaterial({ color: 0x35e0e8, transparent: true, opacity: 0.92, depthWrite: false });
      this.grappleRope = new THREE.Line(geo, mat);
      this.grappleRope.visible = false;
      this.grappleRope.frustumCulled = false;
      this.scene.add(this.grappleRope);
    },

    startGrapple() {
      const me = this.me;
      if (!me || me.dead || me.finished || this.state !== 'playing' || me.st.grapple || this.playerHook) return;
      if (this.grappleCD > 0) return;
      const eye = C.eye(me.st, !!this.keys.ShiftLeft);
      const dir = C.dirFrom(me.yaw, me.pitch);
      if (this.canFight()) {
        const target = this.pickHookTarget(eye, dir, 80);
        if (target) {
          this.startPlayerHook(target);
          return;
        }
      }
      const hit = P.raycastWorld(this.pworld, eye, dir, 30);
      if (!hit) {
        this.grappleCD = 6;
        VOX.Audio.play('miss');
        return;
      }
      const px = eye.x + dir.x * Math.max(0.4, hit.t - 0.08);
      const py = eye.y + dir.y * Math.max(0.4, hit.t - 0.08);
      const pz = eye.z + dir.z * Math.max(0.4, hit.t - 0.08);
      me.st.grapple = { x: px, y: py, z: pz };
      me.st.vx += dir.x * 0.12;
      me.st.vy += Math.max(0, dir.y) * 0.08;
      me.st.vz += dir.z * 0.12;
      if (this.grappleRope) this.grappleRope.visible = true;
      VOX.Audio.play('grapple');
      this.world.spark(px, py, pz, 0x35e0e8, 7, 2.5);
    },

    pickHookTarget(eye, dir, maxDist) {
      let best = null;
      for (const entry of this.remotes.values()) {
        if (entry.dead || !this.isEnemy(entry)) continue;
        const t = C.hitTest(eye, dir, entry.st, maxDist, 0.9);
        if (t < 0 || this.lineBlocked(eye, dir, t - 0.3)) continue;
        if (!best || t < best.t) best = { entry: entry, t: t };
      }
      return best ? best.entry : null;
    },

    startPlayerHook(target) {
      const me = this.me;
      if (!me || !target) return;
      const ttl = 16;
      this.playerHook = { id: target.id, ttl: ttl };
      this.grappleCD = ttl;
      me.st.grapple = null;
      if (this.grappleRope) this.grappleRope.visible = true;
      VOX.Audio.play('hookHit');
      this.world.spark(target.st.x, target.st.y + 1.1, target.st.z, 0x35e0e8, 9, 3);
      if (this.multiplayer && target.id !== 'bot') {
        this.net.send({
          type: 'hook', victim: target.id, by: this.myId, ttl: ttl,
          x: me.st.x, y: me.st.y + 1.1, z: me.st.z,
        });
      }
    },

    tickPlayerHook() {
      const hook = this.playerHook;
      if (!hook) return;
      const me = this.me;
      if (!me || this.state !== 'playing' || me.dead) {
        this.releaseGrapple(false);
        return;
      }
      hook.ttl--;
      const target = this.remotes.get(hook.id);
      if (!target || target.dead || hook.ttl <= 0) {
        this.releaseGrapple();
        return;
      }
      const tst = target.st;
      const dx = me.st.x - tst.x;
      const dy = (me.st.y + 1.1) - (tst.y + 1.1);
      const dz = me.st.z - tst.z;
      const dist = Math.hypot(dx, dy, dz);
      if (dist > 2.5) {
        const pull = 0.18 / Math.max(1, dist);
        tst.vx += dx * pull;
        tst.vz += dz * pull;
        tst.vy += Math.max(-0.012, dy * pull * 0.6);
      }
    },

    updateHookPull() {
      const me = this.me;
      if (!me || !me.hookPull) return;
      if (this.state !== 'playing' || me.dead) { me.hookPull = null; return; }
      const h = me.hookPull;
      h.ttl--;
      if (h.ttl <= 0) { me.hookPull = null; return; }
      const src = this.remotes.get(h.by);
      const sx = src ? src.st.x : h.x;
      const sy = src ? src.st.y + 1.1 : h.y;
      const sz = src ? src.st.z : h.z;
      const dx = sx - me.st.x;
      const dy = sy - (me.st.y + 1.1);
      const dz = sz - me.st.z;
      const dist = Math.hypot(dx, dy, dz);
      if (dist > 1.8) {
        const pull = 0.18 / Math.max(1, dist);
        me.st.vx += dx * pull;
        me.st.vz += dz * pull;
        me.st.vy += Math.max(-0.012, dy * pull * 0.6);
      }
    },

    receiveHook(msg) {
      const me = this.me;
      if (!me || me.dead || me.finished || this.state !== 'playing' || !this.canFight()) return;
      if (!msg || msg.by === this.myId) return;
      me.hookPull = {
        by: msg.by || null,
        x: Number.isFinite(msg.x) ? msg.x : me.st.x,
        y: Number.isFinite(msg.y) ? msg.y : me.st.y + 1.1,
        z: Number.isFinite(msg.z) ? msg.z : me.st.z,
        ttl: Math.max(1, Math.min(60, msg.ttl || 32)),
      };
      me.hitFlash = 8;
      VOX.Audio.play('hookHit');
      this.world.spark(me.st.x, me.st.y + 1.1, me.st.z, 0x35e0e8, 7, 2.5);
    },

    receiveHookEnd(msg) {
      const me = this.me;
      if (!me || !me.hookPull) return;
      if (msg && msg.by && me.hookPull.by && msg.by !== me.hookPull.by) return;
      me.hookPull = null;
    },

    releaseGrapple(cooldown) {
      const me = this.me;
      if (this.playerHook) {
        const hook = this.playerHook;
        this.playerHook = null;
        if (this.multiplayer && hook.id !== 'bot') {
          this.net.send({ type: 'hook_end', victim: hook.id, by: this.myId });
        }
      }
      if (me && me.st) me.st.grapple = null;
      if (this.grappleRope) this.grappleRope.visible = false;
      if (cooldown !== false) this.grappleCD = Math.max(this.grappleCD || 0, 6);
    },

    updateGrappleVisual(rp) {
      const me = this.me;
      const rope = this.grappleRope;
      if (!rope) return;
      let g = me && me.st && me.st.grapple;
      if (this.playerHook) {
        const target = this.remotes.get(this.playerHook.id);
        if (target && !target.dead) g = { x: target.st.x, y: target.st.y + 1.1, z: target.st.z };
      }
      if (!g || this.state !== 'playing') { rope.visible = false; return; }
      const pos = rope.geometry.attributes.position;
      pos.setXYZ(0, rp.x, rp.y + 1.5, rp.z);
      pos.setXYZ(1, g.x, g.y, g.z);
      pos.needsUpdate = true;
      rope.visible = true;
    },

    selfPlayer(id) {
      return { id: id || this.myId, name: this.profile.name, skin: this.profile.skin, color: this.profile.color, team: 0 };
    },

    spawnFor(index) {
      if (this.level && (this.mode === 'solo' || this.mode === 'race')) {
        const s = this.level.spawns[index] || this.level.spawns[0];
        return { x: s.x, y: s.y, z: s.z, yaw: s.yaw || 0 };
      }
      const arena = this.arena;
      if (!arena) return { x: 0, y: 2, z: 0, yaw: 0 };
      let si = index;
      if (this.mode === 'team') {
        const meP = this.matchPlayers[index];
        const team = meP ? (meP.team & 1) : 0;
        const same = this.matchPlayers.filter((p) => (p.team & 1) === team);
        const k = same.indexOf(meP);
        si = (team === 0 ? 0 : 1) + (k > 0 ? 2 : 0);
      }
      const s = arena.spawns[si] || arena.spawns[0];
      const spawn = { x: s.x, y: s.y, z: s.z, yaw: s.yaw || 0 };
      return this.isPvp() ? this.sanitizeSpawn(spawn) : spawn;
    },

    sanitizeSpawn(spawn) {
      const x = spawn.x, z = spawn.z;
      let y = spawn.y, groundTop = -Infinity;
      const blocks = this.pworld || [];
      for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i];
        const th = b.th === undefined ? 1 : b.th;
        if (x <= b.x - b.w / 2 + 0.3 || x >= b.x + b.w / 2 - 0.3) continue;
        if (z <= b.z - b.d / 2 + 0.3 || z >= b.z + b.d / 2 - 0.3) continue;
        if (b.y <= y + 0.25 && b.y > groundTop) groundTop = b.y;
      }
      if (isFinite(groundTop)) y = Math.max(y, groundTop + 0.02);
      for (let pass = 0; pass < 10; pass++) {
        let blocked = false;
        for (let i = 0; i < blocks.length; i++) {
          const b = blocks[i];
          const th = b.th === undefined ? 1 : b.th;
          if (x <= b.x - b.w / 2 + 0.25 || x >= b.x + b.w / 2 - 0.25) continue;
          if (z <= b.z - b.d / 2 + 0.25 || z >= b.z + b.d / 2 - 0.25) continue;
          if (b.y - th < y + 1.9 && b.y > y + 0.2) { blocked = true; break; }
        }
        if (!blocked) break;
        y += 0.5;
      }
      return { x: x, y: y, z: z, yaw: spawn.yaw || 0 };
    },

    encloseMap(blocks) {
      if (!blocks || !blocks.length) return;
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, minY = Infinity, maxY = -Infinity;
      for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i];
        const th = b.th === undefined ? 1 : b.th;
        minX = Math.min(minX, b.x - b.w / 2);
        maxX = Math.max(maxX, b.x + b.w / 2);
        minZ = Math.min(minZ, b.z - b.d / 2);
        maxZ = Math.max(maxZ, b.z + b.d / 2);
        minY = Math.min(minY, b.y - th);
        maxY = Math.max(maxY, b.y);
      }
      if (!isFinite(minX)) return;

      const arenaId = this.arena ? this.arena.id : 'parkour';
      const palettes = {
        sky: { top: 'grass', wall: 'stone_brick' },
        courtyard: { top: 'grass', wall: 'stone_brick' },
        sumo: { top: 'planks', wall: 'stone_brick' },
        bridge: { top: 'wool_blue', wall: 'stone_brick' },
        inferno: { top: 'netherrack', wall: 'nether_brick' },
        frostbite: { top: 'snow', wall: 'prismarine' },
        citadel: { top: 'deepslate', wall: 'stone_brick' },
        dunes: { top: 'sandstone', wall: 'sandstone' },
        parkour: { top: (this.theme && this.theme.ground) || 'grass', wall: (this.theme && this.theme.accent) || 'stone_brick' },
      };
      const pal = palettes[arenaId] || palettes.parkour;
      const safeFloor = this.isPvp() && this.mode !== 'bridge';
      const margin = 6;
      const x0 = minX - margin, x1 = maxX + margin;
      const z0 = minZ - margin, z1 = maxZ + margin;
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      const baseTop = safeFloor ? minY - 0.05 : Math.max(this.voidY + 1, minY - 5);
      const baseTh = 2;
      const triggerTh = 1.2;
      const triggerTop = baseTop + triggerTh;
      const rimTop = baseTop + 3.5;
      const barrierTop = maxY + 8;
      const wallW = 1;

      blocks.push({
        x: cx, y: baseTop, z: cz, w: x1 - x0, d: z1 - z0, th: baseTh,
        t: pal.top, isEnclosure: true,
      });
      if (!safeFloor) {
        blocks.push({
          x: cx, y: triggerTop, z: cz, w: x1 - x0 - 2, d: z1 - z0 - 2, th: triggerTh,
          t: 'wall', hazard: true, isBasin: true, isEnclosure: true,
        });
      }

      const addRim = (x, z, w, d) => {
        blocks.push({ x: x, y: rimTop, z: z, w: w, d: d, th: rimTop - baseTop, t: pal.wall, isEnclosure: true });
        if (barrierTop > rimTop) {
          blocks.push({ x: x, y: barrierTop, z: z, w: w, d: d, th: barrierTop - rimTop, t: 'wall', isEnclosure: true });
        }
      };
      const sideD = z1 - z0;
      const endW = x1 - x0 - wallW;
      addRim(x0, cz, wallW, sideD);
      addRim(x1, cz, wallW, sideD);
      addRim(cx, z0, endW, wallW);
      addRim(cx, z1, endW, wallW);

      this.basinY = safeFloor ? this.voidY - 1 : triggerTop;
      this.enclosure = {
        baseTop: baseTop, rimTop: rimTop, wallTop: maxY + 10,
        x0: x0, x1: x1, z0: z0, z1: z1, wallType: pal.wall,
      };
    },

    setupMatch(config) {
      this.cleanupMatch();
      this.matchConfig = config;
      this.mode = config.mode;
      this.matchPlayers = config.players.map((p) => Object.assign({}, p));
      this.myIndex = Math.max(0, this.matchPlayers.findIndex((p) => p.id === this.myId));
      this.scores = {};
      this.matchPlayers.forEach((p) => { this.scores[p.id] = { kills: 0, deaths: 0 }; });
      this._statK = 0;
      this._statD = 0;
      this.raceResults = [];
      this.placedCount = 0;
      this.selected = 0;
      this.inspectId = null;
      this.swing = 0;
      this.attackCD = 0;
      this.attackBuffer = 0;
      this.spearCharge = 0;
      this.spearChargeActive = false;
      this.useCD = 0;
      this.boostCD = 0;
      this.grappleCD = 0;
      this.playerHook = null;
      this.arrows = [];
      this.arrowSeq = 0;
      this.slidePressed = false;
      this.grappleHeld = false;
      this.hitPause = 0;
      this.shake = 0;
      this.shakeT = 0;
      this.impactFlash = 0;
      this.moveT = 0;
      this.acc = 0;
      this.stepT = 0;
      this.hudAcc = 0;
      this.lastStateSent = 0;
      this.level = null;
      this.arena = null;

      const mode = config.mode;
      this.multiplayer = (mode === 'race' || mode === 'duel' || mode === 'team') && this.net.isConnected();
      let blocks;

      if (mode === 'solo' || mode === 'race') {
        const level = LG.generate(config.seed >>> 0, {
          difficulty: config.difficulty || 'standard',
          theme: config.theme || '',
        });
        this.level = level;
        blocks = level.blocks;
        this.theme = level.theme;
        this.levelName = level.name;
        this.cpTotal = level.checkpoints.length;
        this.voidY = P.CFG.voidY;
        this.allowBuild = false;
      } else {
        const arena = VOX.Arenas[config.arena] || VOX.Arenas.field;
        this.arena = arena;
        blocks = arena.build();
        this.theme = arena.theme;
        this.levelName = arena.name;
        this.cpTotal = 0;
        this.voidY = arena.voidY;
        this.allowBuild = mode === 'bridge' || (!!arena.allowBuild && mode !== 'sumo');
      }

      if (this.arena && this.arena.noEnclose) {
        this.basinY = this.voidY - 1;
        this.enclosure = null;
      } else {
        this.encloseMap(blocks);
      }

      this.blocks = blocks;
      this.pworld = blocks.filter((b) => !b.hazard);
      this.hazards = blocks.filter((b) => b.hazard);
      this.movers = blocks.filter((b) => b.mover);
      this.world.build(blocks, this.theme);
      if (this.level && this.enclosure) this.world.buildEnclosure(this.enclosure, this.enclosure.wallType);
      this.world.setQuality(this.settings.quality);

      const meInfo = this.matchPlayers[this.myIndex] || this.selfPlayer(this.myId);
      this.me = {
        id: this.myId, name: meInfo.name, skin: meInfo.skin, color: meInfo.color,
        team: meInfo.team & 1,
        st: P.createState(0, 2, 0), yaw: 0, pitch: 0,
        hp: C.MAX_HP, invuln: 0, lastHit: 0, hitFlash: 0,
        dead: false, deadUntil: 0, lastAttacker: null,
        cp: 0, falls: 0, finished: false, finishTime: 0,
        block: false, swing: 0, weapon: 'sword',
      };
      const spawn = this.spawnFor(this.myIndex);
      this.spawnPoint = { x: spawn.x, y: spawn.y, z: spawn.z, yaw: spawn.yaw };
      this.me.yaw = spawn.yaw;
      this.placeAtSpawn();

      this.localRig = VOX.Player.createPlayerRig({
        skin: this.profile.skin, name: this.profile.name,
        teamColor: this.myTeamColor(), showTag: true, swordTier: 'diamond',
      });
      this.localRig.root.position.set(spawn.x, spawn.y, spawn.z);
      if (mode === 'bridge') this.localRig.setHeldSlot(1, HOTBAR[this.selected].type);
      else if (this.localRig.setWeapon) this.localRig.setWeapon('sword');
      this.scene.add(this.localRig.root);
      this.localRig.root.visible = this.thirdPerson;

      this.viewmodel = VOX.Player.createViewmodel(this.profile.skin);
      if (this.viewmodel.holder) this.viewmodel.holder.scale.setScalar(0.46);
      if (mode === 'bridge') this.viewmodel.setSlot(1, HOTBAR[this.selected].type);
      else if (this.viewmodel.setWeapon) this.viewmodel.setWeapon('sword');

      this.remotes = new Map();
      this.bot = null;
      for (let i = 0; i < this.matchPlayers.length; i++) {
        const p = this.matchPlayers[i];
        if (p.id === this.myId) continue;
        const entry = this.makeRemote(p, this.spawnFor(i));
        this.remotes.set(p.id, entry);
        if (mode === 'bot') this.bot = entry;
      }

      this.state = mode === 'bridge' ? 'playing' : 'countdown';
      this.countdownEnd = performance.now() + 3300;
      this.lastCount = 99;
      this.matchStart = mode === 'bridge' ? performance.now() : 0;
      this.thirdPerson = !!this.settings.tp;

      VOX.UI.setHudMode(mode);
      VOX.UI.showHud(true);
      VOX.UI.hideOverlay();
      VOX.UI.hideCountdown();
      this.hud = {};
      this.buildHud(performance.now());
      VOX.UI.updateHUD(this);
      this.requestLock();
    },

    makeRemote(p, spawn) {
      const color = this.mode === 'team' ? TEAM_COLORS[p.team & 1] : (p.color || '#e9eff7');
      const rig = VOX.Player.createPlayerRig({
        skin: p.skin, name: p.name, teamColor: color, showTag: true, swordTier: 'iron',
      });
      rig.root.position.set(spawn.x, spawn.y, spawn.z);
      this.scene.add(rig.root);
      const st = P.createState(spawn.x, spawn.y, spawn.z);
      return {
        id: p.id, name: p.name, skin: p.skin, color: color, team: p.team & 1,
        st: st, rig: rig, hp: C.MAX_HP, invuln: 0, lastHit: 0, hitFlash: 0,
        dead: false, deadUntil: 0, lastAttacker: null,
        yaw: spawn.yaw || 0, targetYaw: spawn.yaw || 0, pitch: 0, swing: 0, block: false, weapon: 'sword',
        cur: { x: spawn.x, y: spawn.y, z: spawn.z },
        target: { x: spawn.x, y: spawn.y, z: spawn.z },
        vx: 0, vz: 0, ground: true, sprint: false,
        cp: 0, finished: false, finishTime: 0, _labelAt: 0,
      };
    },

    myTeamColor() {
      if (this.mode === 'team') return TEAM_COLORS[this.me ? (this.me.team & 1) : 0];
      return this.profile.color;
    },

    placeAtSpawn() {
      if (!this.me) return;
      const s = this.spawnPoint, st = this.me.st;
      st.x = s.x; st.y = s.y; st.z = s.z;
      st.vx = st.vy = st.vz = 0;
      st.ground = false; st.on = null; st.sprint = false; st.kb = true;
      this.me.yaw = s.yaw || 0;
      this.me.pitch = 0;
      this.lookYaw = this.targetYaw = this.me.yaw;
      this.lookPitch = this.targetPitch = 0;
      this.prevLocal = { x: s.x, y: s.y, z: s.z };
      this.acc = 0;
      st.slideT = 0;
      st.slideCD = 0;
      st.boostT = 0;
      st.grapple = null;
      st.airJumps = P.CFG.airJumps;
      st.coyote = 0;
      st.jumpCut = false;
      st.jumpBuffer = 0;
      st.jcd = 0;
      this.me.hookPull = null;
      this.slidePressed = false;
      this.grappleHeld = false;
      this.releaseGrapple(false);
    },

    manualRespawn() {
      if (!this.me) return;
      if (this.isPvp()) {
        if (!this.me.dead) this.pvpDeath('manual', null);
      } else {
        this.cancelSpearCharge();
        this.placeAtSpawn();
        VOX.Audio.play('respawn');
        VOX.UI.toast('Respawned', '#8be02a');
      }
    },

    startSolo() {
      this.leaveNet();
      this.myId = 'local';
      this.netMode = 'offline';
      const seed = LG.randomSeed();
      this.lastSolo = { seed: seed, difficulty: this.solo.difficulty, theme: this.solo.theme };
      this.setupMatch({
        mode: 'solo', seed: seed, difficulty: this.solo.difficulty, theme: this.solo.theme,
        players: [this.selfPlayer('local')],
      });
    },

    retrySolo() {
      if (!this.lastSolo) return this.startSolo();
      this.leaveNet();
      this.myId = 'local';
      this.netMode = 'offline';
      this.setupMatch({
        mode: 'solo', seed: this.lastSolo.seed, difficulty: this.lastSolo.difficulty,
        theme: this.lastSolo.theme, players: [this.selfPlayer('local')],
      });
    },

    startBot() {
      this.leaveNet();
      this.myId = 'local';
      this.netMode = 'offline';
      const seed = LG.randomSeed();
      const arena = this.solo.arena && VOX.Arenas[this.solo.arena] ? this.solo.arena : PVP_ARENAS[seed % PVP_ARENAS.length];
      this.setupMatch({
        mode: 'bot', seed: seed, arena: arena,
        players: [
          this.selfPlayer('local'),
          { id: 'bot', name: 'Trainer Bot', skin: 'shadow', color: '#ff6b5b', team: 1 },
        ],
      });
    },

    restartBot() { this.startBot(); },

    startBridge() {
      this.leaveNet();
      this.myId = 'local';
      this.netMode = 'offline';
      const seed = LG.randomSeed();
      this.setupMatch({
        mode: 'bridge', seed: seed, arena: 'bridge',
        players: [this.selfPlayer('local')],
      });
    },

    playerInfo() {
      return { name: this.profile.name, skin: this.profile.skin, color: this.profile.color };
    },

    isHost() { return !!this.room && this.room.hostId === this.myId; },

    roomCodeFromLocation() {
      const raw = new URLSearchParams(global.location.search).get('room') || (global.location.hash || '').replace(/^#/, '');
      const code = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (!code || code.length < 3 || code.length > 8) return null;
      return code;
    },

    inviteLink() {
      if (!this.room) return '';
      return global.location.origin + global.location.pathname + '?room=' + String(this.room.code).toUpperCase();
    },

    roomSnapshot() {
      if (!this.room) return null;
      return {
        code: this.room.code, mode: this.room.mode,
        difficulty: this.room.difficulty, theme: this.room.theme,
        arena: this.room.arena || '', seed: this.room.seed, hostId: this.room.hostId,
        players: this.room.players.map((p) => ({
          id: p.id, name: p.name, skin: p.skin, color: p.color, team: p.team,
          ready: !!p.ready, host: p.id === this.room.hostId,
          kills: p.kills || 0, deaths: p.deaths || 0,
        })),
      };
    },

    applyRoomSnapshot(snap) {
      if (!snap) return;
      this.room = {
        code: snap.code,
        mode: snap.mode || 'race',
        difficulty: snap.difficulty || 'standard',
        theme: snap.theme || '',
        arena: snap.arena || '',
        seed: (snap.seed >>> 0) || LG.randomSeed(),
        hostId: snap.hostId || null,
        players: (snap.players || []).map((p) => Object.assign({}, p)),
      };
      this.room.me = this.room.players.find((p) => p.id === this.myId) || null;
    },

    assignTeams() {
      if (!this.room) return;
      this.room.players.forEach((p, i) => { p.team = i % 2; });
    },

    upsertPlayer(id, info) {
      if (!this.room || !id) return;
      let p = this.room.players.find((x) => x.id === id);
      if (!p) {
        if (this.room.players.length >= 4) return;
        p = { id: id, name: 'Friend', skin: 'steve', color: '#ffd23f', team: 0, ready: false };
        this.room.players.push(p);
      }
      if (info.name) p.name = String(info.name).slice(0, 16);
      if (info.skin) p.skin = info.skin;
      if (info.color) p.color = info.color;
      p.host = id === this.room.hostId;
      this.assignTeams();
    },

    broadcastLobby() {
      if (!this.isHost() || !this.room) return;
      this.net.send({ type: 'lobby', room: this.roomSnapshot() });
    },

    refreshLobby() {
      if (this.state === 'lobby' && this.room) {
        this.room.me = this.room.players.find((p) => p.id === this.myId) || null;
        VOX.UI.showLobby();
      }
    },

    async createRoom() {
      if (this.busy) return;
      this.busy = true;
      try {
        this.leaveNet();
        this.cleanupMatch();
        VOX.UI.showConnecting('Creating roomâ€¦');
        const code = makeCode();
        let res;
        if (this.serverAvailable) {
          res = await this.net.connectWS(undefined, code, this.playerInfo());
          this.netMode = 'LAN';
        } else {
          res = await this.net.hostPeer(this.playerInfo(), code);
          this.netMode = 'PeerJS';
        }
        this.myId = res.id;
        this.room = {
          code: res.room || code,
          mode: 'race',
          difficulty: this.solo.difficulty || 'standard',
          theme: this.solo.theme || '',
          arena: '',
          seed: LG.randomSeed(),
          hostId: this.myId,
          players: [Object.assign(this.selfPlayer(this.myId), { host: true, ready: true })],
          me: null,
        };
        this.room.me = this.room.players[0];
        this.state = 'lobby';
        this.busy = false;
        if (this.serverAvailable) {
          this.net.send({ type: 'hello', name: this.profile.name, skin: this.profile.skin, color: this.profile.color });
        }
        VOX.UI.showLobby();
      } catch (e) {
        this.busy = false;
        this.leaveNet();
        this.state = 'menu';
        VOX.UI.showMenu();
        VOX.UI.toast(e && e.message ? e.message : 'Could not create room', '#ff5b5b');
      }
    },

    async joinRoom(code) {
      if (this.busy) return;
      this.busy = true;
      const clean = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      try {
        this.leaveNet();
        this.cleanupMatch();
        VOX.UI.showConnecting('Joining ' + clean + 'â€¦');
        let res;
        if (this.serverAvailable) {
          res = await this.net.connectWS(undefined, clean, this.playerInfo());
          this.netMode = 'LAN';
        } else {
          res = await this.net.joinPeer(clean, this.playerInfo());
          this.netMode = 'PeerJS';
        }
        this.myId = res.id;
        if (res.room && res.room.players) {
          this.applyRoomSnapshot(res.room);
        } else {
          this.room = {
            code: res.room || clean, mode: 'race', difficulty: 'standard', theme: '', arena: '',
            seed: LG.randomSeed(), hostId: res.isHost ? this.myId : null,
            players: [Object.assign(this.selfPlayer(this.myId), { host: !!res.isHost, ready: true })],
            me: null,
          };
          this.room.me = this.room.players[0];
        }
        if (!this.room.players.find((p) => p.id === this.myId)) {
          this.room.players.push(Object.assign(this.selfPlayer(this.myId), { ready: false }));
        }
        this.room.me = this.room.players.find((p) => p.id === this.myId) || null;
        this.state = 'lobby';
        this.busy = false;
        this.net.send({ type: 'hello', name: this.profile.name, skin: this.profile.skin, color: this.profile.color });
        VOX.UI.showLobby();
      } catch (e) {
        this.busy = false;
        this.leaveNet();
        this.state = 'menu';
        VOX.UI.showJoin();
        const msg = document.getElementById('joinMsg');
        if (msg) msg.innerHTML = '<div class="notice bad">' + esc(e && e.message ? e.message : 'Could not join room') + '</div>';
        const inp = document.getElementById('joinCode');
        if (inp) inp.value = clean;
      }
    },

    onPeerJoin(d) {
      if (!this.room || !this.isHost()) return;
      if (this.state !== 'lobby') {
        try {
          this.net.sendToClient(d.client.id, { type: 'room_closed' });
          setTimeout(() => { try { d.conn.close(); } catch (e) {} }, 180);
        } catch (e) {}
        return;
      }
      if (this.room.players.length >= 4) {
        try {
          this.net.sendToClient(d.client.id, { type: 'room_full' });
          setTimeout(() => { try { d.conn.close(); } catch (e) {} }, 180);
        } catch (e) {}
        return;
      }
      const id = d.client.id;
      this.upsertPlayer(id, { name: d.client.name, skin: d.client.skin, color: d.client.color });
      this.net.sendToClient(id, {
        type: 'welcome', id: id, isHost: false,
        hostId: this.room.hostId, room: this.roomSnapshot(),
      });
      this.broadcastLobby();
      this.refreshLobby();
    },

    setRoomMode(mode) {
      if (!this.isHost() || !this.room) return;
      this.room.mode = mode;
      this.assignTeams();
      this.broadcastLobby();
      this.refreshLobby();
    },

    setRoomOptions(o) {
      if (!this.isHost() || !this.room) return;
      Object.assign(this.room, o);
      this.broadcastLobby();
      this.refreshLobby();
    },

    toggleReady() {
      if (!this.room || this.isHost()) return;
      const me = this.room.players.find((p) => p.id === this.myId);
      if (!me) return;
      me.ready = !me.ready;
      this.room.me = me;
      this.net.send({ type: 'ready', ready: !!me.ready });
      this.refreshLobby();
    },

    startMatch() {
      if (!this.isHost() || !this.room) return;
      const mode = this.room.mode;
      const n = this.room.players.length;
      if (mode === 'race' && n < 1) return;
      if (mode === 'duel' && n !== 2) return;
      if (mode === 'team' && n !== 4) return;
      if (!this.room.players.every((p) => p.id === this.room.hostId || p.ready)) return;
      this.assignTeams();
      const seed = this.room.seed >>> 0;
      const picked = this.room.arena && VOX.Arenas[this.room.arena] ? this.room.arena : '';
      const arena = (mode === 'duel' || mode === 'team') ? (picked || PVP_ARENAS[seed % PVP_ARENAS.length]) : null;
      const config = {
        mode: mode, seed: seed, difficulty: this.room.difficulty, theme: this.room.theme,
        arena: arena,
        players: this.room.players.map((p) => ({
          id: p.id, name: p.name, skin: p.skin, color: p.color, team: p.team & 1,
        })),
      };
      this.multiplayer = true;
      this.net.send({ type: 'start', match: config });
      this.beginNetMatch(config);
    },

    hostRematch() {
      if (!this.isHost() || !this.room) return;
      if (this.raceTimeout) { clearTimeout(this.raceTimeout); this.raceTimeout = null; }
      const mode = this.room.mode;
      const seed = this.room.seed >>> 0;
      const picked = this.room.arena && VOX.Arenas[this.room.arena] ? this.room.arena : '';
      const arena = (mode === 'duel' || mode === 'team') ? (picked || PVP_ARENAS[seed % PVP_ARENAS.length]) : null;
      const config = {
        mode: mode, seed: seed, difficulty: this.room.difficulty, theme: this.room.theme,
        arena: arena,
        players: this.room.players.map((p) => ({
          id: p.id, name: p.name, skin: p.skin, color: p.color, team: p.team & 1,
        })),
      };
      this.multiplayer = true;
      this.net.send({ type: 'start', match: config });
      this.beginNetMatch(config);
    },

    rematchOffline() {
      if (this.mode === 'solo') return this.retrySolo();
      if (this.mode === 'bot') return this.restartBot();
      this.startBridge();
    },

    beginNetMatch(config) {
      this.multiplayer = true;
      this.matchConfig = config;
      this.setupMatch(config);
    },

    updateCountdown(now) {
      if (!this.countdownEnd) return;
      const rem = (this.countdownEnd - now) / 1000;
      const n = Math.min(3, Math.ceil(rem));
      if (n !== this.lastCount) {
        this.lastCount = n;
        if (n > 0) {
          VOX.UI.setCountdown(String(n));
          VOX.Audio.play('count');
        } else this.beginPlay();
      }
    },

    beginPlay() {
      this.state = 'playing';
      this.matchStart = performance.now();
      this.acc = 0;
      this.countdownEnd = 0;
      VOX.UI.setCountdown(null);
      VOX.UI.toast('GO!', '#8be02a');
      VOX.Audio.play('go');
      if (this.mode === 'solo') { this.stats.runs++; this.saveProfile(); }
      this.buildHud(performance.now());
      VOX.UI.updateHUD(this);
    },

    onNet(msg) {
      if (!msg || !msg.type) return;
      const t = msg.type;
      if (t === 'hello') {
        if (this.isHost() && this.state === 'lobby') {
          this.upsertPlayer(msg.id, { name: msg.name, skin: msg.skin, color: msg.color });
          this.net.sendTo(msg.id, {
            type: 'welcome', id: msg.id, isHost: false,
            hostId: this.room.hostId, room: this.roomSnapshot(),
          });
          this.broadcastLobby();
          this.refreshLobby();
        }
        return;
      }
      if (t === 'lobby') {
        if (this.state === 'lobby' && msg.room) {
          this.applyRoomSnapshot(msg.room);
          VOX.UI.showLobby();
        }
        return;
      }
      if (t === 'ready') {
        if (this.isHost() && this.state === 'lobby') {
          const p = this.room.players.find((x) => x.id === msg.id);
          if (p) { p.ready = !!msg.ready; this.broadcastLobby(); this.refreshLobby(); }
        }
        return;
      }
      if (t === 'player_joined') {
        if (this.isHost()) this.net.send({ type: 'hello', name: this.profile.name, skin: this.profile.skin, color: this.profile.color });
        return;
      }
      if (t === 'start') {
        if (msg.match) this.beginNetMatch(msg.match);
        return;
      }
      if (t === 'state') { this.onRemoteState(msg); return; }
      if (t === 'hit') {
        if (msg.victim === this.myId) this.receiveHit(msg);
        return;
      }
      if (t === 'bump') {
        if (msg.victim === this.myId) this.receiveBump(msg);
        return;
      }
      if (t === 'arrow') {
        this.onRemoteArrow(msg);
        return;
      }
      if (t === 'arrow_end') {
        this.onRemoteArrowEnd(msg);
        return;
      }
      if (t === 'hook') {
        if (msg.victim === this.myId) this.receiveHook(msg);
        return;
      }
      if (t === 'hook_end') {
        if (msg.victim === this.myId) this.receiveHookEnd(msg);
        return;
      }
      if (t === 'death') {
        if (this.isHost() && this.state === 'playing') {
          this.hostResolveDeath(msg.id, msg.by || null, msg.cause || 'kill');
        }
        return;
      }
      if (t === 'kill') {
        if (this.state !== 'playing') return;
        if (msg.scores) this.setScores(msg.scores);
        this.killFeed(msg.killer, msg.victim, msg.cause);
        return;
      }
      if (t === 'match_over') {
        if (msg.result) this.endPvpMatch(msg.result);
        return;
      }
      if (t === 'finish') {
        if (this.isHost() && this.state === 'playing') this.recordFinish(msg.id, msg.time, msg.falls);
        return;
      }
      if (t === 'finish_list') {
        if (msg.results) this.raceResults = msg.results;
        return;
      }
      if (t === 'race_over') {
        if (msg.result) {
          this.state = 'finished';
          this.raceResults = msg.result.results || [];
          this.showRaceResults(msg.result);
        }
        return;
      }
      if (t === 'block_place') {
        if (msg.b) {
          for (const b of this.blocks) {
            if (Math.abs(b.x - msg.b.x) < 0.01 && Math.abs(b.y - msg.b.y) < 0.01 && Math.abs(b.z - msg.b.z) < 0.01) return;
          }
          this.onRemotePlace(msg.b);
        }
        return;
      }
      if (t === 'block_break') {
        if (msg.b) this.onRemoteBreak(msg.b);
        return;
      }
      if (t === 'player_left') {
        if (msg.id) this.removePlayer(msg.id);
        if (this.isHost() && this.state === 'lobby') this.broadcastLobby();
        return;
      }
      if (t === 'host_changed') {
        if (this.room) {
          this.room.hostId = msg.hostId || msg.id || null;
          if (this.room.me) this.room.me.host = this.room.me.id === this.room.hostId;
          if (this.state === 'lobby') this.refreshLobby();
          else if (this.room.hostId === this.myId) VOX.UI.toast('You are the host now', '#ffd23f');
        }
        return;
      }
      if (t === 'room_full') {
        VOX.UI.toast('Room is full', '#ff5b5b');
        this.leaveRoom();
        return;
      }
      if (t === 'welcome') {
        if (msg.room && this.state === 'lobby' && !this.room) this.applyRoomSnapshot(msg.room);
        return;
      }
    },

    onDisconnect(why) {
      if (this.state !== 'lobby' && this.state !== 'playing' && this.state !== 'countdown') return;
      VOX.UI.toast(why || 'Connection lost', '#ff5b5b');
      this.leaveRoom();
    },

    onRemoteState(msg) {
      if (!this.me || !this.remotes) return;
      const id = msg.sid || msg.id;
      if (!id || id === this.myId) return;
      const e = this.remotes.get(id);
      if (!e) return;
      if (msg.dead !== undefined) e.dead = !!msg.dead;
      if (msg.hp !== undefined) e.hp = msg.hp;
      if (msg.cp !== undefined) e.cp = msg.cp;
      if (msg.finished !== undefined) e.finished = !!msg.finished;
      if (msg.finishTime !== undefined) e.finishTime = msg.finishTime;
      e.target.x = msg.x; e.target.y = msg.y; e.target.z = msg.z;
      e.st.x = msg.x; e.st.y = msg.y; e.st.z = msg.z;
      e.st.vx = msg.vx || 0; e.st.vz = msg.vz || 0;
      e.st.ground = !!msg.ground;
      e.st.sprint = !!msg.sprint;
      e.vx = msg.vx || 0; e.vz = msg.vz || 0;
      e.targetYaw = msg.yaw || 0;
      e.pitch = msg.pitch || 0;
      e.swing = Math.max(0, msg.swing || 0);
      e.block = !!msg.block;
      e.weapon = msg.weapon || 'sword';
      e.st.slideT = msg.slide ? 1 : 0;
      if (!msg.dead) e.rig.root.visible = true;
    },

    sendState(now) {
      if (!this.multiplayer || !this.me || this.state !== 'playing') return;
      if (now - this.lastStateSent < 55) return;
      this.lastStateSent = now;
      const me = this.me, st = me.st;
      this.net.send({
        type: 'state', sid: this.myId,
        x: st.x, y: st.y, z: st.z, vx: st.vx, vz: st.vz,
        yaw: me.yaw, pitch: me.pitch, sprint: !!st.sprint, ground: !!st.ground,
        dead: !!me.dead, hp: Math.max(0, me.hp), cp: me.cp,
        finished: !!me.finished, finishTime: me.finishTime,
        swing: this.swing, block: !!me.block,
        weapon: me.weapon, slide: st.slideT > 0,
      });
    },

    removePlayer(id) {
      if (this.room) {
        this.room.players = this.room.players.filter((p) => p.id !== id);
        this.room.me = this.room.players.find((p) => p.id === this.myId) || null;
      }
      const e = this.remotes && this.remotes.get(id);
      if (e) {
        if (e.rig) {
          this.scene.remove(e.rig.root);
          if (e.rig.dispose) e.rig.dispose();
        }
        this.remotes.delete(id);
        if (this.bot === e) this.bot = null;
      }
      if (this.mode === 'race') {
        const p = this.matchPlayers.find((x) => x.id === id);
        if (p) p.left = true;
      }
      if (this.state === 'playing' && this.isPvp() && this.mode === 'duel') {
        const rem = this.matchPlayers.find((p) => p.id !== id && p.id !== this.myId);
        if (this.isHost()) this.hostEndMatch(this.matchPlayers.find((p) => p.id !== id) ? this.matchPlayers.find((p) => p.id !== id).id : this.myId, null);
      }
    },

    leaveNet() {
      if (this.room && this.room.players) {
        const meP = this.room.players.find((p) => p.id === this.myId);
        if (meP) meP.ready = false;
      }
      if (this.net) this.net.disconnect();
      this.myId = 'local';
      this.netMode = 'offline';
      this.room = null;
    },

    leaveRoom() {
      if (this.raceTimeout) { clearTimeout(this.raceTimeout); this.raceTimeout = null; }
      this.cleanupMatch();
      this.leaveNet();
      this.state = 'menu';
      this.mode = null;
      this.me = null;
      VOX.UI.hideCountdown();
      VOX.UI.showMenu();
    },

    toMenu() {
      this.leaveRoom();
    },

    toLobby() {
      if (this.raceTimeout) { clearTimeout(this.raceTimeout); this.raceTimeout = null; }
      this.cleanupMatch();
      if (!this.room) return this.leaveRoom();
      this.state = 'lobby';
      VOX.UI.showHud(false);
      VOX.UI.hideCountdown();
      this.refreshLobby();
    },

    recordFinish(id, time, falls) {
      if (!this.isHost() || this.state !== 'playing') return;
      if (this.raceResults.find((r) => r.id === id)) return;
      const p = this.matchPlayers.find((x) => x.id === id);
      this.raceResults.push({
        id: id, name: p ? p.name : this.nameOf(id), color: p ? p.color : '#e9eff7',
        time: time, falls: falls || 0,
      });
      this.raceResults.sort((a, b) => a.time - b.time);
      this.net.send({ type: 'finish_list', results: this.raceResults });
      if (!this.raceTimeout) {
        this.raceTimeout = setTimeout(() => this.hostEndRace(), 90000);
      }
      this.checkRaceDone();
    },

    checkRaceDone() {
      if (!this.isHost() || this.state !== 'playing') return;
      if (this.raceResults.length >= this.matchPlayers.length) this.hostEndRace();
    },

    hostEndRace() {
      if (!this.isHost() || this.state === 'finished') return;
      if (this.raceTimeout) { clearTimeout(this.raceTimeout); this.raceTimeout = null; }
      const results = this.raceResults.map((r) => Object.assign({}, r));
      this.matchPlayers.forEach((p) => {
        if (!results.find((r) => r.id === p.id)) {
          results.push({ id: p.id, name: p.name, color: p.color, time: null, falls: 0, dnf: true });
        }
      });
      results.sort((a, b) => (a.dnf ? 1e9 : a.time) - (b.dnf ? 1e9 : b.time));
      const result = { mode: 'race', results: results };
      this.state = 'finished';
      this.net.send({ type: 'race_over', result: result });
      this.raceResults = results;
      this.showRaceResults(result);
    },

    onLocalFinish(t) {
      const me = this.me;
      if (this.mode === 'solo') {
        this.state = 'finished';
        this.stats.finishes = (this.stats.finishes || 0) + 1;
        const isBest = !this.stats.bestTime || t < this.stats.bestTime;
        if (isBest) this.stats.bestTime = t;
        this.saveProfile();
        VOX.Audio.play('win');
        this.showSoloResults(t, isBest);
        return;
      }
      if (this.mode !== 'race') return;
      this.stats.finishes = (this.stats.finishes || 0) + 1;
      this.saveProfile();
      VOX.Audio.play('win');
      VOX.UI.toast('Finished!', '#ffd23f', fmtTime(t));
      if (this.multiplayer) {
        if (this.isHost()) this.recordFinish(this.myId, t, me.falls);
        else this.net.send({ type: 'finish', time: t, falls: me.falls });
      }
    },

    showPause() {
      this.cancelSpearCharge();
      if (this.state !== 'paused') {
        this.pauseFrom = (this.state === 'countdown') ? 'countdown' : 'playing';
        this.state = 'paused';
        this.pauseStart = performance.now();
      }
      if (document.pointerLockElement) document.exitPointerLock();
      VOX.UI.showHud(false);
      VOX.UI.hideCountdown();
      const ov = document.getElementById('overlay');
      ov.style.display = 'flex';
      ov.innerHTML =
        '<div class="shell" style="max-width:460px;margin:auto"><div class="panel"><h2>Paused</h2>' +
        '<p class="sub">' + esc(this.levelName || '') + (this.room ? ' Â· room ' + esc(this.room.code) : '') + '</p>' +
        '<div class="actions"><button class="pri" id="pauseResume">Resume</button>' +
        '<button id="pauseSettings">Settings</button>' +
        '<button id="pauseControls">Controls</button>' +
        '<button class="danger" id="pauseLeave">' + (this.room ? 'Leave Room' : 'Quit to Menu') + '</button></div>' +
        '<div class="notice" style="margin-top:12px">' + (this.mode === 'race' || this.mode === 'solo' ? 'The timer is paused.' : 'The match is paused.') + '</div></div></div>';
      document.getElementById('pauseResume').onclick = () => this.resumeGame();
      document.getElementById('pauseSettings').onclick = () => VOX.UI.showSettings(() => this.showPause());
      document.getElementById('pauseControls').onclick = () => VOX.UI.showControls(() => this.showPause());
      document.getElementById('pauseLeave').onclick = () => this.leaveRoom();
    },

    resumeGame() {
      if (this.state !== 'paused') return;
      const now = performance.now();
      const delta = now - this.pauseStart;
      if (this.pauseFrom === 'countdown' && this.countdownEnd) this.countdownEnd += delta;
      if (this.matchStart) this.matchStart += delta;
      this.state = this.pauseFrom || 'playing';
      if (this.state === 'countdown') this.lastCount = 99;
      VOX.UI.hideOverlay();
      VOX.UI.showHud(true);
      this.last = now;
      this.requestLock();
      VOX.UI.toast('Resumed', '#8be02a');
    },

    cleanupMatch() {
      if (this.raceTimeout) { clearTimeout(this.raceTimeout); this.raceTimeout = null; }
      if (this.localRig) {
        this.scene.remove(this.localRig.root);
        this.localRig = null;
      }
      if (this.remotes) {
        this.remotes.forEach((e) => {
          if (e.rig) this.scene.remove(e.rig.root);
        });
        this.remotes = new Map();
      }
      this.bot = null;
      this.viewmodel = null;
      this.releaseGrapple(false);
      this.playerHook = null;
      if (this.arrows) {
        for (let i = this.arrows.length - 1; i >= 0; i--) this.finishArrow(this.arrows[i], false);
        this.arrows = [];
      }
      this.attackBuffer = 0;
      this.cancelSpearCharge();
      this.inspectId = null;
      this.grappleHeld = false;
      this.slidePressed = false;
      this.me = null;
      this.level = null;
      this.arena = null;
      this.movers = [];
      this.blocks = [];
      this.pworld = [];
      this.hazards = [];
      this.basinY = null;
      this.enclosure = null;
      this.hud = {};
      this.mouseLeft = false;
      this.mouseRight = false;
      this.jumpPressed = false;
      if (this.world) this.world.clear();
      VOX.UI.showHud(false);
      VOX.UI.hideCountdown();
      const hint = document.getElementById('hint');
      if (hint) hint.style.display = 'none';
    },

    teamKills(team) {
      let n = 0;
      (this.matchPlayers || []).forEach((p) => {
        if ((p.team & 1) === (team & 1) && this.scores[p.id]) n += this.scores[p.id].kills || 0;
      });
      return n;
    },

    raceProgress(z, finished) {
      if (finished) return 100;
      if (!this.level || !this.level.finishZ) return 0;
      return clamp((-z / Math.abs(this.level.finishZ)) * 100, 0, 99.5);
    },

    buildHud(now) {
      const me = this.me;
      if (!me) return;
      const pvp = this.isPvp();
      let time = 0;
      if (this.mode === 'solo' || this.mode === 'race') {
        if (me.finished) time = me.finishTime;
        else if (this.state === 'playing') time = (now - this.matchStart) / 1000;
      } else if (this.state === 'playing' && this.matchStart) {
        time = (now - this.matchStart) / 1000;
      }
      const h = {
        time: pvp ? clock(time) : fmtTime(time),
        levelName: this.levelName || 'VOX Arena',
        cpText: (this.mode === 'solo' || this.mode === 'race')
          ? 'CP ' + me.cp + ' / ' + this.cpTotal + (me.falls ? ' Â· falls ' + me.falls : '')
          : '',
        pos: 'X ' + me.st.x.toFixed(1) + ' Â· Y ' + me.st.y.toFixed(1) + ' Â· Z ' + me.st.z.toFixed(1),
        speed: (Math.hypot(me.st.vx, me.st.vz) * TPS).toFixed(1) + ' m/s',
        ping: this.multiplayer ? (this.ping ? this.ping + ' ms' : (this.netMode || '')) : '',
        hotbar: null,
        racebars: null,
        hint: '',
        crosshair: !!this.settings.xh,
        chargeActive: false,
        charge: 0,
        chargeReady: false,
      };
      if (pvp) {
        h.hp = me.hp;
        h.maxHp = C.MAX_HP;
        const mine = this.scores[this.myId] || { kills: 0, deaths: 0 };
        if (this.mode === 'team') {
          h.scoreText = 'CYAN ' + this.teamKills(0) + ' â€” ' + this.teamKills(1) + ' RED Â· you ' + mine.kills + ' KO';
        } else if (this.mode === 'bot') {
          const b = this.scores.bot || { kills: 0 };
          h.scoreText = 'KOs ' + mine.kills + ' / 5 Â· Bot ' + (b.kills || 0) + ' / 5';
        } else {
          let opp = null;
          this.matchPlayers.forEach((p) => { if (p.id !== this.myId) opp = this.scores[p.id]; });
          h.scoreText = 'KOs ' + mine.kills + ' / 5' + (opp ? ' Â· rival ' + opp.kills + ' / 5' : '');
        }
      }
      if (this.mode === 'race') {
        h.racebars = this.matchPlayers.map((p, i) => {
          if (p.id === this.myId) {
            return { name: this.profile.name, progress: this.raceProgress(me.st.z, me.finished), me: true, color: this.profile.color };
          }
          const e = this.remotes && this.remotes.get(p.id);
          return {
            name: p.name,
            progress: e ? this.raceProgress(e.st.z, e.finished) : 0,
            me: false,
            color: p.color || '#e9eff7',
          };
        });
      }
      if (this.mode === 'bridge') {
        h.hotbar = HOTBAR.map((b, i) => ({ label: b.label, color: b.color, selected: i === this.selected }));
        h.hint = '<kbd>LMB</kbd> break | <kbd>RMB</kbd> place | <kbd>1-5</kbd> blocks | <kbd>C</kbd> slide | <kbd>Space</kbd>x2 jump | <kbd>E</kbd> hook';
      } else {
        h.hotbar = WEAPON_SLOTS.map((w) => ({ label: w.label, color: w.color, selected: me.weapon === w.id }));
        if (pvp) {
          h.hint = '<kbd>1-4</kbd> weapons | <kbd>LMB</kbd> attack | <kbd>RMB</kbd> spear charge / block | <kbd>C</kbd> slide | <kbd>Space</kbd>x2 jump';
        } else if (this.mode === 'race') {
          h.hint = '<kbd>1-4</kbd> weapons | <kbd>LMB</kbd> bump rivals | <kbd>RMB</kbd> spear charge | <kbd>C</kbd> slide | <kbd>E</kbd> grapple';
        } else {
          h.hint = '<kbd>1-4</kbd> sword / spear / hook / bow | <kbd>Space</kbd>x2 jump | <kbd>C</kbd> slide | <kbd>E</kbd> grapple | <kbd>R</kbd> retry';
        }
      }
      if (this.spearChargeActive) {
        const sw = C.weapon('spear');
        h.chargeActive = true;
        h.charge = this.spearCharge / sw.chargeMax;
        h.chargeReady = this.spearCharge >= sw.chargeMin;
      }
      if (me.dead) h.crosshair = false;
      this.hud = h;
    },

    showSoloResults(t, isBest) {
      const self = this;
      VOX.UI.showResults({
        title: 'COURSE COMPLETE',
        subtitle: this.levelName + ' Â· seed ' + (this.level ? this.level.seed : ''),
        note: isBest ? '<div class="notice good" style="margin-bottom:12px">New personal best!</div>' : '',
        stats: [
          { value: fmtTime(t), label: 'this run' },
          { value: fmtTime(this.stats.bestTime || t), label: 'personal best' },
          { value: String(this.me ? this.me.falls : 0), label: 'falls' },
          { value: String(this.cpTotal), label: 'checkpoints' },
        ],
        actions: [
          { label: 'Run Same Seed', fn: () => this.retrySolo(), pri: true },
          { label: 'New Course', fn: () => this.startSolo() },
          { label: 'Menu', fn: () => this.leaveRoom() },
        ],
      });
      this.saveProfile();
    },

    showRaceResults(result) {
      const rows = (result.results || this.raceResults || []).map((r, i) => ({
        rank: i + 1, name: r.name, tag: r.id === this.myId ? 'you' : '',
        value: r.dnf ? 'DNF' : fmtTime(r.time),
        first: i === 0 && !r.dnf,
      }));
      const mine = (result.results || []).find((r) => r.id === this.myId);
      const place = (result.results || []).findIndex((r) => r.id === this.myId) + 1;
      const actions = [];
      if (this.room && this.isHost()) {
        actions.push({ label: 'Rematch', fn: () => this.hostRematch(), pri: true });
        actions.push({
          label: 'New Course',
          fn: () => {
            if (!this.room) return;
            this.room.seed = LG.randomSeed();
            this.broadcastLobby();
            this.hostRematch();
          },
        });
        actions.push({ label: 'Lobby', fn: () => this.toLobby() });
      } else if (this.room) {
        actions.push({ label: 'Back to Lobby', fn: () => this.toLobby(), pri: true });
        actions.push({ label: 'Leave', fn: () => this.leaveRoom() });
      } else {
        actions.push({ label: 'Menu', fn: () => this.leaveRoom(), pri: true });
      }
      VOX.UI.showResults({
        title: place === 1 && mine && !mine.dnf ? 'YOU WIN' : 'RACE RESULTS',
        subtitle: this.levelName + ' Â· ' + (this.room ? 'room ' + this.room.code : 'race'),
        rows: rows,
        stats: [
          { value: mine && !mine.dnf ? fmtTime(mine.time) : 'DNF', label: 'your time' },
          { value: place ? ordinal(place) : 'â€”', label: 'placement' },
          { value: String(mine ? mine.falls : 0), label: 'falls' },
        ],
        actions: actions,
      });
    },

    showPvpResults(result) {
      const scores = result.scores || this.scoresSnapshot();
      const list = this.matchPlayers
        .map((p) => ({ p: p, s: scores[p.id] || { kills: 0, deaths: 0 } }))
        .sort((a, b) => b.s.kills - a.s.kills || a.s.deaths - b.s.deaths);
      const rows = list.map((r, i) => ({
        rank: i + 1, name: r.p.name, tag: r.p.id === this.myId ? 'you' : '',
        value: r.s.kills + ' KO Â· ' + r.s.deaths + ' deaths', first: i === 0,
      }));
      const mine = scores[this.myId] || { kills: 0, deaths: 0 };
      let title = result.title || 'MATCH RESULTS';
      if (!result.title) {
        if (result.winnerTeam !== undefined && result.winnerTeam !== null) {
          title = (result.winnerTeam === 0 ? 'CYAN TEAM' : 'RED TEAM') + ' WINS';
        } else if (result.winnerId) title = this.nameOf(result.winnerId) + ' WINS';
      }
      const actions = [];
      if (this.mode === 'bot') {
        actions.push({ label: 'Rematch Bot', fn: () => this.restartBot(), pri: true });
        actions.push({ label: 'Menu', fn: () => this.leaveRoom() });
      } else if (this.room && this.isHost()) {
        actions.push({ label: 'Rematch', fn: () => this.hostRematch(), pri: true });
        actions.push({ label: 'Lobby', fn: () => this.toLobby() });
      } else if (this.room) {
        actions.push({ label: 'Back to Lobby', fn: () => this.toLobby(), pri: true });
        actions.push({ label: 'Leave', fn: () => this.leaveRoom() });
      } else {
        actions.push({ label: 'Menu', fn: () => this.leaveRoom(), pri: true });
      }
      VOX.UI.showResults({
        title: title,
        subtitle: (this.levelName || '') + ' Â· first to ' + (this.mode === 'team' ? '15 team KOs' : '5 KOs'),
        rows: rows,
        stats: [
          { value: String(mine.kills), label: 'your knockouts' },
          { value: String(mine.deaths), label: 'your deaths' },
          { value: String(this.teamKills ? this.teamKills(0) + 'â€“' + this.teamKills(1) : 'â€”'), label: 'cyanâ€“red' },
        ],
        actions: actions,
      });
    },

    syncRigs(dt, now) {
      const me = this.me;
      if (me && this.localRig) {
        const st = me.st;
        const rp = this.localRenderPos();
        this.localRig.root.position.set(rp.x, rp.y, rp.z);
        const speed = Math.hypot(st.vx, st.vz) * TPS;
        this.localRig.animate(dt, {
          speed: speed, yaw: me.yaw, pitch: me.pitch,
          sneak: !!this.keys.ShiftLeft || !!this.keys.ShiftRight,
          sprint: !!st.sprint, ground: !!st.ground, slide: st.slideT > 0,
          swing: this.swing, block: !!me.block, weapon: this.mode === 'bridge' ? null : me.weapon,
        });
        this.localRig.root.visible = this.thirdPerson && !me.dead;
        if (this.localRig.setHurtFlash) this.localRig.setHurtFlash(me.hitFlash > 0 ? 1 : 0);
      }
      if (this.remotes) {
        this.remotes.forEach((e) => {
          if (!e.rig) return;
          const k = Math.min(1, dt * 16);
          e.cur.x += (e.target.x - e.cur.x) * k;
          e.cur.y += (e.target.y - e.cur.y) * k;
          e.cur.z += (e.target.z - e.cur.z) * k;
          e.yaw += angleTo(e.yaw, e.targetYaw || 0) * Math.min(1, dt * 18);
          e.rig.root.position.set(e.cur.x, e.cur.y, e.cur.z);
          const speed = Math.hypot(e.vx || 0, e.vz || 0) * TPS;
          e.swing = Math.max(0, (e.swing || 0) - dt * 5);
          e.rig.animate(dt, {
            speed: speed, yaw: e.yaw, pitch: e.pitch || 0,
            sneak: false, sprint: !!e.st.sprint, ground: !!e.st.ground, slide: !!e.st.slideT,
            swing: e.swing, block: !!e.block, weapon: this.mode === 'bridge' ? null : e.weapon,
          });
          e.rig.root.visible = !e.dead;
          if (e.rig.setHurtFlash) e.rig.setHurtFlash(e.hitFlash > 0 ? 1 : 0);
          if (e.hitFlash > 0) e.hitFlash--;
          if (!e._labelAt || now - e._labelAt > 400) {
            e._labelAt = now;
            e.rig.setLabel(e.name, Math.max(0, e.hp), C.MAX_HP);
          }
        });
      }
    },

    render(dt, now) {
      const me = this.me;
      if (!me) {
        const c = this.camera;
        const a = now * 0.00012;
        c.position.set(Math.sin(a) * 16, 8, Math.cos(a) * 16);
        c.lookAt(0, 2, 0);
        if (this.world) this.world.update(dt, c, null);
        this.renderer.clear();
        this.renderer.render(this.scene, c);
        return;
      }
      const st = me.st;
      const rp = this.localRenderPos();
      const sneak = !!this.keys.ShiftLeft || !!this.keys.ShiftRight;
      const sliding = st.slideT > 0;
      const eyeY = rp.y + (sliding ? 1.02 : sneak ? 1.52 : 1.62);
      const speed = Math.hypot(st.vx, st.vz) * TPS;
      let bobX = 0, bobY = 0;
      if (this.settings.bob && st.ground && !sliding && speed > 0.4) {
        const t = now * 0.001 * (st.sprint ? 14 : 10);
        bobX = Math.cos(t) * 0.02 * Math.min(1, speed / 7);
        bobY = Math.abs(Math.sin(t)) * 0.016 * Math.min(1, speed / 7);
      }
      this.updateGrappleVisual(rp);
      if (this.inspectId) {
        const inspectTarget = this.remotes.get(this.inspectId) || (this.mode === 'bot' && this.bot && this.bot.id === this.inspectId ? this.bot : null);
        if (inspectTarget && !inspectTarget.dead && !inspectTarget.finished) {
          const it = inspectTarget.cur || inspectTarget.st;
          const inspectEyeY = it.y + (it.slideT > 0 ? 1.02 : 0) + 1.62;
          this.camera.position.set(it.x, inspectEyeY, it.z);
          this.camera.rotation.set(inspectTarget.pitch || 0, inspectTarget.yaw || 0, 0);
        } else {
          this.inspectId = null;
        }
      }
      if (!this.inspectId && !this.thirdPerson) {
        this.camera.position.set(rp.x + bobX, eyeY + bobY, rp.z);
        this.camera.rotation.set(me.pitch, me.yaw, sliding ? -0.06 : 0);
      } else if (!this.inspectId && this.thirdPerson) {
        const dir = C.dirFrom(me.yaw, me.pitch);
        const tx = rp.x, ty = eyeY - 0.2, tz = rp.z;
        this.camera.position.set(tx - dir.x * 4.2, ty - dir.y * 4.2 + 0.9, tz - dir.z * 4.2);
        this.camera.lookAt(tx, ty, tz);
      }
      if (this.shakeT > 0) {
        this.shakeT = Math.max(0, this.shakeT - dt);
        const amp = this.shake * (this.shakeT / this.shakeDur);
        this.camera.position.x += (Math.random() * 2 - 1) * amp;
        this.camera.position.y += (Math.random() * 2 - 1) * amp;
        this.camera.position.z += (Math.random() * 2 - 1) * amp;
      }
      if (this.impactFlash > 0) this.impactFlash = Math.max(0, this.impactFlash - dt);
      const speedFov = this.settings.fovk ? Math.min(7, Math.max(0, speed - 5) * 0.7) : 0;
      const targetFov = this.settings.fov + speedFov + (sliding ? 3 : 0) + (this.impactFlash > 0 ? 1.5 : 0);
      if (Math.abs(this.camera.fov - targetFov) > 0.05) {
        this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 8);
        this.camera.updateProjectionMatrix();
      }
      if (this.world) this.world.update(dt, this.camera, { x: rp.x, y: rp.y, z: rp.z });
      this.renderer.clear();
      this.renderer.render(this.scene, this.camera);
      if (!this.thirdPerson && this.viewmodel && !me.dead) {
        this.viewmodel.update(dt, this.camera.aspect, {
          speed: speed, ground: !!st.ground, sprint: !!st.sprint,
          swing: this.swing || 0, block: !!me.block, eat: 0,
          slide: sliding, weapon: this.mode === 'bridge' ? null : me.weapon,
        });
        this.renderer.clearDepth();
        this.renderer.render(this.viewmodel.scene, this.viewmodel.camera);
      }
    }
  };

  VOX.App = App;
})(window);





