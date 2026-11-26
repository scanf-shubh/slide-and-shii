// Menus, lobby, HUD and results. All actions call back into the game app.
(function (global) {
  const VOX = (global.VOX = global.VOX || {});
  const $ = (id) => document.getElementById(id);

  const COLORS = ['#35e0e8', '#8be02a', '#ff6b5b', '#ffd23f', '#b48cff', '#ff8ccb'];

  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  const UI = {
    app: null,
    lastBars: '',
    lastHot: '',
  };

  UI.init = function (app) {
    UI.app = app;
    $('overlay').style.display = 'flex';
  };

  UI.hideLoading = function () {
    const l = $('loading');
    if (!l) return;
    l.style.opacity = '0';
    setTimeout(() => l.classList.add('hidden'), 380);
  };

  UI.hideOverlay = function () {
    $('overlay').style.display = 'none';
  };

  UI.showHud = function (on) {
    $('hud').classList.toggle('hidden', !on);
  };

  UI.skinHead = function (skinId) {
    const s = (VOX.Textures.SKINS[skinId] || VOX.Textures.SKINS.steve);
    const hex = (v) => '#' + v.toString(16).padStart(6, '0');
    return 'background:linear-gradient(180deg,' + hex(s.hair) + ' 0 32%,' + hex(s.skin) + ' 32% 70%,' + hex(s.shirt) + ' 70%)';
  };

  UI.profileBlock = function () {
    const p = UI.app.profile;
    const skins = Object.keys(VOX.Textures.SKINS).map((id) => {
      const s = VOX.Textures.SKINS[id];
      return '<div class="skin ' + (p.skin === id ? 'sel' : '') + '" data-skin="' + id + '" title="' + esc(s.name) + '">' +
        '<div class="head" style="' + UI.skinHead(id) + '"></div><span>' + esc(s.name.split(' ')[0]) + '</span></div>';
    }).join('');
    const swatches = COLORS.map((c) => '<div class="swatch ' + (p.color === c ? 'sel' : '') + '" data-color="' + c + '" style="background:' + c + '"></div>').join('');
    return '<div class="panel"><h2>Your Runner</h2><p class="sub">Name, skin and team color are shared with friends.</p>' +
      '<div class="field"><span>Name</span><input id="profileName" maxlength="16" value="' + esc(p.name) + '"></div>' +
      '<div class="field" style="margin-top:12px"><span>Skin</span><div class="skins">' + skins + '</div></div>' +
      '<div class="field" style="margin-top:12px"><span>Color</span><div class="swatches">' + swatches + '</div></div></div>';
  };

  UI.bindProfileBlock = function (rerender) {
    const name = $('profileName');
    if (name) name.oninput = () => { UI.app.profile.name = name.value.slice(0, 16) || 'Player'; UI.app.saveProfile(); };
    document.querySelectorAll('[data-skin]').forEach((e) => {
      e.onclick = () => { UI.app.profile.skin = e.dataset.skin; UI.app.saveProfile(); rerender(); };
    });
    document.querySelectorAll('[data-color]').forEach((e) => {
      e.onclick = () => { UI.app.profile.color = e.dataset.color; UI.app.saveProfile(); rerender(); };
    });
  };

  UI.showMenu = function () {
    const app = UI.app;
    UI.showHud(false);
    UI.hideCountdown();
    $('overlay').style.display = 'flex';
    const online = app.serverAvailable === true;
    const notice = online
      ? '<div class="notice">LAN server detected — rooms will connect over WebSocket.</div>'
      : '<div class="notice">PeerJS rooms work from any static host. Add <b>server.js</b> for a dedicated LAN server.</div>';
    const arenaOptions = '<option value="">Random</option>' + Object.keys(VOX.Arenas)
      .filter((id) => VOX.Arenas[id].mode === 'pvp')
      .map((id) => '<option value="' + id + '" ' + (app.solo.arena === id ? 'selected' : '') + '>' + esc(VOX.Arenas[id].name) + (VOX.Arenas[id].isNew ? ' · NEW' : '') + '</option>')
      .join('');

    $('overlay').innerHTML =
      '<div class="shell"><div class="brand"><div class="logo"></div><div><h1>VOX ARENA</h1>' +
      '<p>Procedural parkour races · weapon knockback PvP · 1–4 players</p></div></div>' +
      '<div class="grid">' +
      '<div class="stack">' +
      '<div class="panel"><h2>Multiplayer</h2><p class="sub">Create a room and send the 5-letter code to friends, or join theirs.</p>' +
      '<div class="actions"><button class="pri" data-act="create">Create Room <span class="k">host</span></button>' +
      '<button data-act="join">Join Room <span class="k">code</span></button></div>' +
      '<div style="margin-top:12px">' + notice + '</div></div>' +
      '<div class="panel"><h2>Solo</h2><p class="sub">Randomised seeded courses and a combat duel against the bot.</p>' +
      '<div class="row" style="margin-bottom:10px"><label class="field"><span>Difficulty</span><select id="soloDiff">' +
      Object.keys(VOX.LevelGen.DIFFICULTY).map((k) => '<option value="' + k + '" ' + (app.solo.difficulty === k ? 'selected' : '') + '>' + VOX.LevelGen.DIFFICULTY[k].name + '</option>').join('') +
      '</select></label><label class="field"><span>Theme</span><select id="soloTheme"><option value="">Random</option>' +
      VOX.LevelGen.THEME_IDS.map((k) => '<option value="' + k + '" ' + (app.solo.theme === k ? 'selected' : '') + '>' + VOX.LevelGen.THEMES[k].name + (VOX.LevelGen.THEMES[k].isNew ? ' · NEW' : '') + '</option>').join('') +
      '</select></label><label class="field"><span>Bot arena</span><select id="soloArena">' + arenaOptions + '</select></label></div>' +
      '<div class="actions"><button class="pri" data-act="solo">Parkour Run <span class="k">timed</span></button>' +
      '<button data-act="bot">Combat Duel vs Bot <span class="k">AI</span></button>' +
      '<button data-act="bridge">Bridge Practice <span class="k">sandbox</span></button></div></div>' +
      '<div class="foot"><button class="ghost" data-act="settings">Settings</button><button class="ghost" data-act="controls">Controls</button><button class="ghost" data-act="stats">Stats</button></div>' +
      '</div>' +
      '<div class="stack">' + UI.profileBlock() +
      '<div class="panel"><h2>How it works</h2><p class="sub" style="margin:0">Race through a newly generated course, or fight for knockbacks. Everything is procedural: 32px textures, normal maps, eleven themes, moving platforms, ice, slime, speed pads, checkpoints and hazards. Every PvP arena lets you place and break blocks with <b>F</b> / <b>G</b> and cycle block types with <b>B</b>.</p></div>' +
      '</div></div></div>';

    UI.bindProfileBlock(UI.showMenu);
    $('soloDiff').onchange = (e) => { app.solo.difficulty = e.target.value; app.saveProfile(); };
    $('soloTheme').onchange = (e) => { app.solo.theme = e.target.value; app.saveProfile(); };
    $('soloArena').onchange = (e) => { app.solo.arena = e.target.value; app.saveProfile(); };
    document.querySelectorAll('[data-act]').forEach((b) => {
      b.onclick = () => {
        const a = b.dataset.act;
        if (a === 'create') app.createRoom();
        else if (a === 'join') UI.showJoin();
        else if (a === 'solo') app.startSolo();
        else if (a === 'bot') app.startBot();
        else if (a === 'bridge') app.startBridge();
        else if (a === 'settings') UI.showSettings(UI.showMenu);
        else if (a === 'controls') UI.showControls(UI.showMenu);
        else if (a === 'stats') UI.showStats();
      };
    });
  };

  UI.showJoin = function () {
    const app = UI.app;
    $('overlay').innerHTML =
      '<div class="shell" style="max-width:520px"><div class="brand" style="margin-bottom:14px"><div class="logo"></div><div><h1 style="font-size:26px">JOIN ROOM</h1><p>Enter the 5-letter code from your host</p></div></div>' +
      '<div class="panel"><div class="field"><span>Room code</span><input id="joinCode" maxlength="8" placeholder="ABCDE" style="font-size:24px;letter-spacing:6px;text-transform:uppercase;text-align:center"></div>' +
      '<div id="joinMsg" style="margin-top:10px"></div>' +
      '<div class="foot"><button class="pri" id="joinGo">Connect</button><button class="ghost" id="joinBack">Back</button></div></div></div>';
    const input = $('joinCode');
    input.focus();
    const go = () => {
      const code = input.value.trim().toUpperCase();
      if (code.length < 3) {
        $('joinMsg').innerHTML = '<div class="notice bad">Enter a valid room code.</div>';
        return;
      }
      $('joinMsg').innerHTML = '<div class="notice">Connecting to ' + esc(code) + '…</div>';
      app.joinRoom(code);
    };
    $('joinGo').onclick = go;
    input.onkeydown = (e) => { if (e.key === 'Enter') go(); };
    $('joinBack').onclick = UI.showMenu;
  };

  UI.showConnecting = function (text) {
    $('overlay').style.display = 'flex';
    $('overlay').innerHTML = '<div class="shell" style="max-width:460px;margin:auto"><div class="panel" style="text-align:center"><div class="spinner" style="margin:6px auto 16px"></div><h2>Connecting</h2><p class="sub" style="margin-bottom:0">' + esc(text || 'Setting up the room…') + '</p><div class="foot" style="justify-content:center"><button class="ghost" id="cancelConn">Cancel</button></div></div></div>';
    $('cancelConn').onclick = () => { UI.app.leaveRoom(); UI.showMenu(); };
  };

  UI.inviteLink = function (room) {
    const code = room ? room.code : (UI.app && UI.app.room ? UI.app.room.code : '');
    if (!code) return '';
    return global.location.origin + global.location.pathname + '?room=' + String(code).toUpperCase();
  };

  UI.showLobby = function () {
    const app = UI.app;
    const room = app.room;
    if (!room) return UI.showMenu();
    UI.showHud(false);
    $('overlay').style.display = 'flex';
    const isHost = room.hostId === app.myId;
    const slots = [];
    for (let i = 0; i < 4; i++) {
      const p = room.players[i];
      if (!p) {
        slots.push('<div class="slot empty">Open slot</div>');
      } else {
        const ready = p.host ? '<span class="ready host">HOST</span>' : p.ready ? '<span class="ready">READY</span>' : '<span class="ready no">WAITING</span>';
        const canSet = isHost || p.id === app.myId;
        const teamBtn = (t) => '<button class="teambtn' + ((p.team & 1) === t ? ' sel' : '') + '" data-team="' + esc(p.id) + ':' + t + '"' + (canSet ? '' : ' disabled') + '>' + (t === 0 ? 'Cyan' : 'Red') + '</button>';
        const team = room.mode === 'team' ? '<div class="teamrow">' + teamBtn(0) + teamBtn(1) + '</div>' : '';
        slots.push('<div class="slot"><div class="avatar" style="' + UI.skinHead(p.skin) + '"></div><div class="who"><b>' + esc(p.name) + (p.id === app.myId ? ' (you)' : '') + '</b>' + team + '<small>' + esc((VOX.Textures.SKINS[p.skin] || VOX.Textures.SKINS.steve).name) + '</small></div>' + ready + '</div>');
      }
    }
    const modes = [
      { id: 'race', name: 'Parkour Race', sub: '2–4 players · first to the finish' },
      { id: 'duel', name: 'Weapon Duel', sub: '1v1 · first to 5 knockouts' },
      { id: 'team', name: 'Team Battle', sub: '2v2 · shared score' },
      { id: 'ffa', name: 'Free For All', sub: '2–4 players · most KOs when time runs out' },
    ];
    const modeHtml = modes.map((m) => '<div class="mode ' + (room.mode === m.id ? 'sel' : '') + '" data-mode="' + m.id + '"><b>' + m.name + '</b><small>' + m.sub + '</small></div>').join('');
    const arenaOptions = '<option value="">Random</option>' + Object.keys(VOX.Arenas)
      .filter((id) => VOX.Arenas[id].mode === 'pvp')
      .map((id) => '<option value="' + id + '" ' + (room.arena === id ? 'selected' : '') + '>' + esc(VOX.Arenas[id].name) + (VOX.Arenas[id].isNew ? ' · NEW' : '') + '</option>')
      .join('');

    const canStart =
      room.mode === 'race' ? room.players.length >= 1 :
      room.mode === 'duel' ? room.players.length === 2 :
      room.mode === 'team' ? room.players.length === 4 :
      room.players.length >= 2;

    const teamsOk = room.mode !== 'team' || (
      room.players.filter((p) => (p.team & 1) === 0).length === 2 &&
      room.players.filter((p) => (p.team & 1) === 1).length === 2
    );
    const allReady = room.players.every((p) => p.host || p.ready);
    const startOk = isHost && canStart && teamsOk && allReady;
    const needText = room.mode === 'duel' ? '2 players'
      : room.mode === 'team' ? '4 players (2 vs 2)'
      : room.mode === 'ffa' ? '2 or more players' : 'players';
    const msgHtml = startOk ? '' : '<div class="notice warn">' + (
      !teamsOk ? 'Teams must be 2 vs 2. Tap Cyan or Red to switch.' :
      canStart ? 'Waiting for everyone to ready up.' :
      'Need ' + needText + ' to start.'
    ) + '</div>';
    const playersHint = room.mode === 'team'
      ? 'Tap Cyan/Red to switch teams. The host can also move players.'
      : 'Ready up before the host starts.';

    const bottom = isHost
      ? '<button class="pri" id="lobbyStart" ' + (startOk ? '' : 'disabled') + '>Start Match</button>'
      : '<button class="pri" id="lobbyReady">' + (room.me && room.me.ready ? 'Unready' : 'Ready') + '</button>';

    $('overlay').innerHTML =
      '<div class="shell"><div class="brand" style="margin-bottom:14px"><div class="logo"></div><div><h1 style="font-size:28px">ROOM ' + esc(room.code) + '</h1><p>' + (isHost ? 'You are the host' : 'Waiting for the host') + ' · ' + esc(app.netMode || 'p2p') + (app.ping ? ' · ' + app.ping + ' ms' : '') + '</p></div></div>' +
      '<div class="grid"><div class="stack">' +
      '<div class="panel"><h2>Invite</h2><div class="codebox"><div class="code" id="roomCode">' + esc(room.code) + '</div><button class="small" id="copyCode">Copy code</button></div><div class="row" style="margin-top:8px"><button class="small" id="copyInvite">Copy invite link</button></div><div class="notice">Share the invite link or code. Friends open the invite link to auto-join, or paste the code into <b>Join Room</b>. Max 4 players.</div></div>' +
      '<div class="panel"><h2>Players</h2><p class="sub">' + playersHint + '</p><div class="slots">' + slots.join('') + '</div></div>' +
      '</div><div class="stack">' +
      '<div class="panel"><h2>Mode</h2><p class="sub">' + (isHost ? 'Choose the match type.' : 'Host chooses the mode.') + '</p>' +
      '<div class="modes" id="modeCards">' + modeHtml + '</div>' +
      '<div class="row"><label class="field"><span>Difficulty</span><select id="lobbyDiff" ' + (isHost ? '' : 'disabled') + '>' +
      VOX.LevelGen.DIFFICULTY_IDS.map((k) => '<option value="' + k + '" ' + (room.difficulty === k ? 'selected' : '') + '>' + VOX.LevelGen.DIFFICULTY[k].name + '</option>').join('') +
      '</select></label><label class="field"><span>Theme</span><select id="lobbyTheme" ' + (isHost ? '' : 'disabled') + '><option value="">Random</option>' +
      VOX.LevelGen.THEME_IDS.map((k) => '<option value="' + k + '" ' + (room.theme === k ? 'selected' : '') + '>' + VOX.LevelGen.THEMES[k].name + (VOX.LevelGen.THEMES[k].isNew ? ' · NEW' : '') + '</option>').join('') +
      '</select></label><label class="field"><span>Arena</span><select id="lobbyArena" ' + (isHost ? '' : 'disabled') + '>' + arenaOptions + '</select></label>' +
      (room.mode === 'ffa' ? '<label class="field"><span>FFA Timer</span><select id="lobbyFfaTime" ' + (isHost ? '' : 'disabled') + '>' +
        '<option value="300" ' + ((room.ffaTime || 300) === 300 ? 'selected' : '') + '>5 minutes</option>' +
        '<option value="600" ' + (room.ffaTime === 600 ? 'selected' : '') + '>10 minutes</option>' +
        '</select></label>' : '') + '</div>' +
      '<div class="row" style="margin-top:10px;align-items:center"><div class="pill cy" style="flex:1;justify-content:center">Seed ' + room.seed + '</div>' +
      (isHost ? '<button class="small" id="reroll">Reroll</button>' : '') + '</div>' +
      '<div id="lobbyMsg" style="margin-top:10px">' + msgHtml + '</div>' +
      '</div><div class="foot"><span class="spacer"></span><button class="danger" id="lobbyLeave">Leave</button>' + bottom + '</div>' +
      '</div></div></div>';

    document.querySelectorAll('#modeCards .mode').forEach((m) => {
      m.onclick = () => { if (isHost) app.setRoomMode(m.dataset.mode); };
    });
    document.querySelectorAll('[data-team]').forEach((b) => {
      b.onclick = () => {
        const raw = b.dataset.team;
        const cut = raw.lastIndexOf(':');
        if (cut > 0) app.requestTeam(raw.slice(0, cut), +raw.slice(cut + 1));
      };
    });
    if (isHost) {
      $('lobbyDiff').onchange = (e) => app.setRoomOptions({ difficulty: e.target.value });
      $('lobbyTheme').onchange = (e) => app.setRoomOptions({ theme: e.target.value });
      $('lobbyArena').onchange = (e) => app.setRoomOptions({ arena: e.target.value });
      const ft = $('lobbyFfaTime');
      if (ft) ft.onchange = (e) => app.setRoomOptions({ ffaTime: +e.target.value });
      const rr = $('reroll');
      if (rr) rr.onclick = () => app.setRoomOptions({ seed: VOX.LevelGen.randomSeed() });
    }
    $('copyCode').onclick = () => {
      const txt = room.code;
      if (navigator.clipboard) navigator.clipboard.writeText(txt).then(() => UI.toast('Room code copied', '#8be02a'));
      else UI.toast('Code: ' + txt, '#8be02a');
    };
    $('copyInvite').onclick = () => {
      const link = UI.inviteLink(room);
      const done = () => UI.toast('Invite link copied', '#8be02a');
      if (navigator.clipboard) navigator.clipboard.writeText(link).then(done).catch(() => UI.toast('Copy failed', '#ff5b5b'));
      else UI.toast(link, '#8be02a');
    };
    $('lobbyLeave').onclick = () => app.leaveRoom();
    if (isHost) {
      const st = $('lobbyStart');
      if (st) st.onclick = () => app.startMatch();
    } else {
      const rb = $('lobbyReady');
      if (rb) rb.onclick = () => app.toggleReady();
    }
  };

  UI.showSettings = function (back) {
    const app = UI.app;
    const s = app.settings;
    const row = (k, label, mn, mx, st, val) =>
      '<label class="field"><span>' + label + '</span><div class="row" style="align-items:center"><input type="range" data-set="' + k + '" min="' + mn + '" max="' + mx + '" step="' + st + '" value="' + val + '" style="flex:1"><b data-val="' + k + '" style="min-width:44px;text-align:right">' + val + '</b></div></label>';
    const check = (k, label) => '<label class="check"><input type="checkbox" data-chk="' + k + '" ' + (s[k] ? 'checked' : '') + '> ' + label + '</label>';
    $('overlay').style.display = 'flex';
    $('overlay').innerHTML =
      '<div class="shell" style="max-width:760px"><div class="brand" style="margin-bottom:14px"><div class="logo"></div><div><h1 style="font-size:26px">SETTINGS</h1><p>Tune the feel and the visuals</p></div></div>' +
      '<div class="panel"><div class="settings-grid">' +
      row('sens', 'Mouse sensitivity', .2, 3, .1, s.sens) +
      row('fov', 'Field of view', 60, 110, 1, s.fov) +
      row('vol', 'Sound volume', 0, 1, .05, s.vol) +
      '<label class="field"><span>Graphics quality</span><select data-set2="quality">' +
      ['low', 'medium', 'high'].map((q) => '<option value="' + q + '" ' + (s.quality === q ? 'selected' : '') + '>' + q[0].toUpperCase() + q.slice(1) + '</option>').join('') + '</select></label>' +
      '<div class="stack" style="gap:9px">' + check('xh', 'Show crosshair') + check('fovk', 'Sprint FOV effect') + check('tp', 'Third-person by default') + check('invert', 'Invert mouse Y') + check('bob', 'Camera bobbing') + '</div>' +
      '</div><div class="foot"><span class="spacer"></span><button class="ghost" id="setBack">Back</button></div></div></div>';
    document.querySelectorAll('[data-set]').forEach((e) => {
      e.oninput = () => {
        const k = e.dataset.set;
        s[k] = +e.value;
        const b = document.querySelector('[data-val="' + k + '"]');
        if (b) b.textContent = e.value;
        app.applySettings();
      };
    });
    document.querySelectorAll('[data-set2]').forEach((e) => {
      e.onchange = () => { s.quality = e.value; app.applySettings(); };
    });
    document.querySelectorAll('[data-chk]').forEach((e) => {
      e.onchange = () => { s[e.dataset.chk] = e.checked; app.applySettings(); };
    });
    $('setBack').onclick = () => { app.saveProfile(); back(); };
  };

  UI.showControls = function (back) {
    $('overlay').style.display = 'flex';
    $('overlay').innerHTML =
      '<div class="shell" style="max-width:720px"><div class="brand" style="margin-bottom:14px"><div class="logo"></div><div><h1 style="font-size:26px">CONTROLS</h1><p>Identical movement engine across every mode</p></div></div>' +
      '<div class="panel"><div class="scroll"><table style="width:100%;border-collapse:collapse;font-size:14px;line-height:1.9">' +
      [['W A S D', 'Move'], ['Mouse', 'Look'], ['Space', 'Jump / double jump'], ['C', 'Slide'], ['E', 'Quick grapple (hold to keep pulling)'], ['1 / 2 / 3 / 4', 'Sword / spear / grapple / bow'], ['5', 'Blocks (PvP)'], ['Scroll', 'Change weapon / block'], ['I', 'Inspect player'], ['Tab', 'Scoreboard (hold, PvP)'], ['Shift', 'Sneak (edge guard)'], ['Ctrl / double-tap W', 'Sprint'], ['V', 'First / third person'], ['R', 'Respawn / restart'], ['Esc', 'Pause'], ['Left click', 'Attack / fire bow / break placed block'], ['Right click', 'Spear charge & dash / weapon block / place block']].map((r) => '<tr><td style="width:44%"><kbd>' + r[0] + '</kbd></td><td>' + r[1] + '</td></tr>').join('') +
      '</table><p class="sub" style="margin-top:12px">Sprint jumps carry the most distance. In PvP, hit while falling for a crit, and reset your sprint with a W-tap to keep strong knockback. Spear lunges at targets in front; the hook pulls rivals toward you. In races, hits only bump rivals. Sneak blocks you from walking off ledges.</p></div>' +
      '<div class="foot"><span class="spacer"></span><button class="ghost" id="ctrlBack">Back</button></div></div></div>';
    $('ctrlBack').onclick = back;
  };

  UI.showStats = function () {
    const app = UI.app;
    const st = app.stats;
    $('overlay').style.display = 'flex';
    $('overlay').innerHTML =
      '<div class="shell" style="max-width:600px"><div class="brand" style="margin-bottom:14px"><div class="logo"></div><div><h1 style="font-size:26px">STATS</h1><p>Stored locally</p></div></div>' +
      '<div class="panel"><div class="statgrid">' +
      '<div class="stat"><b>' + st.runs + '</b><small>solo runs</small></div>' +
      '<div class="stat"><b>' + st.finishes + '</b><small>courses finished</small></div>' +
      '<div class="stat"><b>' + (st.bestTime ? st.bestTime.toFixed(2) + 's' : '—') + '</b><small>best solo time</small></div>' +
      '<div class="stat"><b>' + st.kills + '</b><small>PvP knockouts</small></div>' +
      '<div class="stat"><b>' + st.deaths + '</b><small>deaths</small></div>' +
      '<div class="stat"><b>' + st.bestKills + '</b><small>best match kills</small></div>' +
      '</div><div class="foot"><span class="spacer"></span><button class="ghost" id="statsBack">Back</button></div></div></div>';
    $('statsBack').onclick = UI.showMenu;
  };

  UI.showResults = function (data) {
    const rows = (data.rows || []).map((r, i) =>
      '<div class="prow ' + (r.first ? 'first' : '') + '"><div class="rank">' + (r.rank || i + 1) + '</div><div class="nm">' + esc(r.name) + (r.tag ? ' <span class="tag">' + esc(r.tag) + '</span>' : '') + '</div><div class="tm">' + esc(r.value) + '</div></div>'
    ).join('');
    const stats = (data.stats || []).map((s) => '<div class="stat"><b>' + esc(s.value) + '</b><small>' + esc(s.label) + '</small></div>').join('');
    const actions = (data.actions || []).map((a, i) => '<button id="resA' + i + '" class="' + (a.pri ? 'pri' : '') + '">' + esc(a.label) + '</button>').join('');
    UI.showHud(false);
    UI.hideCountdown();
    if (document.pointerLockElement) document.exitPointerLock();
    $('overlay').style.display = 'flex';
    $('overlay').innerHTML =
      '<div class="shell" style="max-width:660px"><div class="brand" style="margin-bottom:14px"><div class="logo"></div><div><h1 style="font-size:28px">' + esc(data.title || 'RESULTS') + '</h1><p>' + esc(data.subtitle || '') + '</p></div></div>' +
      '<div class="panel">' + (data.note ? '<div class="notice" style="margin-bottom:12px">' + data.note + '</div>' : '') +
      (rows ? '<div class="podium">' + rows + '</div>' : '') +
      (stats ? '<div class="statgrid">' + stats + '</div>' : '') +
      '<div class="foot"><span class="spacer"></span>' + actions + '</div></div></div>';
    (data.actions || []).forEach((a, i) => {
      const b = $('resA' + i);
      if (b) b.onclick = a.fn;
    });
  };

  UI.toast = function (text, color, sub) {
    const t = $('toast');
    t.innerHTML = '<span style="color:' + (color || '#8be02a') + '">' + esc(text) + '</span>' + (sub ? '<small>' + esc(sub) + '</small>' : '');
    t.classList.add('show');
    clearTimeout(UI._toastT);
    UI._toastT = setTimeout(() => t.classList.remove('show'), 1800);
  };

  UI.setCountdown = function (text) {
    const c = $('countdown');
    if (text === null || text === undefined || text === '') {
      c.classList.add('hidden');
      return;
    }
    c.textContent = text;
    c.classList.remove('hidden');
    c.classList.remove('pop');
    void c.offsetWidth;
    c.classList.add('pop');
  };

  UI.hideCountdown = function () {
    $('countdown').classList.add('hidden');
  };

  UI.killfeed = function (html) {
    const feed = $('killfeed');
    const d = document.createElement('div');
    d.className = 'kf';
    d.innerHTML = html;
    feed.appendChild(d);
    while (feed.children.length > 5) feed.removeChild(feed.firstChild);
    setTimeout(() => { if (d.parentNode) d.parentNode.removeChild(d); }, 4200);
  };

  UI.updateHUD = function (app) {
    const h = app.hud;
    if (!h) return;
    const set = (id, v) => { const e = $(id); if (e && e.innerHTML !== v) e.innerHTML = v; };
    set('timerText', esc(h.time || ''));
    const tt = $('timerText');
    if (tt) tt.classList.toggle('low', !!h.timeLow);
    set('levelText', esc(h.levelName || ''));
    set('cpText', esc(h.cpText || ''));
    set('posText', h.pos || '');
    set('speedText', h.speed || '');
    set('pingText', h.ping || '');
    const hb = $('healthBox');
    hb.classList.toggle('hidden', h.hp === undefined);
    if (h.hp !== undefined) {
      $('healthFill').style.width = Math.max(0, Math.min(100, (h.hp / (h.maxHp || 20)) * 100)) + '%';
      set('hpText', Math.max(0, Math.ceil(h.hp)) + ' / ' + (h.maxHp || 20) + ' HP');
      set('scoreText', esc(h.scoreText || ''));
    }
    const rb = $('racebars');
    rb.style.display = h.racebars && h.racebars.length ? 'flex' : 'none';
    if (h.racebars) {
      const key = h.racebars.map((r) => r.name + Math.round(r.progress) + r.me).join('|');
      if (key !== UI.lastBars) {
        UI.lastBars = key;
        rb.innerHTML = h.racebars.map((r) =>
          '<div class="rbar ' + (r.me ? 'me' : '') + '"><span class="nm" style="color:' + (r.color || '#e9eff7') + '">' + esc(r.name) + '</span><span class="track"><i style="width:' + Math.max(0, Math.min(100, r.progress)) + '%"></i></span><span class="pct">' + Math.round(r.progress) + '%</span></div>'
        ).join('');
      }
    }
    const sb = $('scoreboard');
    if (sb) {
      const show = !!(h.scoreboard && h.scoreboard.length);
      sb.classList.toggle('hidden', !show);
      if (show) {
        const skey = h.scoreboard.map((r) => r.name + '|' + r.kills + '|' + r.deaths + '|' + r.me).join(',');
        if (skey !== UI.lastScoreboard) {
          UI.lastScoreboard = skey;
          sb.innerHTML = '<div class="sbh"><span>SCOREBOARD</span><span>HOLD TAB</span></div>' +
            '<div class="sbrow sbhead"><span></span><span class="nm">PLAYER</span><span class="k">KOs</span><span class="d">DEATHS</span></div>' +
            h.scoreboard.map((r, i) =>
              '<div class="sbrow ' + (r.me ? 'me' : '') + '"><span class="rk">' + (i + 1) + '</span><span class="nm" style="color:' + (r.color || '#e9eff7') + '">' + esc(r.name) + '</span><span class="k">' + r.kills + '</span><span class="d">' + r.deaths + '</span></div>'
            ).join('');
        }
      }
    }
    const hot = $('hotbar');
    hot.style.display = h.hotbar && h.hotbar.length ? 'flex' : 'none';
    if (h.hotbar) {
      const key = h.hotbar.map((x) => x.label + x.color + x.selected).join('|');
      if (key !== UI.lastHot) {
        UI.lastHot = key;
        hot.innerHTML = h.hotbar.map((x) => '<div class="hotslot ' + (x.selected ? 'sel' : '') + '"><div><div class="sw" style="background:' + (x.color || '#555') + '"></div>' + esc(x.label) + '</div></div>').join('');
      }
    }
    const hint = $('hint');
    if (h.hint) {
      hint.style.display = 'block';
      if (hint.innerHTML !== h.hint) hint.innerHTML = h.hint;
    } else hint.style.display = 'none';
    const cb = $('chargeBox');
    if (cb) {
      cb.classList.toggle('hidden', !h.chargeActive);
      cb.classList.toggle('ready', !!h.chargeReady);
      if (h.chargeActive) {
        $('chargeFill').style.width = Math.round(Math.max(0, Math.min(1, h.charge || 0)) * 100) + '%';
        set('chargeText', h.chargeReady ? 'RELEASE TO DASH' : 'SPEAR CHARGE');
      }
    }
    $('crosshair').style.display = h.crosshair === false ? 'none' : 'block';
  };

  UI.setHudMode = function (mode) {
    $('hud').dataset.mode = mode || '';
  };

  VOX.UI = UI;
})(window);
