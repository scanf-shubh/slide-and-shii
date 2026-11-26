// Seeded procedural parkour course generator for 1-4 players.
(function (global) {
  const VOX = (global.VOX = global.VOX || {});

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const THEMES = {
    meadow: {
      id: 'meadow', name: 'Grassland Ruins',
      skyTop: '#2f74d6', skyBottom: '#c9e8fb', fog: 0xc3e2f6, fogNear: 55, fogFar: 210,
      hemiSky: 0xe6f3ff, hemiGround: 0x4c5a48, sunColor: 0xfff6e2, sunIntensity: 1.0,
      ground: 'grass', accent: 'stone_brick', secondary: 'cobble', detail: 'planks',
      under: 'dirt', hazard: 'lava', liquid: 'water', log: 'log', leaves: 'leaves', clouds: 18,
    },
    frost: {
      id: 'frost', name: 'Frozen Peaks',
      skyTop: '#22508e', skyBottom: '#d8ecff', fog: 0xcfe6f7, fogNear: 45, fogFar: 185,
      hemiSky: 0xeaf6ff, hemiGround: 0x6b7f92, sunColor: 0xeaf4ff, sunIntensity: 0.95,
      ground: 'snow', accent: 'packed_ice', secondary: 'prismarine', detail: 'ice',
      under: 'packed_ice', hazard: 'lava', liquid: 'ice', log: 'log', leaves: 'leaves', clouds: 14,
    },
    desert: {
      id: 'desert', name: 'Desert Temple',
      skyTop: '#d98b3d', skyBottom: '#ffe7b0', fog: 0xf0d3a0, fogNear: 55, fogFar: 200,
      hemiSky: 0xfff1d6, hemiGround: 0x9c7c50, sunColor: 0xffe0a3, sunIntensity: 1.1,
      ground: 'sandstone', accent: 'sandstone', secondary: 'quartz', detail: 'gold',
      under: 'sandstone', hazard: 'lava', liquid: 'water', log: 'log', leaves: 'leaves', clouds: 8,
    },
    nether: {
      id: 'nether', name: 'Nether Fortress',
      skyTop: '#2a0b0b', skyBottom: '#7a2412', fog: 0x5c1a10, fogNear: 30, fogFar: 150,
      hemiSky: 0xffb08a, hemiGround: 0x2a0a0a, sunColor: 0xff7a45, sunIntensity: 0.6, night: true,
      ground: 'netherrack', accent: 'nether_brick', secondary: 'obsidian', detail: 'glowstone',
      under: 'netherrack', hazard: 'lava', liquid: 'lava', log: 'log', leaves: 'leaves', clouds: 5,
    },
    crystal: {
      id: 'crystal', name: 'Crystal Caverns',
      skyTop: '#0b1230', skyBottom: '#2b3d78', fog: 0x1b2650, fogNear: 30, fogFar: 160,
      hemiSky: 0xb9ccff, hemiGround: 0x1a1830, sunColor: 0xb49bff, sunIntensity: 0.7, night: true,
      ground: 'deepslate', accent: 'amethyst', secondary: 'quartz', detail: 'glowstone',
      under: 'deepslate', hazard: 'lava', liquid: 'water', log: 'log', leaves: 'leaves', clouds: 4,
    },
    skygarden: {
      id: 'skygarden', name: 'Sky Gardens',
      skyTop: '#3d8fe0', skyBottom: '#d8f4ff', fog: 0xcdeffd, fogNear: 60, fogFar: 230,
      hemiSky: 0xeaffff, hemiGround: 0x5a7a60, sunColor: 0xffffff, sunIntensity: 1.05,
      ground: 'grass', accent: 'quartz', secondary: 'emerald', detail: 'wool_white',
      under: 'dirt', hazard: 'lava', liquid: 'water', log: 'log', leaves: 'leaves', clouds: 22,
    },
    gears: {
      id: 'gears', name: 'Clockwork Foundry', isNew: true,
      skyTop: '#2b3038', skyBottom: '#9aa3ad', fog: 0x77808a, fogNear: 42, fogFar: 190,
      hemiSky: 0xdde5ee, hemiGround: 0x30343a, sunColor: 0xf1f5fa, sunIntensity: 0.86,
      ground: 'stone_brick', accent: 'bricks', secondary: 'cobble', detail: 'glowstone',
      under: 'stone', hazard: 'lava', liquid: 'water', log: 'log', leaves: 'leaves', clouds: 8,
    },
    temple: {
      id: 'temple', name: 'Jade Temple', isNew: true,
      skyTop: '#1f6f6a', skyBottom: '#d7f2e3', fog: 0xc9ead9, fogNear: 50, fogFar: 210,
      hemiSky: 0xe9fff6, hemiGround: 0x4d6b52, sunColor: 0xf4ffe8, sunIntensity: 1.0,
      ground: 'sandstone', accent: 'quartz', secondary: 'emerald', detail: 'gold',
      under: 'sandstone', hazard: 'lava', liquid: 'water', log: 'log', leaves: 'leaves', clouds: 10,
    },
    volcanic: {
      id: 'volcanic', name: 'Ember Rift', isNew: true,
      skyTop: '#2a0b0b', skyBottom: '#b84a1f', fog: 0x7a2c16, fogNear: 28, fogFar: 145,
      hemiSky: 0xffb08a, hemiGround: 0x2a0a0a, sunColor: 0xff8a50, sunIntensity: 0.62, night: true,
      ground: 'netherrack', accent: 'nether_brick', secondary: 'obsidian', detail: 'glowstone',
      under: 'netherrack', hazard: 'lava', liquid: 'lava', log: 'log', leaves: 'leaves', clouds: 4,
    },
    candy: {
      id: 'candy', name: 'Sugar Clouds', isNew: true,
      skyTop: '#ff9ecb', skyBottom: '#fff1f7', fog: 0xffd9ea, fogNear: 62, fogFar: 240,
      hemiSky: 0xfff3f9, hemiGround: 0xd98aa8, sunColor: 0xffffff, sunIntensity: 1.05,
      ground: 'wool_white', accent: 'wool_red', secondary: 'wool_lime', detail: 'wool_yellow',
      under: 'wool_white', hazard: 'lava', liquid: 'water', log: 'log', leaves: 'leaves', clouds: 24,
    },
    cyber: {
      id: 'cyber', name: 'Neon Grid', isNew: true,
      skyTop: '#0b1026', skyBottom: '#2b1d5e', fog: 0x1a1740, fogNear: 34, fogFar: 165,
      hemiSky: 0xc4b6ff, hemiGround: 0x141226, sunColor: 0x9fb8ff, sunIntensity: 0.72, night: true,
      ground: 'deepslate', accent: 'amethyst', secondary: 'prismarine', detail: 'glowstone',
      under: 'deepslate', hazard: 'lava', liquid: 'water', log: 'log', leaves: 'leaves', clouds: 3,
    },
  };

  const DIFFICULTY = {
    chill: { id: 'chill', name: 'Chill', sections: 12, reach: 2.9, rise: 0.8, weights: { hazard: 0.04, mover: 0.1, ice: 0.7, slime: 0.7, climb: 0.5 } },
    standard: { id: 'standard', name: 'Standard', sections: 17, reach: 3.3, rise: 1.0, weights: { hazard: 0.12, mover: 0.18, ice: 1, slime: 1, climb: 1 } },
    insane: { id: 'insane', name: 'Insane', sections: 22, reach: 3.6, rise: 1.1, weights: { hazard: 0.22, mover: 0.28, ice: 1.2, slime: 1.2, climb: 1.4 } },
  };

  const ADJ = ['Aurora', 'Obsidian', 'Whisper', 'Crimson', 'Echo', 'Solar', 'Velvet', 'Static', 'Neon', 'Riven', 'Glacier', 'Amber'];

  function addBox(level, x, y, z, w, d, th, t, extra) {
    const b = { x: x, y: y, z: z, w: w, d: d, th: th === undefined ? 1 : th, t: t };
    if (extra) for (const k in extra) b[k] = extra[k];
    level.blocks.push(b);
    return b;
  }

  const OVERLAP_EPS = 1e-4;

  function overlapVolume(a, b, eps) {
    eps = eps === undefined ? OVERLAP_EPS : eps;
    const ath = a.th === undefined ? 1 : a.th;
    const bth = b.th === undefined ? 1 : b.th;
    return a.x - a.w / 2 < b.x + b.w / 2 - eps &&
      a.x + a.w / 2 > b.x - b.w / 2 + eps &&
      a.y - ath < b.y - eps &&
      a.y > b.y - bth + eps &&
      a.z - a.d / 2 < b.z + b.d / 2 - eps &&
      a.z + a.d / 2 > b.z - b.d / 2 + eps;
  }

  function canPlace(level, b) {
    for (let i = 0; i < level.blocks.length; i++) {
      if (overlapVolume(b, level.blocks[i])) return false;
    }
    return true;
  }

  function addBoxSafe(level, x, y, z, w, d, th, t, extra) {
    const b = { x: x, y: y, z: z, w: w, d: d, th: th === undefined ? 1 : th, t: t };
    if (extra) for (const k in extra) b[k] = extra[k];
    if (!canPlace(level, b)) return null;
    level.blocks.push(b);
    return b;
  }

  function addUnder(level, b, theme) {
    if (b.noUnder || b.isUnder || b.w < 2.2 || b.d < 2.2) return;
    const th = Math.min(3, Math.max(1, Math.round(Math.min(b.w, b.d) / 2)));
    addBoxSafe(level, b.x, b.y - (b.th || 1), b.z, Math.max(1, b.w - 1.2), Math.max(1, b.d - 1.2), th, theme.under || 'dirt', { isUnder: true });
    if (b.w > 4 && b.d > 4) {
      addBoxSafe(level, b.x, b.y - (b.th || 1) - th, b.z, Math.max(1, b.w - 2.6), Math.max(1, b.d - 2.6), th, theme.secondary || 'stone', { isUnder: true });
    }
  }

  function addTree(level, x, y, z, theme) {
    const log = theme.log || 'log';
    const leaf = theme.leaves || 'leaves';
    const parts = [
      { x: x, y: y + 4, z: z, w: 1, d: 1, th: 4, t: log },
      { x: x, y: y + 6, z: z, w: 3, d: 3, th: 2, t: leaf },
      { x: x, y: y + 7, z: z, w: 1, d: 1, th: 1, t: leaf },
    ];
    for (let i = 0; i < parts.length; i++) {
      if (!canPlace(level, parts[i])) return false;
      for (let j = 0; j < i; j++) if (overlapVolume(parts[i], parts[j])) return false;
    }
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      addBoxSafe(level, p.x, p.y, p.z, p.w, p.d, p.th, p.t, { isDecor: true });
    }
    return true;
  }

  function addLantern(level, x, y, z, theme) {
    const base = addBoxSafe(level, x, y + 2, z, 0.5, 0.5, 2, theme.accent || 'stone_brick', { isDecor: true });
    if (!base) return false;
    addBoxSafe(level, x, y + 2.8, z, 0.8, 0.8, 0.8, 'glowstone', { isDecor: true });
    return true;
  }

  function hop(level, c, o) {
    const dif = level.diff;
    const w = o.w;
    const d = o.d;
    let gap = o.gap;
    let xo = o.xo || 0;
    let dy = o.dy || 0;
    const maxReach = level.opts.reach || dif.reach;
    const maxRise = o.allowRise || level.opts.rise || dif.rise;
    const freeLat = (c.w + w) / 2 - 0.25;
    const reachOf = (g, x) => Math.hypot(g, Math.max(0, Math.abs(x) - freeLat));
    let guard = 0;
    while (reachOf(gap, xo) > maxReach && guard++ < 60) {
      if (gap > 1.1) gap = Math.max(1.1, gap - 0.12);
      else if (Math.abs(xo) > 0.15) xo *= 0.88;
      else break;
    }
    if (dy > maxRise) dy = maxRise;
    if (dy < -8) dy = -8;
    const z = c.z - gap - d / 2;
    const x = c.x + xo;
    const y = c.y + dy;
    const b = addBox(level, x, y, z, w, d, o.th === undefined ? 1 : o.th, o.t, o.tag);
    c.x = x;
    c.y = y;
    c.z = z - d / 2;
    c.w = w;
    c.d = d;
    return b;
  }

  function sectionStraight(level, c, rng, th) {
    const n = 3 + ((rng() * 3) | 0);
    for (let i = 0; i < n; i++) {
      const up = rng() < 0.22 ? (rng() < 0.5 ? 0.5 : 0.75) : 0;
      hop(level, c, {
        gap: 1.7 + rng() * 1.2,
        xo: (rng() - 0.5) * 1.8,
        dy: up,
        w: 2.0 + rng() * 1.4,
        d: 2.0 + rng() * 1.4,
        t: rng() < 0.55 ? th.ground : th.accent,
      });
    }
  }

  function sectionStairs(level, c, rng, th, up) {
    const n = 3 + ((rng() * 3) | 0);
    for (let i = 0; i < n; i++) {
      hop(level, c, {
        gap: 1.4 + rng() * 0.8,
        xo: (rng() - 0.5) * 0.9,
        dy: up ? 0.5 + (rng() < 0.45 ? 0.45 : 0) : -0.8 - rng() * 0.9,
        w: 2.2 + rng() * 0.9,
        d: 2.0 + rng() * 0.8,
        t: th.accent,
      });
    }
  }

  function sectionPillars(level, c, rng, th) {
    const n = 4 + ((rng() * 3) | 0);
    for (let i = 0; i < n; i++) {
      hop(level, c, {
        gap: 2.0 + rng() * 0.9,
        xo: (rng() - 0.5) * 3.0,
        dy: (rng() - 0.4) * 1.1,
        w: 1.5 + rng() * 0.7,
        d: 1.5 + rng() * 0.7,
        t: th.secondary || th.accent,
      });
    }
  }

  function sectionBeams(level, c, rng, th) {
    const n = 2 + ((rng() * 2) | 0);
    for (let i = 0; i < n; i++) {
      hop(level, c, {
        gap: 1.1 + rng() * 0.6,
        xo: (rng() - 0.5) * 1.3,
        dy: (rng() - 0.5) * 0.8,
        w: 1.2 + rng() * 0.4,
        d: 4.5 + rng() * 3.0,
        t: th.detail || 'planks',
      });
    }
  }

  function sectionZigzag(level, c, rng, th) {
    const n = 4 + ((rng() * 3) | 0);
    let side = rng() < 0.5 ? -1 : 1;
    for (let i = 0; i < n; i++) {
      side *= -1;
      hop(level, c, {
        gap: 1.8 + rng() * 0.7,
        xo: side * (1.4 + rng() * 1.3),
        dy: rng() < 0.3 ? 0.5 : 0,
        w: 2.0 + rng() * 0.9,
        d: 2.0 + rng() * 0.7,
        t: th.accent,
      });
    }
  }

  function sectionIce(level, c, rng, th) {
    hop(level, c, { gap: 1.6, xo: 0, dy: 0, w: 2.6 + rng() * 0.7, d: 5 + rng() * 3, t: 'ice' });
    hop(level, c, {
      gap: 2.0 + rng() * 0.7,
      xo: (rng() - 0.5) * 1.4,
      dy: (rng() - 0.5) * 0.6,
      w: 2.4 + rng() * 0.8,
      d: 2.4,
      t: th.accent,
    });
  }

  function sectionSlime(level, c, rng, th) {
    hop(level, c, { gap: 1.8, xo: 0, dy: 0, w: 2.6, d: 2.6, t: 'slime' });
    hop(level, c, {
      gap: 2.3 + rng() * 1.0,
      xo: (rng() - 0.5) * 1.6,
      dy: 1.5 + rng() * 0.4,
      w: 2.6 + rng() * 0.8,
      d: 2.6,
      t: th.accent,
      allowRise: 2.0,
    });
    if (rng() < 0.4) {
      hop(level, c, { gap: 2.2, xo: 0, dy: 0, w: 2.4, d: 2.4, t: 'slime' });
    }
  }

  function sectionSpeed(level, c, rng, th) {
    hop(level, c, { gap: 1.5, xo: 0, dy: 0, w: 3.2, d: 7 + rng() * 3, t: 'speed' });
    hop(level, c, { gap: 1.8 + rng() * 0.7, xo: (rng() - 0.5) * 1.2, dy: rng() < 0.4 ? 0.5 : 0, w: 2.8, d: 2.8, t: th.ground });
  }

  function sectionNeo(level, c, rng, th) {
    const b = hop(level, c, { gap: 1.5, xo: 0, dy: 0, w: 3, d: 3, t: th.accent });
    const side = rng() < 0.5 ? -1 : 1;
    addBox(level, b.x + side * (b.w / 2 + 0.5), b.y + 2, b.z, 1, 3, 2, th.secondary || th.accent, { noDecorate: true, noUnder: true });
    hop(level, c, { gap: 1.4, xo: side * -2.2, dy: 0.5, w: 2.4, d: 2.4, t: th.ground });
  }

  function sectionClimb(level, c, rng, th) {
    const n = 4 + ((rng() * 3) | 0);
    let side = rng() < 0.5 ? -1 : 1;
    for (let i = 0; i < n; i++) {
      side *= -1;
      hop(level, c, {
        gap: 1.2 + rng() * 0.5,
        xo: side * (1.2 + rng() * 0.8),
        dy: 0.7 + rng() * 0.3,
        w: 1.9 + rng() * 0.6,
        d: 1.9 + rng() * 0.6,
        t: th.secondary || th.accent,
      });
    }
  }

  function sectionMoving(level, c, rng, th) {
    hop(level, c, { gap: 1.6, xo: 0, dy: 0, w: 2.8, d: 2.8, t: th.accent });
    const m = hop(level, c, { gap: 1.4, xo: 0, dy: 0, w: 2.6, d: 2.6, t: th.detail || 'planks' });
    const lift = rng() < 0.45;
    m.mover = lift
      ? { axis: 'y', amp: 1.2 + rng() * 1.2, speed: 0.7 + rng() * 0.7, phase: rng() * Math.PI * 2, bx: m.x, by: m.y, bz: m.z }
      : { axis: 'x', amp: 1.2 + rng() * 1.6, speed: 0.6 + rng() * 0.8, phase: rng() * Math.PI * 2, bx: m.x, by: m.y, bz: m.z };
    level.movers.push(m);
    hop(level, c, { gap: 1.2, xo: 0, dy: 0, w: 2.8, d: 2.8, t: th.ground });
  }

  function sectionMoverRun(level, c, rng, th) {
    hop(level, c, { gap: 1.6, xo: 0, dy: 0, w: 2.8, d: 2.8, t: th.accent });
    const n = 3 + ((rng() * 2) | 0);
    for (let i = 0; i < n; i++) {
      const m = hop(level, c, {
        gap: 1.5 + rng() * 0.7,
        xo: (rng() - 0.5) * 1.6,
        dy: rng() < 0.3 ? 0.4 : 0,
        w: 2.4, d: 2.4, t: th.detail || 'planks',
      });
      const axis = i === 0 ? 'y' : (rng() < 0.5 ? 'x' : 'z');
      m.mover = {
        axis: axis,
        amp: axis === 'y' ? 1.0 + rng() * 1.0 : 1.4 + rng() * 1.2,
        speed: 0.6 + rng() * 0.6,
        phase: rng() * Math.PI * 2,
        bx: m.x, by: m.y, bz: m.z,
      };
      level.movers.push(m);
    }
    hop(level, c, { gap: 1.4, xo: 0, dy: 0, w: 3.0, d: 3.0, t: th.ground });
  }

  function sectionTower(level, c, rng, th) {
    const n = 5 + ((rng() * 3) | 0);
    let side = rng() < 0.5 ? -1 : 1;
    for (let i = 0; i < n; i++) {
      side *= -1;
      const b = hop(level, c, {
        gap: 1.2 + rng() * 0.4,
        xo: side * (1.0 + rng() * 0.8),
        dy: 0.55 + rng() * 0.2,
        w: 1.8 + rng() * 0.5,
        d: 1.8 + rng() * 0.5,
        t: th.secondary || th.accent,
      });
      addBoxSafe(level, b.x + side * (b.w / 2 + 0.4), b.y + 1.2, b.z, 0.4, 0.4, 1.2, th.accent, { isDecor: true, noDecorate: true });
    }
  }

  function sectionBridgeBeam(level, c, rng, th) {
    const n = 2 + ((rng() * 2) | 0);
    for (let i = 0; i < n; i++) {
      const b = hop(level, c, {
        gap: 1.2 + rng() * 0.5,
        xo: (rng() - 0.5) * 0.8,
        dy: (rng() - 0.4) * 0.6,
        w: 1.3 + rng() * 0.4,
        d: 6 + rng() * 3,
        t: th.detail || 'planks',
      });
      for (const s of [-1, 1]) {
        for (let k = -1; k <= 1; k++) {
          addBoxSafe(level, b.x + s * (b.w / 2 + 0.35), b.y + 1.2, b.z + k * (b.d / 3), 0.4, 0.4, 1.2, th.accent, { isDecor: true, noDecorate: true });
        }
      }
    }
  }

  function sectionHazard(level, c, rng, th) {
    const b = hop(level, c, { gap: 2.0, xo: 0, dy: 0, w: 3.4, d: 3.4, t: th.accent });
    const n = 2 + ((rng() * 3) | 0);
    for (let i = 0; i < n; i++) {
      const hx = b.x + (rng() - 0.5) * (b.w + 4);
      const hz = b.z + (rng() - 0.5) * (b.d + 4);
      if (Math.abs(hx - b.x) < b.w / 2 + 0.6 && Math.abs(hz - b.z) < b.d / 2 + 0.6) continue;
      const h = addBoxSafe(level, hx, b.y + 2 + rng() * 3, hz, 1.2 + rng(), 1.2 + rng(), 1.2 + rng() * 2, th.hazard || 'lava', { hazard: true, isDecor: true, noDecorate: true });
      if (h) level.hazards.push(h);
    }
    hop(level, c, { gap: 2.0 + rng() * 0.6, xo: (rng() - 0.5) * 1.6, dy: 0, w: 2.6, d: 2.6, t: th.ground });
  }

  function decorate(level, b, rng, th) {
    addUnder(level, b, th);
    if (b.w < 2.6 || b.d < 2.6) return;
    const roll = rng();
    if (roll < 0.16) addTree(level, b.x + (rng() < 0.5 ? -1 : 1) * (b.w / 2 - 0.8), b.y, b.z + (rng() < 0.5 ? -1 : 1) * (b.d / 2 - 0.8), th);
    else if (roll < 0.24) addLantern(level, b.x + (rng() - 0.5) * (b.w - 1), b.y, b.z + (rng() < 0.5 ? -1 : 1) * (b.d / 2 - 0.6), th);
    else if (roll < 0.3) {
      addBox(level, b.x + (b.w / 2 - 0.6), b.y + 1, b.z, 1, 1, 1, th.secondary || th.accent);
      addBox(level, b.x - (b.w / 2 - 0.6), b.y + 1, b.z, 1, 1, 1, th.secondary || th.accent);
    }
  }

  function generate(seed, opts) {
    opts = opts || {};
    seed = (seed >>> 0) || 1;
    const rng = mulberry32(seed ^ 0x9e3779b9);
    const diffId = opts.difficulty || 'standard';
    const dif = DIFFICULTY[diffId] || DIFFICULTY.standard;
    const themeIds = Object.keys(THEMES);
    const theme = (opts.theme && THEMES[opts.theme]) || THEMES[themeIds[(rng() * themeIds.length) | 0]];

    const level = {
      seed: seed,
      theme: theme,
      difficulty: diffId,
      opts: opts,
      diff: dif,
      blocks: [],
      spawns: [],
      checkpoints: [],
      movers: [],
      hazards: [],
      startZ: 0,
      finishZ: 0,
      startBox: null,
      finishBox: null,
      name: theme.name + ' · ' + ADJ[(rng() * ADJ.length) | 0],
    };

    const start = addBox(level, 0, 0, 0, 10, 10, 1, 'start', { isStart: true });
    level.startBox = start;
    for (let i = 0; i < 4; i++) {
      const sx = i < 2 ? -2.4 : 2.4;
      const sz = i % 2 === 0 ? 3.2 : 1.0;
      level.spawns.push({ x: sx, y: 0.02, z: sz, yaw: 0 });
    }
    for (let i = 0; i < 4; i++) {
      const sx = i < 2 ? -4.2 : 4.2;
      const sz = i % 2 === 0 ? 4.2 : -4.2;
      addBox(level, sx, 2, sz, 0.5, 0.5, 2, theme.accent, { isDecor: true, noDecorate: true });
      addBox(level, sx, 3, sz, 0.8, 0.8, 1, 'glowstone', { isDecor: true, noDecorate: true });
    }
    addBox(level, 0, -1, 0, 10, 10, 3, theme.under || 'dirt', { noDecorate: true });

    const c = { x: 0, y: 0, z: -5, w: 10, d: 10 };
    const sections = [];
    const specialPool = ['ice', 'slime', 'speed', 'neo', 'climb', 'movement', 'moverRun', 'tower', 'bridgeBeam', 'hazard', 'pillars', 'beams', 'zigzag', 'stairsUp', 'stairsDown'];
    const weights = dif.weights;
    let last = '';
    let sinceCp = 0;
    const total = dif.sections;

    function pickSection() {
      for (let attempt = 0; attempt < 12; attempt++) {
        const name = specialPool[(rng() * specialPool.length) | 0];
        if (name === last) continue;
        if (name === 'hazard' && rng() > weights.hazard * 4) continue;
        if (name === 'movement' && rng() > weights.mover * 4) continue;
        if (name === 'moverRun' && rng() > weights.mover * 4) continue;
        if (name === 'tower' && rng() > weights.climb * 0.9) continue;
        if (name === 'ice' && rng() > weights.ice * 0.8) continue;
        if (name === 'slime' && rng() > weights.slime * 0.8) continue;
        if (name === 'climb' && rng() > weights.climb * 0.8) continue;
        return name;
      }
      return 'straight';
    }

    function runSection(name) {
      if (name === 'straight') return sectionStraight(level, c, rng, theme);
      if (name === 'stairsUp') return sectionStairs(level, c, rng, theme, true);
      if (name === 'stairsDown') return sectionStairs(level, c, rng, theme, false);
      if (name === 'pillars') return sectionPillars(level, c, rng, theme);
      if (name === 'beams') return sectionBeams(level, c, rng, theme);
      if (name === 'zigzag') return sectionZigzag(level, c, rng, theme);
      if (name === 'ice') return sectionIce(level, c, rng, theme);
      if (name === 'slime') return sectionSlime(level, c, rng, theme);
      if (name === 'speed') return sectionSpeed(level, c, rng, theme);
      if (name === 'neo') return sectionNeo(level, c, rng, theme);
      if (name === 'climb') return sectionClimb(level, c, rng, theme);
      if (name === 'movement') return sectionMoving(level, c, rng, theme);
      if (name === 'moverRun') return sectionMoverRun(level, c, rng, theme);
      if (name === 'tower') return sectionTower(level, c, rng, theme);
      if (name === 'bridgeBeam') return sectionBridgeBeam(level, c, rng, theme);
      if (name === 'hazard') return sectionHazard(level, c, rng, theme);
      return sectionStraight(level, c, rng, theme);
    }

    const before = level.blocks.length;
    const cpEvery = Math.max(2, Math.round(total / 6));
    for (let i = 0; i < total; i++) {
      const name = i === 0 ? 'straight' : pickSection();
      last = name;
      sections.push(name);
      runSection(name);
      sinceCp++;
      if (sinceCp >= cpEvery && i < total - 2) {
        sinceCp = 0;
        const cp = hop(level, c, { gap: 1.8, xo: 0, dy: 0.3, w: 4.2, d: 4.2, t: 'cp' });
        cp.isCheckpoint = true;
        cp.cpIndex = level.checkpoints.length;
        level.checkpoints.push(cp);
        addUnder(level, cp, theme);
      }
    }

    const check = hop(level, c, { gap: 1.8, xo: 0, dy: 0.3, w: 4.2, d: 4.2, t: 'cp' });
    check.isCheckpoint = true;
    check.cpIndex = level.checkpoints.length;
    level.checkpoints.push(check);
    addUnder(level, check, theme);

    const finish = hop(level, c, { gap: 2.2, xo: 0, dy: 0, w: 8, d: 7, t: 'finish' });
    finish.isFinish = true;
    level.finishBox = finish;
    level.finishZ = finish.z;
    addUnder(level, finish, theme);
    addBox(level, finish.x - 3, finish.y + 3, finish.z - 3, 0.5, 0.5, 3, theme.accent, { isDecor: true, noDecorate: true });
    addBox(level, finish.x + 3, finish.y + 3, finish.z - 3, 0.5, 0.5, 3, theme.accent, { isDecor: true, noDecorate: true });
    addBox(level, finish.x, finish.y + 4, finish.z - 3, 8, 0.5, 0.5, theme.accent, { isDecor: true, noDecorate: true });
    for (let i = 0; i < 4; i++) addBox(level, finish.x - 3 + i * 2, finish.y + 0.8, finish.z - 2, 0.8, 0.8, 0.8, 'glowstone', { isDecor: true, noDecorate: true });

    const decorTargets = level.blocks.slice(before).filter(function (b) {
      return !b.isStart && !b.isCheckpoint && !b.isFinish && !b.mover && !b.isUnder && !b.isDecor && !b.noDecorate && !b.hazard;
    });
    for (let i = 0; i < decorTargets.length; i++) {
      if (rng() < 0.5) decorate(level, decorTargets[i], rng, theme);
    }

    if (level.hazards.length) {
      level.blocks = level.blocks.filter(function (b) {
        if (!b.hazard) return true;
        for (let i = 0; i < level.blocks.length; i++) {
          const o = level.blocks[i];
          if (o !== b && !o.hazard && overlapVolume(b, o)) return false;
        }
        return true;
      });
      level.hazards = level.blocks.filter(function (b) { return b.hazard; });
    }

    level.sections = sections;
    level.length = Math.abs(level.finishZ);
    return level;
  }

  function auditOverlaps(blocks) {
    const out = [];
    for (let i = 0; i < blocks.length; i++) {
      for (let j = i + 1; j < blocks.length; j++) {
        if (overlapVolume(blocks[i], blocks[j])) out.push([i, j]);
      }
    }
    return out;
  }

  function randomSeed() {
    return (Math.random() * 0xffffffff) >>> 0;
  }

  VOX.LevelGen = {
    generate: generate,
    auditOverlaps: auditOverlaps,
    randomSeed: randomSeed,
    THEMES: THEMES,
    DIFFICULTY: DIFFICULTY,
    THEME_IDS: Object.keys(THEMES),
    DIFFICULTY_IDS: Object.keys(DIFFICULTY),
  };
})(window);
