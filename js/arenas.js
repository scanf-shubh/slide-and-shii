// Minecraft-style Voxel Arenas (PvP, Bridge Duel, Sumo, Parkour, Bridge Lab)
// Clean non-overlapping coordinates to prevent any Z-fighting or polygon glitches.
(function (global) {
  const VOX = (global.VOX = global.VOX || {});

  function wallRing(b, S, W, t) {
    t = t || 'wall';
    b.push({ x: 0, y: W, z: -S / 2 - 0.5, w: S + 2, d: 1, th: W, t: t, isEnclosure: true });
    b.push({ x: 0, y: W, z: S / 2 + 0.5, w: S + 2, d: 1, th: W, t: t, isEnclosure: true });
    b.push({ x: -S / 2 - 0.5, y: W, z: 0, w: 1, d: S, th: W, t: t, isEnclosure: true });
    b.push({ x: S / 2 + 0.5, y: W, z: 0, w: 1, d: S, th: W, t: t, isEnclosure: true });
  }
  function box(b, x, y, z, w, d, th, t) { b.push({ x: x, y: y, z: z, w: w, d: d, th: th, t: t }); }
  function pillar(b, x, z, w, d, h, t) { b.push({ x: x, y: h, z: z, w: w, d: d, th: h, t: t }); }
  function mover(b, x, y, z, w, d, th, t, axis, amp, speed, phase) {
    b.push({
      x: x, y: y, z: z, w: w, d: d, th: th, t: t,
      mover: { axis: axis, amp: amp, speed: speed, phase: phase || 0, bx: x, by: y, bz: z },
    });
  }

  const field = {
    id: 'field', name: 'Endless Field', mode: 'pvp', allowBuild: false, noEnclose: true,
    desc: 'A huge open grass plain with scattered cover and grapple pillars. No roof, pure sky.',
    skyTop: '#3f8fe0', skyBot: '#d9f0ff', fogColor: 0xd9f0ff,
    theme: { skyTop: '#3f8fe0', skyBottom: '#d9f0ff', fog: 0xd9f0ff, fogNear: 80, fogFar: 300, hemiSky: 0xeaf6ff, hemiGround: 0x4f6b3f, sunColor: 0xfff5dc, sunIntensity: 1.05, clouds: 12 },
    voidY: -24,
    spawns: [
      { x: 0, y: 0.02, z: 24, yaw: 0, team: 'blue' }, { x: 0, y: 0.02, z: -24, yaw: Math.PI, team: 'red' },
      { x: 24, y: 0.02, z: 0, yaw: Math.PI / 2, team: 'green' }, { x: -24, y: 0.02, z: 0, yaw: -Math.PI / 2, team: 'yellow' },
      { x: 17, y: 0.02, z: 17, yaw: Math.PI / 4, team: 'blue' }, { x: -17, y: 0.02, z: -17, yaw: -3 * Math.PI / 4, team: 'red' },
    ],
    build() {
      const b = []; const S = 128, W = 12;
      box(b, 0, 0, 0, S, S, 1, 'grass'); wallRing(b, S, W);
      // scattered cover - low, no overhead
      [[-30, -30], [30, -30], [-30, 30], [30, 30]].forEach(([x, z]) => { pillar(b, x, z, 3, 3, 3, 'stone_brick'); });
      [[-50, 0], [50, 0], [0, -50], [0, 50]].forEach(([x, z]) => { pillar(b, x, z, 2, 2, 4, 'log'); });
      [[-15, 0], [15, 0], [0, -15], [0, 15], [-40, 20], [40, -20], [-20, 40], [20, -40]].forEach(([x, z]) => { box(b, x, 1, z, 2, 2, 1, 'wool_white'); });
      [[-45, -45], [45, 45], [-45, 45], [45, -45]].forEach(([x, z]) => { pillar(b, x, z, 4, 4, 2, 'cobble'); });
      return b;
    },
  };

  const courtyard = {
    id: 'courtyard', name: 'Castle Courtyard', mode: 'pvp', allowBuild: true, noEnclose: true,
    desc: 'A walled courtyard with pillars, low walls, and tactical cover. No roof, open sky.',
    skyTop: '#3276d4', skyBot: '#cce7fb', fogColor: 0xcce7fb,
    theme: { skyTop: '#3276d4', skyBottom: '#cce7fb', fog: 0xcce7fb, fogNear: 55, fogFar: 215, hemiSky: 0xe6f3ff, hemiGround: 0x556048, sunColor: 0xfff2d8, sunIntensity: 1.0, clouds: 14 },
    voidY: -15,
    spawns: [
      { x: 0, y: 0.1, z: 12, yaw: 0, team: 'blue' }, { x: 0, y: 0.1, z: -12, yaw: Math.PI, team: 'red' },
      { x: 12, y: 0.1, z: 0, yaw: Math.PI / 2, team: 'green' }, { x: -12, y: 0.1, z: 0, yaw: -Math.PI / 2, team: 'yellow' },
    ],
    build() {
      const b = []; const S = 128, W = 12;
      box(b, 0, 0, 0, S, S, 1, 'stone_brick'); wallRing(b, S, W, 'stone_brick');
      // corner towers - solid pillars, no overhead hollow
      [[-50, -50], [50, -50], [-50, 50], [50, 50]].forEach(([x, z]) => { pillar(b, x, z, 8, 8, 6, 'cobble'); });
      // inner walls for cover
      box(b, -20, 2, 0, 2, 24, 2, 'stone_brick'); box(b, 20, 2, 0, 2, 24, 2, 'stone_brick');
      box(b, 0, 2, -20, 24, 2, 2, 'stone_brick'); box(b, 0, 2, 20, 24, 2, 2, 'stone_brick');
      // central pillar
      pillar(b, 0, 0, 4, 4, 5, 'stone_brick');
      // crates
      [[-35, -10], [-35, 10], [35, -10], [35, 10], [-10, -35], [10, -35], [-10, 35], [10, 35]].forEach(([x, z]) => { box(b, x, 1, z, 2, 2, 1, 'planks'); });
      return b;
    },
  };

  const sumo = {
    id: 'sumo', name: 'Sumo Ring', mode: 'pvp', allowBuild: false, noEnclose: true,
    desc: 'Knockback arena with a central ring and edge danger. No roof, open sky.',
    skyTop: '#ff7b47', skyBot: '#ffd29d', fogColor: 0xfad2a6,
    theme: { skyTop: '#ff7b47', skyBottom: '#ffd29d', fog: 0xfad2a6, fogNear: 50, fogFar: 195, hemiSky: 0xffe6d2, hemiGround: 0x6b4a3a, sunColor: 0xffd0a0, sunIntensity: 1.05, clouds: 10 },
    voidY: -14,
    spawns: [
      { x: 0, y: 0.1, z: 4, yaw: 0, team: 'blue' }, { x: 0, y: 0.1, z: -4, yaw: Math.PI, team: 'red' },
      { x: 4, y: 0.1, z: 0, yaw: Math.PI / 2, team: 'green' }, { x: -4, y: 0.1, z: 0, yaw: -Math.PI / 2, team: 'yellow' },
    ],
    build() {
      const b = []; const S = 128, W = 12;
      box(b, 0, 0, 0, S, S, 1, 'planks'); wallRing(b, S, W);
      // central raised ring - solid base, no hollow underneath
      pillar(b, 0, 0, 20, 20, 2, 'stone_brick');
      box(b, 0, 2.5, 0, 12, 12, 0.5, 'wool_red');
      // corner pillars
      [[-40, -40], [40, -40], [-40, 40], [40, 40]].forEach(([x, z]) => { pillar(b, x, z, 3, 3, 3, 'log'); });
      // side bumpers
      [[-25, 0], [25, 0], [0, -25], [0, 25]].forEach(([x, z]) => { box(b, x, 1, z, 4, 2, 1, 'cobble'); });
      return b;
    },
  };

  const bridge = {
    id: 'bridge', name: 'Bridge Duel', mode: 'pvp', allowBuild: true, noEnclose: true,
    desc: 'A wide bridge arena with side platforms and cover. No roof, open sky.',
    skyTop: '#162544', skyBot: '#466a9e', fogColor: 0x3b5987,
    theme: { skyTop: '#162544', skyBottom: '#466a9e', fog: 0x3b5987, fogNear: 45, fogFar: 185, hemiSky: 0xbfd6ff, hemiGround: 0x2a3550, sunColor: 0xdfeaff, sunIntensity: 0.72, night: true, clouds: 8 },
    voidY: -16,
    spawns: [
      { x: 0, y: 1.1, z: 19, yaw: 0, team: 'blue' }, { x: 0, y: 1.1, z: -19, yaw: Math.PI, team: 'red' },
      { x: 2, y: 1.1, z: 19, yaw: 0, team: 'blue' }, { x: -2, y: 1.1, z: -19, yaw: Math.PI, team: 'red' },
    ],
    build() {
      const b = []; const S = 128, W = 12;
      box(b, 0, 0, 0, S, S, 1, 'stone_brick'); wallRing(b, S, W);
      // main bridge lane
      box(b, 0, 1, 0, 10, 100, 1, 'planks');
      // side platforms - solid from ground
      pillar(b, -30, 30, 12, 12, 2, 'cobble'); pillar(b, 30, 30, 12, 12, 2, 'cobble');
      pillar(b, -30, -30, 12, 12, 2, 'cobble'); pillar(b, 30, -30, 12, 12, 2, 'cobble');
      // center bump (sits on the deck top)
      box(b, 0, 2, 0, 6, 6, 1, 'stone_brick');
      // cover
      [[-15, 15], [15, 15], [-15, -15], [15, -15]].forEach(([x, z]) => { box(b, x, 1, z, 2, 4, 1, 'wool_blue'); });
      return b;
    },
  };

  const inferno = {
    id: 'inferno', name: 'Inferno Keep', mode: 'pvp', allowBuild: true, noEnclose: true,
    desc: 'A nether fortress arena with obsidian pillars and cover. No roof, open sky.',
    skyTop: '#2a0b0b', skyBot: '#7a2412', fogColor: 0x5c1a10,
    theme: { skyTop: '#2a0b0b', skyBottom: '#7a2412', fog: 0x5c1a10, fogNear: 32, fogFar: 150, hemiSky: 0xffb08a, hemiGround: 0x2a0a0a, sunColor: 0xff7a45, sunIntensity: 0.6, night: true, clouds: 5 },
    voidY: -16,
    spawns: [
      { x: 0, y: 0.1, z: 14, yaw: 0, team: 'blue' }, { x: 0, y: 0.1, z: -14, yaw: Math.PI, team: 'red' },
      { x: 14, y: 0.1, z: 0, yaw: Math.PI / 2, team: 'green' }, { x: -14, y: 0.1, z: 0, yaw: -Math.PI / 2, team: 'yellow' },
    ],
    build() {
      const b = []; const S = 128, W = 12;
      box(b, 0, 0, 0, S, S, 1, 'netherrack'); wallRing(b, S, W, 'nether_brick');
      // obsidian pillars
      [[-35, -35], [35, -35], [-35, 35], [35, 35], [0, -45], [0, 45], [-45, 0], [45, 0]].forEach(([x, z]) => { pillar(b, x, z, 3, 3, 5, 'obsidian'); });
      // central fort - solid
      pillar(b, 0, 0, 10, 10, 3, 'nether_brick');
      box(b, 0, 3.5, 0, 6, 6, 0.5, 'obsidian');
      // cover walls
      box(b, -18, 2, 0, 2, 12, 2, 'nether_brick'); box(b, 18, 2, 0, 2, 12, 2, 'nether_brick');
      box(b, 0, 2, -18, 12, 2, 2, 'nether_brick'); box(b, 0, 2, 18, 12, 2, 2, 'nether_brick');
      return b;
    },
  };

  const frostbite = {
    id: 'frostbite', name: 'Frostbite Basin', mode: 'pvp', allowBuild: true, noEnclose: true,
    desc: 'A frozen arena with ice patches, snow mounds, and quartz pillars. No roof, open sky.',
    skyTop: '#22508e', skyBot: '#d8ecff', fogColor: 0xcfe6f7,
    theme: { skyTop: '#22508e', skyBottom: '#d8ecff', fog: 0xcfe6f7, fogNear: 45, fogFar: 190, hemiSky: 0xeaf6ff, hemiGround: 0x6b7f92, sunColor: 0xeaf4ff, sunIntensity: 0.95, clouds: 12 },
    voidY: -16,
    spawns: [
      { x: 0, y: 0.1, z: 15, yaw: 0, team: 'blue' }, { x: 0, y: 0.1, z: -15, yaw: Math.PI, team: 'red' },
      { x: 15, y: 0.1, z: 0, yaw: Math.PI / 2, team: 'green' }, { x: -15, y: 0.1, z: 0, yaw: -Math.PI / 2, team: 'yellow' },
    ],
    build() {
      const b = []; const S = 128, W = 12;
      box(b, 0, 0, 0, S, S, 1, 'snow'); wallRing(b, S, W, 'ice');
      // ice patches
      [[-25, -25, 12], [25, 25, 12], [-25, 25, 10], [25, -25, 10], [0, 0, 14]].forEach(([x, z, s]) => { box(b, x, 0.05, z, s, s, 0.05, 'ice'); });
      // snow mounds / pillars
      [[-45, -45], [45, -45], [-45, 45], [45, 45]].forEach(([x, z]) => { pillar(b, x, z, 5, 5, 3, 'quartz'); });
      pillar(b, 0, -35, 4, 4, 4, 'quartz'); pillar(b, 0, 35, 4, 4, 4, 'quartz');
      // low cover
      [[-15, 0], [15, 0], [0, -15], [0, 15]].forEach(([x, z]) => { box(b, x, 1, z, 3, 3, 1, 'snow'); });
      return b;
    },
  };

  const dunes = {
    id: 'dunes', name: 'Dune Bastion', mode: 'pvp', allowBuild: true, noEnclose: true,
    desc: 'A sunbaked arena with sandstone pillars, dunes, and cover. No roof, open sky.',
    skyTop: '#e99a3e', skyBot: '#ffe2a8', fogColor: 0xf2c682,
    theme: { skyTop: '#e99a3e', skyBottom: '#ffe2a8', fog: 0xf2c682, fogNear: 58, fogFar: 245, hemiSky: 0xfff2dc, hemiGround: 0x8a6038, sunColor: 0xffd890, sunIntensity: 1.08, clouds: 7 },
    voidY: -18,
    spawns: [
      { x: 0, y: 0.02, z: 25, yaw: 0, team: 'blue' }, { x: 0, y: 0.02, z: -25, yaw: Math.PI, team: 'red' },
      { x: 25, y: 0.02, z: 0, yaw: Math.PI / 2, team: 'green' }, { x: -25, y: 0.02, z: 0, yaw: -Math.PI / 2, team: 'yellow' },
      { x: 18, y: 0.02, z: 18, yaw: Math.PI / 4, team: 'blue' }, { x: -18, y: 0.02, z: -18, yaw: -3 * Math.PI / 4, team: 'red' },
    ],
    build() {
      const b = []; const S = 128, W = 12;
      box(b, 0, 0, 0, S, S, 1, 'sandstone'); wallRing(b, S, W, 'sandstone');
      // dunes - stepped mounds, solid
      pillar(b, -30, -30, 10, 10, 2, 'sandstone'); box(b, -30, 3, -30, 6, 6, 1, 'sandstone');
      pillar(b, 30, 30, 10, 10, 2, 'sandstone'); box(b, 30, 3, 30, 6, 6, 1, 'sandstone');
      pillar(b, -30, 30, 8, 8, 2, 'sandstone'); pillar(b, 30, -30, 8, 8, 2, 'sandstone');
      // central obelisk
      pillar(b, 0, 0, 4, 4, 6, 'sandstone');
      // cover
      [[-15, 0], [15, 0], [0, -15], [0, 15], [-45, 10], [45, -10]].forEach(([x, z]) => { box(b, x, 1, z, 3, 2, 1, 'cobble'); });
      return b;
    },
  };

  const citadel = {
    id: 'citadel', name: 'Citadel Siege', mode: 'pvp', allowBuild: true, noEnclose: true, isNew: true,
    desc: 'A multi-tier castle with towers, sky bridges and moving lifts. No roof, open sky.',
    skyTop: '#33538f', skyBot: '#d3e4ff', fogColor: 0xc9dcf5,
    theme: { skyTop: '#33538f', skyBottom: '#d3e4ff', fog: 0xc9dcf5, fogNear: 55, fogFar: 225, hemiSky: 0xe8f2ff, hemiGround: 0x4e5a52, sunColor: 0xfff0d2, sunIntensity: 1.02, clouds: 13 },
    voidY: -18,
    spawns: [
      { x: 0, y: 0.02, z: 26, yaw: 0, team: 'blue' }, { x: 0, y: 0.02, z: -26, yaw: Math.PI, team: 'red' },
      { x: 26, y: 0.02, z: 0, yaw: Math.PI / 2, team: 'green' }, { x: -26, y: 0.02, z: 0, yaw: -Math.PI / 2, team: 'yellow' },
      { x: 18, y: 0.02, z: 18, yaw: Math.PI / 4, team: 'blue' }, { x: -18, y: 0.02, z: -18, yaw: -3 * Math.PI / 4, team: 'red' },
    ],
    build() {
      const b = []; const S = 128, W = 12;
      box(b, 0, 0, 0, S, S, 1, 'stone_brick'); wallRing(b, S, W, 'stone_brick');
      // corner towers with battlements
      [[-44, -44], [44, -44], [-44, 44], [44, 44]].forEach(([x, z]) => {
        pillar(b, x, z, 8, 8, 6, 'cobble');
        box(b, x - 3.2, 6.6, z, 1.2, 1.2, 0.6, 'stone_brick');
        box(b, x + 3.2, 6.6, z, 1.2, 1.2, 0.6, 'stone_brick');
        box(b, x, 6.6, z - 3.2, 1.2, 1.2, 0.6, 'stone_brick');
        box(b, x, 6.6, z + 3.2, 1.2, 1.2, 0.6, 'stone_brick');
      });
      // central keep, stacked tiers (no ceilings)
      box(b, 0, 2, 0, 18, 18, 2, 'stone_brick');
      box(b, 0, 5, 0, 12, 12, 3, 'stone_brick');
      box(b, 0, 6, 0, 6, 6, 1, 'glowstone');
      // keep stairs on both z faces
      for (const s of [1, -1]) {
        box(b, 0, 1, s * 11, 6, 2, 1, 'stone_brick');
        box(b, 0, 2, s * 10.2, 6, 2, 1, 'stone_brick');
        box(b, 0, 3, s * 9.4, 6, 2, 1, 'stone_brick');
      }
      // open sky bridges between towers
      box(b, 0, 4, 44, 80, 2, 0.5, 'planks'); box(b, 0, 4, -44, 80, 2, 0.5, 'planks');
      box(b, 44, 4, 0, 2, 80, 0.5, 'planks'); box(b, -44, 4, 0, 2, 80, 0.5, 'planks');
      // moving lifts + patrol platforms
      mover(b, 14, 2.2, 0, 4, 4, 0.6, 'planks', 'y', 1.4, 0.9, 0);
      mover(b, -14, 2.2, 0, 4, 4, 0.6, 'planks', 'y', 1.4, 0.9, Math.PI);
      mover(b, 0, 3, 20, 5, 2, 0.6, 'planks', 'x', 6, 0.8, 0.5);
      mover(b, 0, 3, -20, 5, 2, 0.6, 'planks', 'x', 6, 0.8, 2.6);
      // crates
      [[-25, -10], [25, 10], [-10, 25], [10, -25], [-20, 20], [20, -20]].forEach(([x, z]) => { box(b, x, 1, z, 2, 2, 1, 'planks'); });
      return b;
    },
  };

  const foundry = {
    id: 'foundry', name: 'Iron Foundry', mode: 'pvp', allowBuild: true, noEnclose: true, isNew: true,
    desc: 'An industrial arena with sliding piston walls, catwalks and furnace cover. No roof, open sky.',
    skyTop: '#2a2f38', skyBot: '#8d949c', fogColor: 0x6f767e,
    theme: { skyTop: '#2a2f38', skyBottom: '#8d949c', fog: 0x6f767e, fogNear: 42, fogFar: 180, hemiSky: 0xd7dee6, hemiGround: 0x2e3238, sunColor: 0xe8eef5, sunIntensity: 0.85, clouds: 9 },
    voidY: -17,
    spawns: [
      { x: 0, y: 0.02, z: 22, yaw: 0, team: 'blue' }, { x: 0, y: 0.02, z: -22, yaw: Math.PI, team: 'red' },
      { x: 22, y: 0.02, z: 0, yaw: Math.PI / 2, team: 'green' }, { x: -22, y: 0.02, z: 0, yaw: -Math.PI / 2, team: 'yellow' },
      { x: 16, y: 0.02, z: 16, yaw: Math.PI / 4, team: 'blue' }, { x: -16, y: 0.02, z: -16, yaw: -3 * Math.PI / 4, team: 'red' },
    ],
    build() {
      const b = []; const S = 128, W = 12;
      box(b, 0, 0, 0, S, S, 1, 'stone_brick'); wallRing(b, S, W, 'bricks');
      // central furnace stack
      box(b, 0, 2, 0, 14, 14, 2, 'stone_brick');
      box(b, 0, 3, 0, 8, 8, 1, 'obsidian');
      box(b, 0, 4, 0, 4, 4, 1, 'glowstone');
      // sliding piston walls
      mover(b, 0, 3, -32, 1, 8, 3, 'stone_brick', 'x', 6, 0.9, 0);
      mover(b, 0, 3, 32, 1, 8, 3, 'stone_brick', 'x', 6, 0.9, Math.PI);
      mover(b, -32, 3, 0, 8, 1, 3, 'obsidian', 'z', 6, 0.9, Math.PI / 2);
      mover(b, 32, 3, 0, 8, 1, 3, 'obsidian', 'z', 6, 0.9, 3 * Math.PI / 2);
      // bob platforms
      mover(b, -12, 1.5, 0, 4, 4, 0.5, 'planks', 'y', 1.0, 1.0, 0);
      mover(b, 12, 1.5, 0, 4, 4, 0.5, 'planks', 'y', 1.0, 1.0, Math.PI);
      // cover
      [[-20, 20], [20, 20], [-20, -20], [20, -20]].forEach(([x, z]) => { box(b, x, 1, z, 2, 2, 1, 'planks'); });
      [[-36, -36], [36, -36], [-36, 36], [36, 36]].forEach(([x, z]) => { pillar(b, x, z, 4, 4, 3, 'obsidian'); });
      return b;
    },
  };

  const skyway = {
    id: 'skyway', name: 'Skyway Islands', mode: 'pvp', allowBuild: true, noEnclose: true, isNew: true,
    desc: 'Floating islands linked by moving platforms over the void. No roof, pure sky.',
    skyTop: '#1f4f8f', skyBot: '#cfe9ff', fogColor: 0xc2e2fb,
    theme: { skyTop: '#1f4f8f', skyBottom: '#cfe9ff', fog: 0xc2e2fb, fogNear: 70, fogFar: 260, hemiSky: 0xe6f5ff, hemiGround: 0x4c6a5c, sunColor: 0xfff4de, sunIntensity: 1.06, clouds: 20 },
    voidY: -22,
    spawns: [
      { x: 0, y: 0.02, z: 8, yaw: 0, team: 'blue' }, { x: 0, y: 0.02, z: -8, yaw: Math.PI, team: 'red' },
      { x: 8, y: 0.02, z: 0, yaw: Math.PI / 2, team: 'green' }, { x: -8, y: 0.02, z: 0, yaw: -Math.PI / 2, team: 'yellow' },
      { x: 36, y: 1.02, z: 0, yaw: Math.PI / 2, team: 'blue' }, { x: -36, y: 1.02, z: 0, yaw: -Math.PI / 2, team: 'red' },
    ],
    build() {
      const b = []; const S = 128, W = 24;
      wallRing(b, S, W, 'wall');
      // central island + four side islands + high island
      box(b, 0, 0, 0, 26, 26, 1, 'grass');
      box(b, 36, 1, 0, 14, 14, 1, 'grass'); box(b, -36, 1, 0, 14, 14, 1, 'grass');
      box(b, 0, 1, 36, 14, 14, 1, 'grass'); box(b, 0, 1, -36, 14, 14, 1, 'grass');
      box(b, 0, 6, -55, 10, 8, 1, 'quartz');
      // grapple pillars on the central island
      [[-10, -10], [10, -10], [-10, 10], [10, 10]].forEach(([x, z]) => { pillar(b, x, z, 2, 2, 6, 'log'); });
      // moving bridges between islands
      mover(b, 21, 1.5, 0, 4, 4, 0.5, 'planks', 'x', 5, 0.7, 0);
      mover(b, -21, 1.5, 0, 4, 4, 0.5, 'planks', 'x', 5, 0.7, Math.PI);
      mover(b, 0, 1.5, 21, 4, 4, 0.5, 'planks', 'z', 5, 0.7, Math.PI / 2);
      mover(b, 0, 1.5, -21, 4, 4, 0.5, 'planks', 'z', 5, 0.7, 3 * Math.PI / 2);
      mover(b, 0, 3, -46.5, 4, 4, 0.6, 'planks', 'y', 2.5, 0.8, 0);
      // island cover
      [[36, 6], [36, -6], [-36, 6], [-36, -6], [6, 36], [-6, 36], [6, -36], [-6, -36]].forEach(([x, z]) => {
        box(b, x, 2, z, 2, 2, 1, 'wool_white');
      });
      return b;
    },
  };

  const colosseum = {
    id: 'colosseum', name: 'Titan Colosseum', mode: 'pvp', allowBuild: true, noEnclose: true, isNew: true,
    desc: 'A tiered arena with sweeping blade walls and rising side platforms. No roof, open sky.',
    skyTop: '#c98a3c', skyBot: '#ffe7b5', fogColor: 0xf2cf94,
    theme: { skyTop: '#c98a3c', skyBottom: '#ffe7b5', fog: 0xf2cf94, fogNear: 58, fogFar: 230, hemiSky: 0xfff0d6, hemiGround: 0x8a6438, sunColor: 0xffd894, sunIntensity: 1.1, clouds: 8 },
    voidY: -17,
    spawns: [
      { x: 0, y: 0.02, z: 10, yaw: 0, team: 'blue' }, { x: 0, y: 0.02, z: -10, yaw: Math.PI, team: 'red' },
      { x: 10, y: 0.02, z: 0, yaw: Math.PI / 2, team: 'green' }, { x: -10, y: 0.02, z: 0, yaw: -Math.PI / 2, team: 'yellow' },
      { x: 18, y: 0.02, z: 18, yaw: Math.PI / 4, team: 'blue' }, { x: -18, y: 0.02, z: -18, yaw: -3 * Math.PI / 4, team: 'red' },
    ],
    build() {
      const b = []; const S = 128, W = 12;
      box(b, 0, 0, 0, S, S, 1, 'sandstone'); wallRing(b, S, W, 'sandstone');
      // tiered rings, open corners
      box(b, 0, 2, 44, 80, 8, 2, 'sandstone'); box(b, 0, 2, -44, 80, 8, 2, 'sandstone');
      box(b, 44, 2, 0, 8, 80, 2, 'sandstone'); box(b, -44, 2, 0, 8, 80, 2, 'sandstone');
      box(b, 0, 4, 34, 60, 5, 2, 'stone_brick'); box(b, 0, 4, -34, 60, 5, 2, 'stone_brick');
      box(b, 34, 4, 0, 5, 60, 2, 'stone_brick'); box(b, -34, 4, 0, 5, 60, 2, 'stone_brick');
      box(b, 0, 6, 24, 40, 4, 2, 'quartz'); box(b, 0, 6, -24, 40, 4, 2, 'quartz');
      box(b, 24, 6, 0, 4, 40, 2, 'quartz'); box(b, -24, 6, 0, 4, 40, 2, 'quartz');
      // central dais
      pillar(b, 0, 0, 14, 14, 2, 'stone_brick');
      box(b, 0, 2.5, 0, 8, 8, 0.5, 'wool_red');
      // sweeping blade walls
      mover(b, 0, 2, -14, 6, 1, 2, 'obsidian', 'x', 10, 0.8, 0);
      mover(b, 0, 2, 14, 6, 1, 2, 'obsidian', 'x', 10, 0.8, Math.PI);
      mover(b, -14, 2, 0, 1, 6, 2, 'obsidian', 'z', 10, 0.8, Math.PI / 2);
      mover(b, 14, 2, 0, 1, 6, 2, 'obsidian', 'z', 10, 0.8, 3 * Math.PI / 2);
      // rising side platforms
      mover(b, 18, 2, 0, 4, 4, 0.5, 'planks', 'y', 1.2, 0.9, 0);
      mover(b, -18, 2, 0, 4, 4, 0.5, 'planks', 'y', 1.2, 0.9, Math.PI);
      return b;
    },
  };

  const reactor = {
    id: 'reactor', name: 'Reactor Core', mode: 'pvp', allowBuild: true, noEnclose: true, isNew: true,
    desc: 'A sci-fi core arena with orbiting platforms and glowing cover. No roof, open sky.',
    skyTop: '#0d1630', skyBot: '#2f4d86', fogColor: 0x1d3054,
    theme: { skyTop: '#0d1630', skyBottom: '#2f4d86', fog: 0x1d3054, fogNear: 40, fogFar: 190, hemiSky: 0xbfd8ff, hemiGround: 0x141a26, sunColor: 0x9fd0ff, sunIntensity: 0.8, night: true, clouds: 5 },
    voidY: -18,
    spawns: [
      { x: 16, y: 0.02, z: 16, yaw: Math.PI / 4, team: 'blue' }, { x: -16, y: 0.02, z: -16, yaw: -3 * Math.PI / 4, team: 'red' },
      { x: 16, y: 0.02, z: -16, yaw: -Math.PI / 4, team: 'green' }, { x: -16, y: 0.02, z: 16, yaw: 3 * Math.PI / 4, team: 'yellow' },
      { x: 0, y: 0.02, z: 20, yaw: 0, team: 'blue' }, { x: 0, y: 0.02, z: -20, yaw: Math.PI, team: 'red' },
    ],
    build() {
      const b = []; const S = 128, W = 12;
      box(b, 0, 0, 0, S, S, 1, 'deepslate'); wallRing(b, S, W, 'quartz');
      // central reactor
      pillar(b, 0, 0, 10, 10, 4, 'obsidian');
      box(b, 0, 4.5, 0, 6, 6, 0.5, 'glowstone');
      // corner spires
      [[-28, -28], [28, -28], [-28, 28], [28, 28]].forEach(([x, z]) => { pillar(b, x, z, 4, 4, 6, 'quartz'); });
      // amethyst cover
      [[-12, -12], [12, -12], [-12, 12], [12, 12]].forEach(([x, z]) => { box(b, x, 1, z, 3, 3, 1, 'amethyst'); });
      // orbiting platforms
      mover(b, 14, 2, 0, 4, 4, 0.6, 'planks', 'x', 6, 0.7, 0);
      mover(b, -14, 2, 0, 4, 4, 0.6, 'planks', 'x', 6, 0.7, Math.PI);
      mover(b, 0, 2, 14, 4, 4, 0.6, 'planks', 'z', 6, 0.7, Math.PI / 2);
      mover(b, 0, 2, -14, 4, 4, 0.6, 'planks', 'z', 6, 0.7, 3 * Math.PI / 2);
      // vertical lifts
      mover(b, 0, 2.5, 28, 4, 4, 0.5, 'prismarine', 'y', 1.5, 0.9, 0);
      mover(b, 0, 2.5, -28, 4, 4, 0.5, 'prismarine', 'y', 1.5, 0.9, Math.PI);
      // low cover
      [[-40, 0], [40, 0], [0, -40], [0, 40]].forEach(([x, z]) => { box(b, x, 1, z, 3, 2, 1, 'obsidian'); });
      return b;
    },
  };

  const ffa = {
    id: 'ffa', name: 'Free For All', mode: 'pvp', allowBuild: true, noEnclose: true, isNew: true,
    desc: 'A symmetric free-for-all arena with eight spawns, a central dais and raised side platforms. No roof, open sky.',
    skyTop: '#2b3a86', skyBot: '#ffe0b0', fogColor: 0xf7d8ad,
    theme: { skyTop: '#2b3a86', skyBottom: '#ffe0b0', fog: 0xf7d8ad, fogNear: 60, fogFar: 235, hemiSky: 0xfff0dc, hemiGround: 0x54495c, sunColor: 0xffdca0, sunIntensity: 1.04, clouds: 11 },
    voidY: -17,
    spawns: [
      { x: 24, y: 0.02, z: 24, yaw: Math.PI / 4, team: 'blue' },
      { x: -24, y: 0.02, z: 24, yaw: -Math.PI / 4, team: 'red' },
      { x: -24, y: 0.02, z: -24, yaw: -3 * Math.PI / 4, team: 'green' },
      { x: 24, y: 0.02, z: -24, yaw: 3 * Math.PI / 4, team: 'yellow' },
      { x: 0, y: 0.02, z: 24, yaw: 0, team: 'blue' },
      { x: 0, y: 0.02, z: -24, yaw: Math.PI, team: 'red' },
      { x: 24, y: 0.02, z: 0, yaw: Math.PI / 2, team: 'green' },
      { x: -24, y: 0.02, z: 0, yaw: -Math.PI / 2, team: 'yellow' },
    ],
    build() {
      const b = []; const S = 128, W = 12;
      box(b, 0, 0, 0, S, S, 1, 'stone_brick'); wallRing(b, S, W, 'stone_brick');
      // central dais with four stair approaches
      box(b, 0, 2, 0, 18, 18, 2, 'stone_brick');
      box(b, 0, 2.5, 0, 10, 10, 0.5, 'wool_white');
      [[6, 0], [-6, 0], [0, 6], [0, -6]].forEach(([x, z]) => { box(b, x, 2.5, z, 1.5, 1.5, 0.5, 'glowstone'); });
      for (const s of [1, -1]) {
        box(b, 0, 2, s * 10, 8, 2, 1, 'stone_brick');
        box(b, 0, 1, s * 12.5, 8, 3, 1, 'stone_brick');
        box(b, s * 10, 2, 0, 2, 8, 1, 'stone_brick');
        box(b, s * 12.5, 1, 0, 3, 8, 1, 'stone_brick');
      }
      // raised side platforms
      [[40, 0], [-40, 0], [0, 40], [0, -40]].forEach(([x, z]) => { pillar(b, x, z, 10, 10, 2, 'quartz'); });
      box(b, 33.5, 1, 0, 3, 6, 1, 'planks'); box(b, -33.5, 1, 0, 3, 6, 1, 'planks');
      box(b, 0, 1, 33.5, 6, 3, 1, 'planks'); box(b, 0, 1, -33.5, 6, 3, 1, 'planks');
      // corner towers + grapple pillars
      [[-52, -52], [52, -52], [-52, 52], [52, 52]].forEach(([x, z]) => { pillar(b, x, z, 6, 6, 5, 'bricks'); });
      [[20, 36], [-20, 36], [20, -36], [-20, -36], [36, 20], [-36, 20], [36, -20], [-36, -20]].forEach(([x, z]) => { pillar(b, x, z, 2, 2, 4, 'log'); });
      // cover
      [[12, 12], [-12, 12], [12, -12], [-12, -12]].forEach(([x, z]) => { box(b, x, 1, z, 2, 2, 1, 'wool_red'); });
      [[16, 0], [-16, 0], [0, 16], [0, -16]].forEach(([x, z]) => { box(b, x, 1, z, 2, 2, 1, 'wool_blue'); });
      [[28, 28], [-28, 28], [28, -28], [-28, -28]].forEach(([x, z]) => { pillar(b, x, z, 3, 3, 2, 'obsidian'); });
      return b;
    },
  };

  const parkour = {
    id: 'parkour', name: 'Sky Parkour Race', mode: 'parkour', allowBuild: false,
    desc: 'Speedrun or race friends across grass, ice, slime bounce pads & neo-jumps!',
    skyTop: '#2b77db', skyBot: '#c6e6fa', fogColor: 0xc6e6fa, voidY: -18,
    spawns: [
      { x: 0, y: 0.1, z: 0, yaw: 0, team: 'blue' }, { x: -1.5, y: 0.1, z: 0, yaw: 0, team: 'red' },
      { x: 1.5, y: 0.1, z: 0, yaw: 0, team: 'green' }, { x: 0, y: 0.1, z: 1.5, yaw: 0, team: 'yellow' },
    ],
    build() {
      const b = [{ x: 0, y: 0, z: 0, w: 6, d: 6, th: 1, t: 'grass' }];
      const steps = [
        [2, 0, 0, 3, 'stone_brick'], [2.5, 0, 1.5, 2, 'planks'], [2.5, 1, -1.5, 2, 'grass'],
        [2, 0, 0, 4, 'cp'], [3, 0, 0, 2, 'ice'], [3.5, 0, 0, 2, 'ice'],
        [3, 0, 0, 4, 'cp'], [3, -1, 0, 2, 'slime'], [3.5, 2, 0, 3, 'stone_brick'],
        [2, 0, 1.5, 2, 'planks'], [2.5, 0, -1.5, 2, 'planks'], [2, 1, 0, 3, 'gold'], [2.5, 0, 0, 6, 'finish'],
      ];
      let z = -3, x = 0, y = 0;
      for (const [g, dy, xo, w, t] of steps) {
        const d = (t === 'finish') ? 6 : (t === 'cp' ? 4 : 2);
        z -= g; x += xo; y += dy;
        b.push({ x, y, z: z - d / 2, w, d, th: 1, t });
        z -= d;
      }
      return b;
    },
  };

  VOX.Arenas = {
    field, courtyard, sumo, bridge, inferno, frostbite, dunes,
    citadel, foundry, skyway, colosseum, reactor, ffa, parkour,
  };
})(window);
