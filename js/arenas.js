// Minecraft-style Voxel Arenas (PvP, Bridge Duel, Sumo, Parkour, Bridge Lab)
// Clean non-overlapping coordinates to prevent any Z-fighting or polygon glitches.
(function (global) {
  const VOX = (global.VOX = global.VOX || {});

  function addTree(boxes, x, y, z) {
    // Oak trunk (1x4x1) with two canopy tiers stacked flush on top
    boxes.push({ x: x + 0.5, y: y + 4, z: z + 0.5, w: 1, d: 1, th: 4, t: 'log' });
    boxes.push({ x: x + 0.5, y: y + 6, z: z + 0.5, w: 3, d: 3, th: 2, t: 'leaves' });
    boxes.push({ x: x + 0.5, y: y + 7, z: z + 0.5, w: 1, d: 1, th: 1, t: 'leaves' });
  }

  function addIsland(boxes, cx, cy, cz, size, topType = 'grass') {
    // Top layer (thickness 1)
    boxes.push({ x: cx, y: cy, z: cz, w: size, d: size, th: 1, t: topType });
    // Tapered dirt/stone underside so floating islands look like Minecraft sky islands
    if (size >= 5) {
      boxes.push({ x: cx, y: cy - 1, z: cz, w: size - 2, d: size - 2, th: 1, t: 'dirt' });
    }
    if (size >= 7) {
      boxes.push({ x: cx, y: cy - 2, z: cz, w: size - 4, d: size - 4, th: 1, t: 'stone' });
    }
  }

  const ARENAS = {
    sky: {
      id: 'sky',
      name: 'Sky Islands',
      mode: 'pvp',
      allowBuild: true,
      desc: 'Floating Minecraft islands — bridge, knock friends into the void, control mid!',
      skyTop: '#2a6fd1',
      skyBot: '#c2e4fa',
      fogColor: 0xc2e4fa,
      theme: { skyTop: '#2a6fd1', skyBottom: '#c2e4fa', fog: 0xc2e4fa, fogNear: 55, fogFar: 215, hemiSky: 0xdfefff, hemiGround: 0x4c6a4a, sunColor: 0xfff6e2, sunIntensity: 1.0, clouds: 16 },
      voidY: -18,
      spawns: [
        { x: 0, y: 1, z: 17, yaw: 0, team: 'blue' },
        { x: 0, y: 1, z: -17, yaw: Math.PI, team: 'red' },
        { x: 17, y: 1, z: 0, yaw: Math.PI / 2, team: 'green' },
        { x: -17, y: 1, z: 0, yaw: -Math.PI / 2, team: 'yellow' },
        { x: 12, y: 1, z: 12, yaw: Math.PI / 4, team: 'blue' },
        { x: -12, y: 1, z: -12, yaw: -3 * Math.PI / 4, team: 'red' },
      ],
      build() {
        const b = [];
        // Center Emerald/Diamond Island
        addIsland(b, 0, 0, 0, 9, 'grass');
        b.push({ x: 0, y: 1, z: 0, w: 3, d: 3, th: 1, t: 'stone_brick' });
        b.push({ x: 0, y: 2, z: 0, w: 1, d: 1, th: 1, t: 'diamond' });
        // 4 corner pillars at mid
        [[-3.5, -3.5], [3.5, -3.5], [-3.5, 3.5], [3.5, 3.5]].forEach(([px, pz]) => {
          b.push({ x: px, y: 3, z: pz, w: 1, d: 1, th: 3, t: 'stone_brick' });
        });

        // 4 cardinal spawn islands
        addIsland(b, 0, 0, 17, 7, 'grass');
        addTree(b, 2, 0, 18);

        addIsland(b, 0, 0, -17, 7, 'grass');
        addTree(b, -3, 0, -19);

        addIsland(b, 17, 0, 0, 7, 'grass');
        addTree(b, 18, 0, 2);

        addIsland(b, -17, 0, 0, 7, 'grass');
        addTree(b, -19, 0, -3);

        // Intermediate stepping stones (slime + planks)
        b.push({ x: 0, y: 0, z: 9, w: 3, d: 3, th: 1, t: 'planks' });
        b.push({ x: 0, y: 0, z: -9, w: 3, d: 3, th: 1, t: 'planks' });
        b.push({ x: 9, y: 0, z: 0, w: 3, d: 3, th: 1, t: 'planks' });
        b.push({ x: -9, y: 0, z: 0, w: 3, d: 3, th: 1, t: 'planks' });

        // Gold mini-islands on diagonals with slime launch pads
        [[11, 11], [-11, -11]].forEach(([ix, iz]) => {
          addIsland(b, ix, 0, iz, 5, 'stone_brick');
          b.push({ x: ix, y: 1, z: iz, w: 1, d: 1, th: 1, t: 'gold' });
        });
        [[-11, 11], [11, -11]].forEach(([ix, iz]) => {
          addIsland(b, ix, 0, iz, 5, 'cobble');
          b.push({ x: ix, y: 1, z: iz, w: 1, d: 1, th: 1, t: 'slime' });
        });

        return b;
      },
    },

    courtyard: {
      id: 'courtyard',
      name: 'Castle Courtyard',
      mode: 'pvp',
      allowBuild: true,
      desc: 'Walled medieval courtyard with wooden catwalks, towers & tactical cover.',
      skyTop: '#3276d4',
      skyBot: '#cce7fb',
      fogColor: 0xcce7fb,
      theme: { skyTop: '#3276d4', skyBottom: '#cce7fb', fog: 0xcce7fb, fogNear: 55, fogFar: 215, hemiSky: 0xe6f3ff, hemiGround: 0x556048, sunColor: 0xfff2d8, sunIntensity: 1.0, clouds: 14 },
      voidY: -15,
      spawns: [
        { x: 0, y: 0.1, z: 12, yaw: 0, team: 'blue' },
        { x: 0, y: 0.1, z: -12, yaw: Math.PI, team: 'red' },
        { x: 12, y: 0.1, z: 0, yaw: Math.PI / 2, team: 'green' },
        { x: -12, y: 0.1, z: 0, yaw: -Math.PI / 2, team: 'yellow' },
      ],
      build() {
        const b = [];
        const S = 32;
        // Main grass floor
        b.push({ x: 0, y: 0, z: 0, w: S, d: S, th: 1, t: 'grass' });
        // Stone brick cross paths (elevated 0.05 -> NO, use non-overlapping inset or +0.02? Better: build flush or step up 0.25!)
        // Stepping up 0.25 avoids any Z-fighting AND makes cool stone slabs!
        b.push({ x: 0, y: 0.25, z: 8, w: 4, d: 10, th: 0.25, t: 'stone_brick' });
        b.push({ x: 0, y: 0.25, z: -8, w: 4, d: 10, th: 0.25, t: 'stone_brick' });
        b.push({ x: 8, y: 0.25, z: 0, w: 10, d: 4, th: 0.25, t: 'stone_brick' });
        b.push({ x: -8, y: 0.25, z: 0, w: 10, d: 4, th: 0.25, t: 'stone_brick' });
        b.push({ x: 0, y: 0.5, z: 0, w: 6, d: 6, th: 0.25, t: 'cobble' });
        b.push({ x: 0, y: 1.5, z: 0, w: 2, d: 2, th: 1, t: 'emerald' });

        // Outer castle walls (3 blocks tall)
        b.push({ x: 0, y: 3, z: -S / 2 - 0.5, w: S + 2, d: 1, th: 3, t: 'stone_brick' });
        b.push({ x: 0, y: 3, z: S / 2 + 0.5, w: S + 2, d: 1, th: 3, t: 'stone_brick' });
        b.push({ x: -S / 2 - 0.5, y: 3, z: 0, w: 1, d: S, th: 3, t: 'stone_brick' });
        b.push({ x: S / 2 + 0.5, y: 3, z: 0, w: 1, d: S, th: 3, t: 'stone_brick' });

        // 4 Raised corner platforms + stairs
        [[-10, -10], [10, -10], [-10, 10], [10, 10]].forEach(([cx, cz]) => {
          b.push({ x: cx, y: 2, z: cz, w: 6, d: 6, th: 2, t: 'planks' });
          // Step-up block
          const sx = cx > 0 ? cx - 3.5 : cx + 3.5;
          b.push({ x: sx, y: 1, z: cz, w: 1, d: 2, th: 1, t: 'cobble' });
        });

        // Connecting wooden sky-bridges
        b.push({ x: 0, y: 2, z: -10, w: 14, d: 2, th: 0.5, t: 'planks' });
        b.push({ x: 0, y: 2, z: 10, w: 14, d: 2, th: 0.5, t: 'planks' });

        // Corner trees
        addTree(b, -13, 0, -4);
        addTree(b, 13, 0, 4);

        return b;
      },
    },

    sumo: {
      id: 'sumo',
      name: 'Sumo Ring',
      mode: 'pvp',
      allowBuild: false,
      desc: 'Pure knockback & W-tap skill on a high floating ring. First off the edge loses!',
      skyTop: '#ff7b47',
      skyBot: '#ffd29d',
      fogColor: 0xfad2a6,
      theme: { skyTop: '#ff7b47', skyBottom: '#ffd29d', fog: 0xfad2a6, fogNear: 50, fogFar: 195, hemiSky: 0xffe6d2, hemiGround: 0x6b4a3a, sunColor: 0xffd0a0, sunIntensity: 1.05, clouds: 10 },
      voidY: -14,
      spawns: [
        { x: 0, y: 0.1, z: 4, yaw: 0, team: 'blue' },
        { x: 0, y: 0.1, z: -4, yaw: Math.PI, team: 'red' },
        { x: 4, y: 0.1, z: 0, yaw: Math.PI / 2, team: 'green' },
        { x: -4, y: 0.1, z: 0, yaw: -Math.PI / 2, team: 'yellow' },
      ],
      build() {
        const b = [];
        // Multi-ring layered platform (no overlapping surfaces)
        b.push({ x: 0, y: 0, z: 0, w: 11, d: 11, th: 1, t: 'planks' });
        b.push({ x: 0, y: -1, z: 0, w: 9, d: 9, th: 1, t: 'stone_brick' });
        b.push({ x: 0, y: -2, z: 0, w: 5, d: 5, th: 1, t: 'cobble' });
        // Corner gold trim blocks flush at y=0? Use slightly raised 0.2 cap or leave flat
        [[-5, -5], [5, -5], [-5, 5], [5, 5]].forEach(([x, z]) => {
          b.push({ x, y: 0.25, z, w: 1, d: 1, th: 0.25, t: 'gold' });
        });
        return b;
      },
    },

    bridge: {
      id: 'bridge',
      name: 'Bridge Duel',
      mode: 'pvp',
      allowBuild: true,
      desc: 'Classic narrow bridge over the void — outplay, block-clutch, and knock opponents off!',
      skyTop: '#162544',
      skyBot: '#466a9e',
      fogColor: 0x3b5987,
      theme: { skyTop: '#162544', skyBottom: '#466a9e', fog: 0x3b5987, fogNear: 45, fogFar: 185, hemiSky: 0xbfd6ff, hemiGround: 0x2a3550, sunColor: 0xdfeaff, sunIntensity: 0.72, night: true, clouds: 8 },
      voidY: -16,
      spawns: [
        { x: 0, y: 0.1, z: 19, yaw: 0, team: 'blue' },
        { x: 0, y: 0.1, z: -19, yaw: Math.PI, team: 'red' },
        { x: 2, y: 0.1, z: 19, yaw: 0, team: 'blue' },
        { x: -2, y: 0.1, z: -19, yaw: Math.PI, team: 'red' },
      ],
      build() {
        const b = [];
        // Blue base (+Z)
        addIsland(b, 0, 0, 19, 7, 'wool_blue');
        b.push({ x: -3, y: 3, z: 22, w: 1, d: 1, th: 3, t: 'stone_brick' });
        b.push({ x: 3, y: 3, z: 22, w: 1, d: 1, th: 3, t: 'stone_brick' });
        b.push({ x: 0, y: 3, z: 22, w: 5, d: 1, th: 1, t: 'wool_blue' });

        // Red base (-Z)
        addIsland(b, 0, 0, -19, 7, 'wool_red');
        b.push({ x: -3, y: 3, z: -22, w: 1, d: 1, th: 3, t: 'stone_brick' });
        b.push({ x: 3, y: 3, z: -22, w: 1, d: 1, th: 3, t: 'stone_brick' });
        b.push({ x: 0, y: 3, z: -22, w: 5, d: 1, th: 1, t: 'wool_red' });

        // 1-block-wide central bridge, split around the duel pad to avoid overlap
        b.push({ x: 0, y: 0, z: 8.5, w: 1, d: 14, th: 1, t: 'planks' });
        b.push({ x: 0, y: 0, z: -8.5, w: 1, d: 14, th: 1, t: 'planks' });
        // Center 3x3 diamond duel pad
        b.push({ x: 0, y: 0, z: 0, w: 3, d: 3, th: 1, t: 'stone_brick' });
        return b;
      },
    },

    inferno: {
      id: 'inferno',
      name: 'Inferno Keep',
      mode: 'pvp',
      allowBuild: true,
      desc: 'A nether fortress duel pit with obsidian cover and glowing braziers.',
      skyTop: '#2a0b0b',
      skyBot: '#7a2412',
      fogColor: 0x5c1a10,
      theme: { skyTop: '#2a0b0b', skyBottom: '#7a2412', fog: 0x5c1a10, fogNear: 32, fogFar: 150, hemiSky: 0xffb08a, hemiGround: 0x2a0a0a, sunColor: 0xff7a45, sunIntensity: 0.6, night: true, clouds: 5 },
      voidY: -16,
      spawns: [
        { x: 0, y: 0.1, z: 14, yaw: 0, team: 'blue' },
        { x: 0, y: 0.1, z: -14, yaw: Math.PI, team: 'red' },
        { x: 14, y: 0.1, z: 0, yaw: Math.PI / 2, team: 'green' },
        { x: -14, y: 0.1, z: 0, yaw: -Math.PI / 2, team: 'yellow' },
      ],
      build() {
        const b = [];
        const S = 30;
        b.push({ x: 0, y: 0, z: 0, w: S, d: S, th: 1, t: 'netherrack' });
        b.push({ x: 0, y: 0.25, z: 9, w: 6, d: 12, th: 0.25, t: 'nether_brick' });
        b.push({ x: 0, y: 0.25, z: -9, w: 6, d: 12, th: 0.25, t: 'nether_brick' });
        b.push({ x: 9, y: 0.25, z: 0, w: 12, d: 6, th: 0.25, t: 'nether_brick' });
        b.push({ x: -9, y: 0.25, z: 0, w: 12, d: 6, th: 0.25, t: 'nether_brick' });
        b.push({ x: 0, y: 0.5, z: 0, w: 8, d: 8, th: 0.25, t: 'obsidian' });
        b.push({ x: 0, y: 3, z: 0, w: 3, d: 3, th: 2.5, t: 'nether_brick' });
        b.push({ x: 0, y: 4, z: 0, w: 1, d: 1, th: 1, t: 'glowstone' });
        [[-8, -8], [8, -8], [-8, 8], [8, 8]].forEach(([x, z]) => {
          b.push({ x: x, y: 2, z: z, w: 1.5, d: 1.5, th: 2, t: 'obsidian' });
          b.push({ x: x, y: 3, z: z, w: 1, d: 1, th: 1, t: 'glowstone' });
        });
        b.push({ x: 0, y: 3, z: -S / 2 - 0.5, w: S + 2, d: 1, th: 3, t: 'nether_brick' });
        b.push({ x: 0, y: 3, z: S / 2 + 0.5, w: S + 2, d: 1, th: 3, t: 'nether_brick' });
        b.push({ x: -S / 2 - 0.5, y: 3, z: 0, w: 1, d: S, th: 3, t: 'nether_brick' });
        b.push({ x: S / 2 + 0.5, y: 3, z: 0, w: 1, d: S, th: 3, t: 'nether_brick' });
        return b;
      },
    },

    frostbite: {
      id: 'frostbite',
      name: 'Frostbite Basin',
      mode: 'pvp',
      allowBuild: true,
      desc: 'A frozen arena of slick ice, snow and quartz columns.',
      skyTop: '#22508e',
      skyBot: '#d8ecff',
      fogColor: 0xcfe6f7,
      theme: { skyTop: '#22508e', skyBottom: '#d8ecff', fog: 0xcfe6f7, fogNear: 45, fogFar: 190, hemiSky: 0xeaf6ff, hemiGround: 0x6b7f92, sunColor: 0xeaf4ff, sunIntensity: 0.95, clouds: 12 },
      voidY: -16,
      spawns: [
        { x: 0, y: 0.1, z: 15, yaw: 0, team: 'blue' },
        { x: 0, y: 0.1, z: -15, yaw: Math.PI, team: 'red' },
        { x: 15, y: 0.1, z: 0, yaw: Math.PI / 2, team: 'green' },
        { x: -15, y: 0.1, z: 0, yaw: -Math.PI / 2, team: 'yellow' },
      ],
      build() {
        const b = [];
        const S = 32;
        b.push({ x: 0, y: 0, z: 0, w: S, d: S, th: 1, t: 'snow' });
        b.push({ x: 0, y: 0.2, z: 0, w: 10, d: 10, th: 0.2, t: 'packed_ice' });
        b.push({ x: 0, y: 0.1, z: 10, w: 4, d: 10, th: 0.1, t: 'ice' });
        b.push({ x: 0, y: 0.1, z: -10, w: 4, d: 10, th: 0.1, t: 'ice' });
        b.push({ x: 10, y: 0.1, z: 0, w: 10, d: 4, th: 0.1, t: 'ice' });
        b.push({ x: -10, y: 0.1, z: 0, w: 10, d: 4, th: 0.1, t: 'ice' });
        b.push({ x: 0, y: 3.2, z: 0, w: 4, d: 4, th: 3, t: 'prismarine' });
        b.push({ x: 0, y: 4.7, z: 0, w: 1.5, d: 1.5, th: 1.5, t: 'diamond' });
        [[-9, -9], [9, -9], [-9, 9], [9, 9]].forEach(([x, z]) => {
          b.push({ x: x, y: 2, z: z, w: 2, d: 2, th: 2, t: 'quartz' });
          b.push({ x: x, y: 2.6, z: z, w: 3, d: 3, th: 0.6, t: 'packed_ice' });
        });
        b.push({ x: 0, y: 3, z: -S / 2 - 0.5, w: S + 2, d: 1, th: 3, t: 'prismarine' });
        b.push({ x: 0, y: 3, z: S / 2 + 0.5, w: S + 2, d: 1, th: 3, t: 'prismarine' });
        b.push({ x: -S / 2 - 0.5, y: 3, z: 0, w: 1, d: S, th: 3, t: 'prismarine' });
        b.push({ x: S / 2 + 0.5, y: 3, z: 0, w: 1, d: S, th: 3, t: 'prismarine' });
        return b;
      },
    },

    parkour: {
      id: 'parkour',
      name: 'Sky Parkour Race',
      mode: 'parkour',
      allowBuild: false,
      desc: 'Speedrun or race friends across grass, ice, slime bounce pads & neo-jumps!',
      skyTop: '#2b77db',
      skyBot: '#c6e6fa',
      fogColor: 0xc6e6fa,
      voidY: -18,
      spawns: [
        { x: 0, y: 0.1, z: 0, yaw: 0, team: 'blue' },
        { x: -1.5, y: 0.1, z: 0, yaw: 0, team: 'red' },
        { x: 1.5, y: 0.1, z: 0, yaw: 0, team: 'green' },
        { x: 0, y: 0.1, z: 1.5, yaw: 0, team: 'yellow' },
      ],
      build() {
        const b = [{ x: 0, y: 0, z: 0, w: 6, d: 6, th: 1, t: 'grass' }];
        const steps = [
          [2, 0, 0, 3, 'stone_brick'],
          [2.5, 0, 1.5, 2, 'planks'],
          [2.5, 1, -1.5, 2, 'grass'],
          [2, 0, 0, 4, 'cp'],
          [3, 0, 0, 2, 'ice'],
          [3.5, 0, 0, 2, 'ice'],
          [3, 0, 0, 4, 'cp'],
          [3, -1, 0, 2, 'slime'],
          [3.5, 2, 0, 3, 'stone_brick'],
          [2, 0, 1.5, 2, 'planks', [1.1, 1, 1, 3]],
          [2.5, 0, -1.5, 2, 'planks', [-1.1, 1, 1, 3]],
          [2, 1, 0, 3, 'gold'],
          [2.5, 0, 0, 6, 'finish'],
        ];
        let z = -3, x = 0, y = 0;
        for (const [g, dy, xo, w, t, wl] of steps) {
          const d = (t === 'finish') ? 6 : (t === 'cp' ? 4 : 2);
          if (wl) {
            b.push({ x: x + wl[0], y: Math.max(y, y + dy) + 2, z: z - g / 2, w: wl[2], d: wl[1], th: wl[3] || 4, t: 'stone_brick' });
          }
          z -= g;
          x += xo;
          y += dy;
          b.push({ x, y, z: z - d / 2, w, d, th: 1, t });
          z -= d;
        }
        return b;
      },
    },
  };

  VOX.Arenas = ARENAS;
})(window);
