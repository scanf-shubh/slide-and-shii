// 48px procedural atlas with padded gutters + mipmaps: color, normal, roughness, emissive.
(function (global) {
  const VOX = (global.VOX = global.VOX || {});
  const THREE = global.THREE;
  if (!THREE) throw new Error('textures.js requires three.min.js loaded first');

  const PAD = 8;
  const TILE = 48;
  const CELL = TILE + PAD * 2;
  const COLS = 8;
  const ROWS = 8;
  const AW = COLS * CELL;
  const AH = ROWS * CELL;

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

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    return c;
  }

  function shade(hex, f) {
    const r = Math.max(0, Math.min(255, ((hex >> 16) & 255) * f)) | 0;
    const g = Math.max(0, Math.min(255, ((hex >> 8) & 255) * f)) | 0;
    const b = Math.max(0, Math.min(255, (hex & 255) * f)) | 0;
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  function px(ctx, x, y, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 1, 1);
  }

  function replicateEdges(ctx, ox, oy) {
    const S = TILE;
    const src = ctx.canvas;
    ctx.drawImage(src, ox, oy, 1, S, ox - PAD, oy, PAD, S);
    ctx.drawImage(src, ox + S - 1, oy, 1, S, ox + S, oy, PAD, S);
    ctx.drawImage(src, ox, oy, S, 1, ox, oy - PAD, S, PAD);
    ctx.drawImage(src, ox, oy + S - 1, S, 1, ox, oy + S, S, PAD);
    ctx.drawImage(src, ox, oy, 1, 1, ox - PAD, oy - PAD, PAD, PAD);
    ctx.drawImage(src, ox + S - 1, oy, 1, 1, ox + S, oy - PAD, PAD, PAD);
    ctx.drawImage(src, ox, oy + S - 1, 1, 1, ox - PAD, oy + S, PAD, PAD);
    ctx.drawImage(src, ox + S - 1, oy + S - 1, 1, 1, ox + S, oy + S, PAD, PAD);
  }

  function loop(S, fn) {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) fn(x, y);
  }

  function noisy(ctx, S, palette, seed, variance, edgeFactor) {
    const rnd = mulberry32(seed);
    loop(S, (x, y) => {
      const c = palette[(rnd() * palette.length) | 0];
      let f = 1 - variance + rnd() * variance * 2;
      if (edgeFactor !== undefined && (x === 0 || y === 0 || x === S - 1 || y === S - 1)) f *= edgeFactor;
      px(ctx, x, y, shade(c, f));
    });
  }

  function dirtBase(ctx, S, seed) {
    const rnd = mulberry32(seed);
    const pal = [0x7a5436, 0x66442a, 0x8d6342, 0x6e4a2e, 0x5c524b];
    loop(S, (x, y) => {
      const r = rnd();
      const c = pal[(r * pal.length) | 0];
      px(ctx, x, y, shade(c, 0.94 + rnd() * 0.14));
    });
  }

  const defs = {};
  const order = [];
  const index = Object.create(null);

  function reg(name, fn, opts) {
    if (index[name] !== undefined) return;
    const o = opts || {};
    defs[name] = {
      fn: fn,
      emissive: !!o.emissive,
      rough: o.rough === undefined ? 210 : o.rough,
      transparent: !!o.transparent,
      metal: !!o.metal,
    };
    index[name] = order.length;
    order.push(name);
  }

  // ---------------- Tiles ----------------
  reg('grass_top', (ctx, S) => {
    const pal = [0x5ea832, 0x6ab83a, 0x52962a, 0x74c444, 0x4f8f28];
    noisy(ctx, S, pal, 101, 0.12, 0.9);
    const rnd = mulberry32(151);
    for (let i = 0; i < S * 1.4; i++) {
      const x = (rnd() * S) | 0;
      const y = (rnd() * S) | 0;
      px(ctx, x, y, shade(0x3f7a1c, 1));
    }
  });

  reg('grass_side', (ctx, S) => {
    dirtBase(ctx, S, 202);
    const rnd = mulberry32(303);
    const overhang = [];
    for (let x = 0; x < S; x++) overhang.push(Math.max(2, Math.floor(S * 0.18 + rnd() * S * 0.14)));
    for (let x = 0; x < S; x++) {
      const h = overhang[x];
      for (let y = 0; y < h; y++) {
        const c = y === h - 1 ? 0x4c8d24 : rnd() > 0.45 ? 0x62b034 : 0x70be3e;
        px(ctx, x, y, shade(c, 0.9 + rnd() * 0.18));
      }
    }
  });

  reg('dirt', (ctx, S) => dirtBase(ctx, S, 404));

  reg('stone', (ctx, S) => {
    const rnd = mulberry32(505);
    loop(S, (x, y) => {
      const band = y % 7 === 0 && rnd() > 0.35 ? 0.9 : 1;
      const base = rnd() < 0.24 ? 0x767c84 : rnd() > 0.78 ? 0x949ba4 : 0x848b94;
      px(ctx, x, y, shade(base, band * (0.94 + rnd() * 0.12)));
    });
  });

  reg('stone_brick', (ctx, S) => {
    const rnd = mulberry32(606);
    const rowH = S / 4;
    loop(S, (x, y) => {
      const row = Math.floor(y / rowH);
      const mortar = y % rowH === 0 || ((x + (row % 2) * (S / 2)) % S) === 0;
      const bevel = y % rowH === 1;
      const c = mortar ? 0x50565e : bevel ? 0xa3aab3 : 0x838a94;
      px(ctx, x, y, shade(c, mortar ? 1 : 0.93 + rnd() * 0.14));
    });
  });

  reg('cobble', (ctx, S) => {
    const rnd = mulberry32(707);
    loop(S, (x, y) => {
      const crack = ((x + y * 2) % 8 === 0 && rnd() > 0.3) || (x % 7 === 0 && y % 5 === 0);
      const c = crack ? 0x4e545c : rnd() > 0.55 ? 0x8c929a : rnd() > 0.4 ? 0x7a8189 : 0x6c737b;
      px(ctx, x, y, shade(c, 0.9 + rnd() * 0.18));
    });
  });

  reg('bricks', (ctx, S) => {
    const rnd = mulberry32(808);
    const rowH = S / 4;
    loop(S, (x, y) => {
      const row = Math.floor(y / rowH);
      const mortar = y % rowH === 0 || ((x + (row % 2) * (S / 2)) % S) === 0;
      const c = mortar ? 0xb8b0a4 : rnd() > 0.6 ? 0xa8463a : 0x943a30;
      px(ctx, x, y, shade(c, mortar ? 0.98 : 0.92 + rnd() * 0.14));
    });
  });

  reg('sandstone', (ctx, S) => {
    const rnd = mulberry32(909);
    loop(S, (x, y) => {
      const band = y % (S / 4) === 0 ? 0.86 : 1;
      const c = rnd() > 0.8 ? 0xd6c08c : rnd() < 0.2 ? 0xc4ab74 : 0xcfb981;
      px(ctx, x, y, shade(c, band * (0.95 + rnd() * 0.09)));
    });
  });

  reg('sandstone_top', (ctx, S) => {
    noisy(ctx, S, [0xd9c48f, 0xcfb981, 0xe2d09e], 1001, 0.08, 0.92);
  });

  reg('quartz', (ctx, S) => {
    const rnd = mulberry32(1010);
    loop(S, (x, y) => {
      const border = x === 0 || y === 0 || x === S - 1 || y === S - 1;
      const c = border ? 0xd8d4cc : rnd() > 0.82 ? 0xf4f1ea : 0xece8df;
      px(ctx, x, y, shade(c, 0.96 + rnd() * 0.06));
    });
  });

  reg('planks', (ctx, S) => {
    const rnd = mulberry32(1111);
    const ph = S / 4;
    loop(S, (x, y) => {
      const row = Math.floor(y / ph);
      const seam = y % ph === 0 || (row % 2 === 0 ? x === 0 : x === S / 2);
      const hi = y % ph === 1;
      const base = seam ? 0x5f3f1f : hi ? 0xc49556 : 0xad7f44;
      px(ctx, x, y, shade(base, seam ? 1 : 0.93 + rnd() * 0.13));
    });
  });

  reg('log_side', (ctx, S) => {
    const rnd = mulberry32(1212);
    loop(S, (x, y) => {
      const streak = (x % 5 === 0 && rnd() > 0.2) || rnd() < 0.12;
      const c = streak ? 0x4b341e : 0x684a2c;
      px(ctx, x, y, shade(c, 0.9 + rnd() * 0.2));
    });
  });

  reg('log_top', (ctx, S) => {
    const rnd = mulberry32(1313);
    loop(S, (x, y) => {
      const dx = x - (S - 1) / 2;
      const dy = y - (S - 1) / 2;
      const d = Math.max(Math.abs(dx), Math.abs(dy));
      let c = 0xc59a60;
      if (d > S * 0.4) c = 0x5c4024;
      else if (Math.round(d) % 3 === 0) c = 0xa97e48;
      px(ctx, x, y, shade(c, 0.95 + rnd() * 0.1));
    });
  });

  reg('leaves', (ctx, S) => {
    const rnd = mulberry32(1414);
    loop(S, (x, y) => {
      const dark = rnd() < 0.28;
      const light = rnd() > 0.75;
      const c = dark ? 0x2f6920 : light ? 0x5ca83c : 0x458b2d;
      px(ctx, x, y, shade(c, 0.9 + rnd() * 0.16));
    });
  });

  reg('ice', (ctx, S) => {
    const rnd = mulberry32(1515);
    loop(S, (x, y) => {
      const glint = (x + y) % (S / 2) === 0 || (x - y + S) % (S / 2) === 0;
      const edge = x === 0 || y === 0 || x === S - 1 || y === S - 1;
      const c = glint ? 0xe8fbff : edge ? 0x7ac8ef : 0x9ce0ff;
      px(ctx, x, y, shade(c, 0.95 + rnd() * 0.09));
    });
  }, { transparent: true, rough: 40 });

  reg('packed_ice', (ctx, S) => {
    const rnd = mulberry32(1616);
    loop(S, (x, y) => {
      const streak = (x * 3 + y) % (S / 2) === 0;
      const c = streak ? 0xd4f3ff : 0x8ccdf0;
      px(ctx, x, y, shade(c, 0.94 + rnd() * 0.1));
    });
  }, { rough: 60 });

  reg('snow', (ctx, S) => {
    const rnd = mulberry32(1717);
    loop(S, (x, y) => {
      const spark = rnd() > 0.93;
      const c = spark ? 0xffffff : rnd() > 0.7 ? 0xf2f7fb : 0xe6eef6;
      px(ctx, x, y, shade(c, 0.97 + rnd() * 0.05));
    });
  }, { rough: 190 });

  reg('slime', (ctx, S) => {
    const rnd = mulberry32(1818);
    loop(S, (x, y) => {
      const inner = x >= S * 0.2 && x <= S * 0.8 && y >= S * 0.2 && y <= S * 0.8;
      const edge = x === 0 || y === 0 || x === S - 1 || y === S - 1;
      const c = edge ? 0x48a848 : inner ? 0x41c94f : 0x7ce678;
      px(ctx, x, y, shade(c, 0.94 + rnd() * 0.12));
    });
  }, { transparent: true, rough: 70, emissive: true });

  reg('gold', (ctx, S) => {
    const rnd = mulberry32(1919);
    loop(S, (x, y) => {
      const border = x === 0 || y === 0 || x === S - 1 || y === S - 1;
      const hi = (x < S / 4 && y < S / 4) || (x > S * 0.2 && y > S * 0.7);
      const c = border ? 0xc78d14 : hi ? 0xfff07a : 0xf5c836;
      px(ctx, x, y, shade(c, 0.95 + rnd() * 0.1));
    });
  }, { rough: 70, metal: true, emissive: true });

  reg('diamond', (ctx, S) => {
    const rnd = mulberry32(2020);
    loop(S, (x, y) => {
      const border = x === 0 || y === 0 || x === S - 1 || y === S - 1;
      const dx = Math.abs(x - (S - 1) / 2);
      const dy = Math.abs(y - (S - 1) / 2);
      const gem = dx + dy < S * 0.34 || (dx < S * 0.12 && dy > S * 0.25);
      const c = border ? 0x269aa6 : gem ? 0xaaf9ff : 0x4adce8;
      px(ctx, x, y, shade(c, 0.95 + rnd() * 0.1));
    });
  }, { rough: 55, emissive: true });

  reg('emerald', (ctx, S) => {
    const rnd = mulberry32(2121);
    loop(S, (x, y) => {
      const border = x === 0 || y === 0 || x === S - 1 || y === S - 1;
      const d = Math.abs(x - (S - 1) / 2) + Math.abs(y - (S - 1) / 2);
      const gem = d < S * 0.3;
      const c = border ? 0x1e8f44 : gem ? 0x72f598 : 0x32cc66;
      px(ctx, x, y, shade(c, 0.95 + rnd() * 0.1));
    });
  }, { rough: 80, emissive: true });

  reg('obsidian', (ctx, S) => {
    const rnd = mulberry32(2222);
    loop(S, (x, y) => {
      const r = rnd();
      const c = r > 0.88 ? 0x4d346b : r < 0.25 ? 0x120e1a : 0x251a36;
      px(ctx, x, y, shade(c, 0.9 + rnd() * 0.16));
    });
  }, { rough: 90 });

  reg('prismarine', (ctx, S) => {
    const rnd = mulberry32(2323);
    loop(S, (x, y) => {
      const pat = (x % 8 < 4) !== (y % 8 < 4);
      const c = pat ? 0x4fa596 : 0x3c8c80;
      px(ctx, x, y, shade(c, 0.92 + rnd() * 0.12));
    });
  });

  reg('deepslate', (ctx, S) => {
    const rnd = mulberry32(2424);
    loop(S, (x, y) => {
      const band = x % (S / 2) === 0 ? 0.85 : 1;
      const c = rnd() > 0.8 ? 0x4a4d52 : rnd() < 0.2 ? 0x303338 : 0x3c3f44;
      px(ctx, x, y, shade(c, band * (0.93 + rnd() * 0.12)));
    });
  });

  reg('amethyst', (ctx, S) => {
    const rnd = mulberry32(2525);
    loop(S, (x, y) => {
      const dx = Math.abs(x - (S - 1) / 2);
      const dy = Math.abs(y - (S - 1) / 2);
      const crystal = dx + dy < S * 0.36 && (x + y) % 5 === 0;
      const c = crystal ? 0xd7a7ff : rnd() > 0.6 ? 0x9b62d6 : 0x7d4bb5;
      px(ctx, x, y, shade(c, 0.93 + rnd() * 0.12));
    });
  }, { rough: 100, emissive: true });

  reg('glowstone', (ctx, S) => {
    const rnd = mulberry32(2626);
    loop(S, (x, y) => {
      const glow = rnd() > 0.55;
      const c = glow ? 0xffe27a : rnd() > 0.5 ? 0xe8b93a : 0xb98624;
      px(ctx, x, y, shade(c, 0.95 + rnd() * 0.1));
    });
  }, { emissive: true, rough: 180 });

  reg('netherrack', (ctx, S) => {
    const rnd = mulberry32(2727);
    loop(S, (x, y) => {
      const c = rnd() > 0.7 ? 0x7a2a2a : rnd() < 0.3 ? 0x4a1616 : 0x612020;
      px(ctx, x, y, shade(c, 0.9 + rnd() * 0.18));
    });
  });

  reg('nether_brick', (ctx, S) => {
    const rnd = mulberry32(2828);
    const rowH = S / 4;
    loop(S, (x, y) => {
      const row = Math.floor(y / rowH);
      const mortar = y % rowH === 0 || ((x + (row % 2) * (S / 2)) % S) === 0;
      const c = mortar ? 0x2a1418 : rnd() > 0.6 ? 0x4c1c24 : 0x3c161c;
      px(ctx, x, y, shade(c, 0.94 + rnd() * 0.1));
    });
  });

  const wool = (name, base, seed) => {
    reg(name, (ctx, S) => {
      const rnd = mulberry32(seed);
      loop(S, (x, y) => {
        const f = 0.86 + rnd() * 0.2;
        px(ctx, x, y, shade(base, f));
      });
    }, { rough: 240 });
  };
  wool('wool_red', 0xd13834, 3001);
  wool('wool_blue', 0x3377d6, 3002);
  wool('wool_lime', 0x74cb2c, 3003);
  wool('wool_yellow', 0xe6c832, 3004);
  wool('wool_white', 0xe4e8ee, 3005);

  reg('water', (ctx, S) => {
    const rnd = mulberry32(3101);
    loop(S, (x, y) => {
      const wave = Math.sin((x + y * 2) * 0.5) > 0.5;
      const c = wave ? 0x3f9fe0 : 0x2c7fc4;
      px(ctx, x, y, shade(c, 0.93 + rnd() * 0.1));
    });
  }, { transparent: true, rough: 30 });

  reg('lava', (ctx, S) => {
    const rnd = mulberry32(3202);
    loop(S, (x, y) => {
      const vein = (x + y * 3) % 9 === 0;
      const c = vein ? 0xffe066 : rnd() > 0.6 ? 0xff7b1e : 0xd94a10;
      px(ctx, x, y, shade(c, 0.9 + rnd() * 0.2));
    });
  }, { emissive: true, rough: 160 });

  reg('speed', (ctx, S) => {
    loop(S, (x, y) => {
      const chev = ((x + y) % (S / 4)) < 3 && x > S * 0.15;
      const c = chev ? 0x8bf7ff : 0x173a5e;
      px(ctx, x, y, shade(c, 1));
    });
  }, { emissive: true, rough: 120 });

  reg('hazard', (ctx, S) => {
    loop(S, (x, y) => {
      const stripe = Math.floor((x + y) / (S / 4)) % 2 === 0;
      const c = stripe ? 0xf5c518 : 0x201a12;
      px(ctx, x, y, shade(c, 0.95 + ((x * 7 + y * 3) % 5) * 0.01));
    });
  }, { emissive: true, rough: 150 });

  reg('cp', (ctx, S) => {
    loop(S, (x, y) => {
      const edge = x === 0 || y === 0 || x === S - 1 || y === S - 1;
      const ring = Math.abs(x - (S - 1) / 2) + Math.abs(y - (S - 1) / 2) < S * 0.34;
      const c = edge ? 0x1697a8 : ring ? 0x8ffbff : 0x35e0e8;
      px(ctx, x, y, shade(c, 1));
    });
  }, { emissive: true, rough: 90 });

  reg('finish', (ctx, S) => {
    const cell = S / 4;
    loop(S, (x, y) => {
      const chk = ((x / cell) | 0) + ((y / cell) | 0);
      const c = chk & 1 ? 0xffd23f : 0x2a2f3a;
      px(ctx, x, y, shade(c, 1));
    });
  }, { emissive: true, rough: 120 });

  reg('start', (ctx, S) => {
    const pal = [0x67b83c, 0x74c444, 0x5ea832];
    noisy(ctx, S, pal, 3303, 0.1, 0.9);
    const cell = S / 4;
    loop(S, (x, y) => {
      if ((x % cell === 0) || (y % cell === 0)) px(ctx, x, y, shade(0x8be02a, 0.9));
    });
  }, { emissive: true, rough: 200 });

  // ---------------- Atlas build ----------------
  const colorCanvas = makeCanvas(AW, AH);
  const emissiveCanvas = makeCanvas(AW, AH);
  const roughCanvas = makeCanvas(AW, AH);
  const normalCanvas = makeCanvas(AW, AH);
  let atlasBuilt = null;

  function buildAtlas() {
    if (atlasBuilt) return atlasBuilt;
    const cctx = colorCanvas.getContext('2d');
    const ectx = emissiveCanvas.getContext('2d');
    const rctx = roughCanvas.getContext('2d');
    cctx.imageSmoothingEnabled = false;
    ectx.imageSmoothingEnabled = false;
    rctx.imageSmoothingEnabled = false;
    ectx.fillStyle = '#000';
    ectx.fillRect(0, 0, AW, AH);

    for (let i = 0; i < order.length; i++) {
      const name = order[i];
      const d = defs[name];
      const ox = (i % COLS) * CELL + PAD;
      const oy = Math.floor(i / COLS) * CELL + PAD;

      cctx.save();
      cctx.translate(ox, oy);
      d.fn(cctx, TILE);
      cctx.restore();

      if (d.emissive) {
        ectx.save();
        ectx.translate(ox, oy);
        d.fn(ectx, TILE);
        ectx.restore();
      }

      const v = d.rough | 0;
      rctx.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')';
      rctx.fillRect(ox, oy, TILE, TILE);

      replicateEdges(cctx, ox, oy);
      replicateEdges(ectx, ox, oy);
      replicateEdges(rctx, ox, oy);
    }

    const src = cctx.getImageData(0, 0, AW, AH).data;
    const hgt = new Float32Array(AW * AH);
    for (let i = 0, p = 0; i < hgt.length; i++, p += 4) {
      const lum = (src[p] * 0.299 + src[p + 1] * 0.587 + src[p + 2] * 0.114) / 255;
      hgt[i] = lum;
    }

    const nctx = normalCanvas.getContext('2d');
    const nimg = nctx.createImageData(AW, AH);
    const strength = 2.6;
    for (let y = 0; y < AH; y++) {
      for (let x = 0; x < AW; x++) {
        const cx = Math.floor(x / CELL);
        const cy = Math.floor(y / CELL);
        const tx0 = cx * CELL;
        const ty0 = cy * CELL;
        const lx = x - 1 < tx0 ? x : x - 1;
        const rx = x + 1 >= tx0 + CELL ? x : x + 1;
        const uy = y - 1 < ty0 ? y : y - 1;
        const dy = y + 1 >= ty0 + CELL ? y : y + 1;
        const hL = hgt[y * AW + lx];
        const hR = hgt[y * AW + rx];
        const hU = hgt[uy * AW + x];
        const hD = hgt[dy * AW + x];
        let nx = (hL - hR) * strength;
        let ny = (hD - hU) * strength;
        let nz = 1;
        const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
        nx /= len;
        ny /= len;
        nz /= len;
        const p = (y * AW + x) * 4;
        nimg.data[p] = ((nx * 0.5 + 0.5) * 255) | 0;
        nimg.data[p + 1] = ((ny * 0.5 + 0.5) * 255) | 0;
        nimg.data[p + 2] = ((nz * 0.5 + 0.5) * 255) | 0;
        nimg.data[p + 3] = 255;
      }
    }
    nctx.putImageData(nimg, 0, 0);

    const mk = (canvas, nearest, srgb) => {
      const tex = new THREE.CanvasTexture(canvas);
      tex.magFilter = nearest ? THREE.NearestFilter : THREE.LinearFilter;
      tex.minFilter = nearest ? THREE.NearestMipmapNearestFilter : THREE.LinearMipmapLinearFilter;
      tex.generateMipmaps = true;
      tex.anisotropy = 4;
      tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
      if (srgb) tex.encoding = THREE.sRGBEncoding;
      tex.needsUpdate = true;
      return tex;
    };

    const map = mk(colorCanvas, true, true);
    const normalMap = mk(normalCanvas, false, false);
    const roughnessMap = mk(roughCanvas, false, false);
    const emissiveMap = mk(emissiveCanvas, true, true);

    let opaque = null;
    let transparent = null;
    const materialFor = (transp) => {
      return new THREE.MeshStandardMaterial({
        map: map,
        normalMap: normalMap,
        roughnessMap: roughnessMap,
        emissiveMap: emissiveMap,
        emissive: 0xffffff,
        emissiveIntensity: 0.85,
        roughness: 1,
        metalness: 0.04,
        vertexColors: true,
        transparent: transp,
        opacity: transp ? 0.82 : 1,
        depthWrite: !transp,
      });
    };

    atlasBuilt = {
      canvas: colorCanvas,
      normalCanvas: normalCanvas,
      map: map,
      normalMap: normalMap,
      roughnessMap: roughnessMap,
      emissiveMap: emissiveMap,
      tile: TILE,
      cols: COLS,
      rows: ROWS,
      material: () => (opaque || (opaque = materialFor(false))),
      transparentMaterial: () => (transparent || (transparent = materialFor(true))),
      uv: uvOf,
    };
    return atlasBuilt;
  }

  function uvOf(name) {
    const i = index[name] === undefined ? index.stone : index[name];
    const x0 = (i % COLS) * CELL + PAD;
    const y0 = Math.floor(i / COLS) * CELL + PAD;
    return [x0 / AW, 1 - (y0 + TILE) / AH, (x0 + TILE) / AW, 1 - y0 / AH];
  }

  // ---------------- Block definitions ----------------
  const BLOCKS = {
    grass: { top: 'grass_top', bottom: 'dirt', side: 'grass_side' },
    start: { top: 'start', bottom: 'dirt', side: 'grass_side' },
    dirt: { all: 'dirt' },
    stone: { all: 'stone' },
    stone_brick: { all: 'stone_brick' },
    n: { all: 'stone_brick' },
    cobble: { all: 'cobble' },
    bricks: { all: 'bricks' },
    sandstone: { top: 'sandstone_top', bottom: 'sandstone_top', side: 'sandstone' },
    quartz: { all: 'quartz' },
    planks: { all: 'planks' },
    wood: { all: 'planks' },
    log: { top: 'log_top', bottom: 'log_top', side: 'log_side' },
    leaves: { all: 'leaves' },
    ice: { all: 'ice', transparent: true },
    packed_ice: { all: 'packed_ice' },
    snow: { all: 'snow' },
    slime: { all: 'slime', transparent: true },
    gold: { all: 'gold' },
    diamond: { all: 'diamond' },
    emerald: { all: 'emerald' },
    obsidian: { all: 'obsidian' },
    prismarine: { all: 'prismarine' },
    deepslate: { all: 'deepslate' },
    amethyst: { all: 'amethyst' },
    glowstone: { all: 'glowstone' },
    netherrack: { all: 'netherrack' },
    nether_brick: { all: 'nether_brick' },
    wool_red: { all: 'wool_red' },
    wool_blue: { all: 'wool_blue' },
    wool_lime: { all: 'wool_lime' },
    wool_yellow: { all: 'wool_yellow' },
    wool_white: { all: 'wool_white' },
    water: { all: 'water', transparent: true },
    lava: { all: 'lava' },
    speed: { all: 'speed' },
    hazard: { all: 'hazard' },
    cp: { all: 'cp' },
    finish: { all: 'finish' },
    wall: { all: 'stone_brick', invisible: true },
  };

  function faceTile(type, face) {
    const d = BLOCKS[type] || BLOCKS.stone;
    if (d.all) return d.all;
    if (face === 'top') return d.top || d.side || 'stone';
    if (face === 'bottom') return d.bottom || d.side || 'stone';
    return d.side || d.top || 'stone';
  }

  function isTransparent(type) {
    const d = BLOCKS[type];
    return !!(d && d.transparent);
  }

  function isInvisible(type) {
    const d = BLOCKS[type];
    return !!(d && d.invisible);
  }

  // ---------------- Standalone tile materials (held items) ----------------
  const tileMatCache = Object.create(null);

  function cropTile(canvas, name) {
    const i = index[name] === undefined ? index.stone : index[name];
    const cx = (i % COLS) * CELL + PAD;
    const cy = Math.floor(i / COLS) * CELL + PAD;
    const c = makeCanvas(TILE, TILE);
    const ctx = c.getContext('2d');
    ctx.drawImage(canvas, cx, cy, TILE, TILE, 0, 0, TILE, TILE);
    return c;
  }

  const tileTexCache = Object.create(null);

  function getTileTexture(name) {
    const key = name || 'stone_brick';
    if (tileTexCache[key]) return tileTexCache[key];
    const atlas = buildAtlas();
    const c = cropTile(atlas.canvas, key);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestMipmapNearestFilter;
    tex.generateMipmaps = true;
    tex.anisotropy = 4;
    tex.encoding = THREE.sRGBEncoding;
    tex.needsUpdate = true;
    tileTexCache[key] = tex;
    return tex;
  }

  function getBlockMaterial(type) {
    const atlas = buildAtlas();
    const tileName = faceTile(type, 'side');
    const key = 'bm_' + tileName;
    if (tileMatCache[key]) return tileMatCache[key];

    const mc = cropTile(atlas.canvas, tileName);
    const nc = cropTile(atlas.normalCanvas, tileName);
    const map = new THREE.CanvasTexture(mc);
    map.magFilter = THREE.NearestFilter;
    map.minFilter = THREE.NearestMipmapNearestFilter;
    map.generateMipmaps = true;
    map.anisotropy = 4;
    map.encoding = THREE.sRGBEncoding;
    const nm = new THREE.CanvasTexture(nc);
    nm.magFilter = THREE.LinearFilter;
    nm.minFilter = THREE.LinearMipmapLinearFilter;
    nm.generateMipmaps = true;
    nm.anisotropy = 4;

    const mat = new THREE.MeshStandardMaterial({
      map: map,
      normalMap: nm,
      roughness: 0.85,
      metalness: 0.04,
    });
    tileMatCache[key] = mat;
    return mat;
  }

  function tiledBoxGeo(w, h, d) {
    const g = new THREE.BoxGeometry(w, h, d);
    const uv = g.attributes.uv;
    const dims = [
      [d, h],
      [d, h],
      [w, d],
      [w, d],
      [w, h],
      [w, h],
    ];
    for (let f = 0; f < 6; f++) {
      for (let i = 0; i < 4; i++) {
        const k = f * 4 + i;
        uv.setXY(k, uv.getX(k) * dims[f][0], uv.getY(k) * dims[f][1]);
      }
    }
    uv.needsUpdate = true;
    return g;
  }

  // ---------------- Player skins ----------------
  function toTexture(canvas, repeat) {
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.encoding = THREE.sRGBEncoding;
    if (repeat) {
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
    }
    tex.needsUpdate = true;
    return tex;
  }

  const SKINS = {
    steve: { name: 'Classic', skin: 0xe0a97a, hair: 0x4b2e19, shirt: 0x2196a8, shirt2: 0x1a7887, pants: 0x384699, boots: 0x4a4a50, eyes: 0x3b2c85 },
    crimson: { name: 'Crimson Knight', skin: 0xe2ae82, hair: 0x261d19, shirt: 0xc8372d, shirt2: 0x99251e, pants: 0x363b45, boots: 0x23262e, eyes: 0x2c221e },
    emerald: { name: 'Ranger', skin: 0xd99e70, hair: 0xc2933a, shirt: 0x3ea849, shirt2: 0x2e8237, pants: 0x564332, boots: 0x3b2c1f, eyes: 0x265c2e },
    shadow: { name: 'Shadow Ninja', skin: 0xc89a78, hair: 0x161922, shirt: 0x232736, shirt2: 0x7b3fe4, pants: 0x181b24, boots: 0x11131a, eyes: 0x9e66ff, mask: true },
    paladin: { name: 'Solar Paladin', skin: 0xe6b58a, hair: 0xd9b24c, shirt: 0xdfe6f0, shirt2: 0xf2bf38, pants: 0x707b8c, boots: 0xd4a428, eyes: 0x2568b5 },
    cyber: { name: 'Cyber Runner', skin: 0xdcb08a, hair: 0x1c2536, shirt: 0x1e2530, shirt2: 0x35e0e8, pants: 0x171c26, boots: 0x35e0e8, eyes: 0x35e0e8, visor: true },
  };

  const skinCache = Object.create(null);

  function makeSkinMaterials(skinId) {
    const S = SKINS[skinId] || SKINS.steve;
    if (skinCache[skinId]) return skinCache[skinId];

    const faceC = makeCanvas(8, 8);
    const fctx = faceC.getContext('2d');
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        let c = S.skin;
        if (y < 2 || (y === 2 && (x === 0 || x === 7))) c = S.hair;
        if (S.mask && y >= 4) c = S.shirt;
        px(fctx, x, y, shade(c, 0.96 + ((x + y) % 2) * 0.04));
      }
    }
    if (S.visor) {
      fctx.fillStyle = shade(S.eyes, 1);
      fctx.fillRect(1, 3, 6, 2);
    } else {
      px(fctx, 1, 4, '#ffffff');
      px(fctx, 2, 4, shade(S.eyes, 1));
      px(fctx, 5, 4, shade(S.eyes, 1));
      px(fctx, 6, 4, '#ffffff');
      if (!S.mask) {
        px(fctx, 3, 6, shade(S.skin, 0.78));
        px(fctx, 4, 6, shade(S.skin, 0.78));
      }
    }

    const sideC = makeCanvas(8, 8);
    const sctx = sideC.getContext('2d');
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const isHair = y < 3 || x < 2 || (S.mask && y >= 4);
        px(sctx, x, y, shade(isHair ? S.hair : S.skin, 0.95 + ((x * 3 + y) % 2) * 0.05));
      }
    }

    const backC = makeCanvas(8, 8);
    const bctx = backC.getContext('2d');
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        px(bctx, x, y, shade(y < 6 ? S.hair : S.skin, 0.94 + ((x + y) % 2) * 0.06));
      }
    }

    const topC = makeCanvas(8, 8);
    const tctx = topC.getContext('2d');
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        px(tctx, x, y, shade(S.hair, 0.92 + ((x + y) % 2) * 0.08));
      }
    }

    const torsoFrontC = makeCanvas(8, 12);
    const tf = torsoFrontC.getContext('2d');
    for (let y = 0; y < 12; y++) {
      for (let x = 0; x < 8; x++) {
        let c = S.shirt;
        if (y === 0 && (x === 3 || x === 4)) c = S.skin;
        else if (y === 1 && (x === 2 || x === 5)) c = S.shirt2;
        else if (y >= 9 && y <= 10) c = S.shirt2;
        px(tf, x, y, shade(c, x === 0 || x === 7 ? 0.9 : 0.97 + ((x + y) % 2) * 0.04));
      }
    }

    const torsoSideC = makeCanvas(4, 12);
    const ts = torsoSideC.getContext('2d');
    for (let y = 0; y < 12; y++) {
      for (let x = 0; x < 4; x++) {
        const c = y >= 9 && y <= 10 ? S.shirt2 : S.shirt;
        px(ts, x, y, shade(c, 0.92 + ((x + y) % 2) * 0.06));
      }
    }

    const armC = makeCanvas(4, 12);
    const ac = armC.getContext('2d');
    for (let y = 0; y < 12; y++) {
      for (let x = 0; x < 4; x++) {
        const c = y < 5 ? S.shirt : y === 5 ? S.shirt2 : S.skin;
        px(ac, x, y, shade(c, 0.94 + ((x + y) % 2) * 0.06));
      }
    }

    const legC = makeCanvas(4, 12);
    const lc = legC.getContext('2d');
    for (let y = 0; y < 12; y++) {
      for (let x = 0; x < 4; x++) {
        const c = y >= 9 ? S.boots : S.pants;
        px(lc, x, y, shade(c, 0.93 + ((x + y) % 2) * 0.07));
      }
    }

    const skinMat = new THREE.MeshLambertMaterial({ color: S.skin });
    const shirtMat = new THREE.MeshLambertMaterial({ color: S.shirt });
    const pantsMat = new THREE.MeshLambertMaterial({ color: S.pants });
    const bootsMat = new THREE.MeshLambertMaterial({ color: S.boots });

    const faceMat = new THREE.MeshLambertMaterial({ map: toTexture(faceC, false) });
    const hSideMat = new THREE.MeshLambertMaterial({ map: toTexture(sideC, false) });
    const hBackMat = new THREE.MeshLambertMaterial({ map: toTexture(backC, false) });
    const hTopMat = new THREE.MeshLambertMaterial({ map: toTexture(topC, false) });
    const tFrontMat = new THREE.MeshLambertMaterial({ map: toTexture(torsoFrontC, false) });
    const tSideMat = new THREE.MeshLambertMaterial({ map: toTexture(torsoSideC, false) });
    const armMat = new THREE.MeshLambertMaterial({ map: toTexture(armC, false) });
    const legMat = new THREE.MeshLambertMaterial({ map: toTexture(legC, false) });

    const bundle = {
      head: [hSideMat, hSideMat, hTopMat, skinMat, hBackMat, faceMat],
      torso: [tSideMat, tSideMat, shirtMat, pantsMat, tFrontMat, tFrontMat],
      arm: [armMat, armMat, shirtMat, skinMat, armMat, armMat],
      leg: [legMat, legMat, pantsMat, bootsMat, legMat, legMat],
      skinColor: S.skin,
      sleeveColor: S.shirt,
    };
    skinCache[skinId] = bundle;
    return bundle;
  }

  function makeSkyTexture(topHex, bottomHex) {
    topHex = topHex || '#2c6ec7';
    bottomHex = bottomHex || '#bfe3fa';
    const c = makeCanvas(8, 256);
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, topHex);
    g.addColorStop(0.55, topHex);
    g.addColorStop(0.82, bottomHex);
    g.addColorStop(1, bottomHex);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 8, 256);
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    return t;
  }

  VOX.Textures = {
    buildAtlas: buildAtlas,
    getAtlas: buildAtlas,
    getFaceTile: faceTile,
    isTransparent: isTransparent,
    isInvisible: isInvisible,
    uv: uvOf,
    getTileTexture: getTileTexture,
    getBlockMaterial: getBlockMaterial,
    tiledBoxGeo: tiledBoxGeo,
    makeSkinMaterials: makeSkinMaterials,
    makeSkyTexture: makeSkyTexture,
    SKINS: SKINS,
    BLOCKS: BLOCKS,
    tileSize: TILE,
  };
})(window);
