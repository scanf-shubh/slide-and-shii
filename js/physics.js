// Pure 60 TPS action-platformer Physics, Swept AABB Collision, & Raycasting
(function (global) {
  const VOX = (global.VOX = global.VOX || {});

  const CFG = {
    w: 0.6,
    h: 1.8,
    voidY: -22,
    jumpV: 0.275,
    grav: 0.011,
    vdrag: 0.994,
    term: -1.3,
    adrag: 0.994,
    slip: 0.97,
    ice: 0.999,
    gAcc: 0.035,
    aAcc: 0.008,
    sprintM: 1.4,
    sneakM: 0.35,
    boost: 0.07,
    jumpCD: 8,
    thr: 0.002,
    stepH: 0.6,
    jumpBufferTicks: 9,
    coyoteTicks: 8,
    airJumps: 1,
    jumpCut: 0.58,
    maxH: 0.24,
    slideTicks: 40,
    slideCD: 24,
    slideBoost: 0.09,
    slideDrag: 0.997,
    slideAccel: 0.005,
    stopDrag: 0.4,
    maxSlide: 0.32,
    boostMax: 0.46,
    grappleMax: 30,
    grappleAccel: 0.12,
    grappleDamp: 0.998,
    maxGrapple: 0.4,
    reach: 4.5,
    pvpReach: 3.1,
  };

  const EP = 1e-6;

  // Each box b: { x, y (TOP surface), z, w, d, th (thickness, default 1), t (type) }
  function bounds(b) {
    const th = b.th || 1;
    return [b.x - b.w / 2, b.x + b.w / 2, b.y - th, b.y, b.z - b.d / 2, b.z + b.d / 2];
  }

  function createState(x = 0, y = 0, z = 0) {
    return {
      x, y, z,
      vx: 0, vy: 0, vz: 0,
      ground: false,
      on: null,
      sprint: false,
      jcd: 0,
      jumpBuffer: 0,
      airJumps: CFG.airJumps,
      coyote: 0,
      jumpCut: false,
      slideT: 0,
      slideCD: 0,
      boostT: 0,
      grapple: null,
      kb: true,
      pp: { x, y, z },
    };
  }

  function boxHit(world, x, y, z) {
    const w = CFG.w / 2;
    for (let i = 0; i < world.length; i++) {
      const [x0, x1, y0, y1, z0, z1] = bounds(world[i]);
      if (
        x + w > x0 + EP && x - w < x1 - EP &&
        y + CFG.h > y0 + EP && y < y1 - EP &&
        z + w > z0 + EP && z - w < z1 - EP
      ) {
        return true;
      }
    }
    return false;
  }

  function clip(d, lo, hi, bl, bh) {
    if (d > 0 && hi <= bl + EP) {
      const t = bl - hi;
      if (t < d) d = t;
    } else if (d < 0 && lo >= bh - EP) {
      const t = bh - lo;
      if (t > d) d = t;
    }
    return d;
  }

  function sweep(world, x, y, z, dx, dy, dz) {
    const w = CFG.w / 2;
    const H = CFG.h;
    // Broadphase bounding check helps on arenas with many blocks
    const minX = x + Math.min(0, dx) - w - 0.1;
    const maxX = x + Math.max(0, dx) + w + 0.1;
    const minY = y + Math.min(0, dy) - 0.1;
    const maxY = y + Math.max(0, dy) + H + 0.1;
    const minZ = z + Math.min(0, dz) - w - 0.1;
    const maxZ = z + Math.max(0, dz) + w + 0.1;

    const near = [];
    for (let i = 0; i < world.length; i++) {
      const b = world[i];
      const th = b.th || 1;
      if (
        b.x + b.w / 2 >= minX && b.x - b.w / 2 <= maxX &&
        b.y >= minY && b.y - th <= maxY &&
        b.z + b.d / 2 >= minZ && b.z - b.d / 2 <= maxZ
      ) {
        near.push(bounds(b));
      }
    }

    for (let i = 0; i < near.length; i++) {
      const [x0, x1, y0, y1, z0, z1] = near[i];
      if (x + w > x0 + EP && x - w < x1 - EP && z + w > z0 + EP && z - w < z1 - EP) {
        dy = clip(dy, y, y + H, y0, y1);
      }
    }
    y += dy;

    for (let i = 0; i < near.length; i++) {
      const [x0, x1, y0, y1, z0, z1] = near[i];
      if (y + H > y0 + EP && y < y1 - EP && z + w > z0 + EP && z - w < z1 - EP) {
        dx = clip(dx, x - w, x + w, x0, x1);
      }
    }
    x += dx;

    for (let i = 0; i < near.length; i++) {
      const [x0, x1, y0, y1, z0, z1] = near[i];
      if (x + w > x0 + EP && x - w < x1 - EP && y + H > y0 + EP && y < y1 - EP) {
        dz = clip(dz, z - w, z + w, z0, z1);
      }
    }
    z += dz;

    return { x, y, z, dx, dy, dz };
  }

  function under(world, x, y, z) {
    for (let i = 0; i < world.length; i++) {
      const b = world[i];
      const [x0, x1, , y1, z0, z1] = bounds(b);
      if (Math.abs(y1 - y) < 1e-4 && x + 0.3 > x0 && x - 0.3 < x1 && z + 0.3 > z0 && z - 0.3 < z1) {
        return b;
      }
    }
    return null;
  }

  function tick(s, inp, world, voidY = CFG.voidY) {
    const ev = { jumped: false, airJumped: false, landed: false, landSpeed: 0, bounced: false, slid: false, fell: false };
    let fx = 0, fz = 0;
    if (inp.f) fz -= 1;
    if (inp.b) fz += 1;
    if (inp.l) fx -= 1;
    if (inp.r) fx += 1;
    const len = Math.hypot(fx, fz);
    if (len) { fx /= len; fz /= len; }

    const c = Math.cos(inp.yaw);
    const sn = Math.sin(inp.yaw);
    const wx = fx * c + fz * sn;
    const wz = -fx * sn + fz * c;
    const sneak = !!inp.sneak;
    const wasG = s.ground;

    if (!inp.f || sneak) s.sprint = false;
    if (inp.f && !sneak && inp.sprintKey) s.sprint = true;

    const Mt = (sneak ? CFG.sneakM : s.sprint ? CFG.sprintM : 1) * (inp.slow || 1);
    const slip = wasG && s.on && s.on.t === 'ice' ? CFG.ice : CFG.slip;

    if (wasG) s.coyote = CFG.coyoteTicks;
    else if (s.coyote > 0) s.coyote--;
    if (s.jcd > 0) s.jcd--;
    if (s.slideCD > 0) s.slideCD--;
    if (s.boostT > 0) s.boostT--;
    if (s.jumpBuffer > 0) s.jumpBuffer--;
    if (inp.jumpPressed) s.jumpBuffer = CFG.jumpBufferTicks;
    if (!inp.jump) s.jcd = 0;

    // 1) Jump, double jump, slide and grapple
    const canGround = wasG || s.coyote > 0;
    if (s.jumpBuffer > 0 && canGround && s.jcd <= 0) {
      s.vy = CFG.jumpV;
      s.jcd = CFG.jumpCD;
      s.jumpBuffer = 0;
      s.coyote = 0;
      s.jumpCut = true;
      ev.jumped = true;
      if (s.sprint) {
        s.vx -= Math.sin(inp.yaw) * CFG.boost;
        s.vz -= Math.cos(inp.yaw) * CFG.boost;
      }
    } else if (inp.jumpPressed && !canGround && s.airJumps > 0 && s.jcd <= 0) {
      s.vy = CFG.jumpV * 0.92;
      s.jcd = CFG.jumpCD;
      s.airJumps--;
      s.jumpBuffer = 0;
      s.jumpCut = true;
      ev.jumped = true;
      ev.airJumped = true;
    }
    if (ev.jumped) {
      s.slideT = 0;
      s.ground = false;
    }
    if (s.jumpCut && !inp.jump && s.vy > 0) {
      s.vy *= CFG.jumpCut;
      s.jumpCut = false;
    }
    if (s.vy <= 0) s.jumpCut = false;

    const hs0 = Math.hypot(s.vx, s.vz);
    if (inp.slidePressed && wasG && !sneak && (inp.slow || 1) >= 1 && s.slideCD <= 0 && hs0 > 0.045) {
      const target = Math.min(CFG.maxSlide, hs0 + CFG.slideBoost);
      const scale = target / Math.max(hs0, 0.001);
      s.vx *= scale;
      s.vz *= scale;
      s.slideT = CFG.slideTicks;
      s.slideCD = CFG.slideCD;
      ev.slid = true;
    }
    const sliding = s.slideT > 0 && inp.slide && !sneak && s.ground;
    if (!sliding) s.slideT = 0;
    else s.slideT--;

    if (s.grapple) {
      const gx = s.grapple.x - s.x, gy = s.grapple.y - s.y, gz = s.grapple.z - s.z;
      const gd = Math.hypot(gx, gy, gz);
      if (gd > CFG.grappleMax || gd < 0.65) {
        s.grapple = null;
      } else {
        const pull = CFG.grappleAccel / gd;
        s.vx += gx * pull;
        s.vy += gy * pull;
        s.vz += gz * pull;
        s.vx *= CFG.grappleDamp;
        s.vy *= CFG.grappleDamp;
        s.vz *= CFG.grappleDamp;
      }
    }

    const a = s.grapple ? CFG.aAcc * 0.7
      : wasG ? (sliding ? CFG.slideAccel : CFG.gAcc * Mt * Math.pow(0.6 / slip, 3))
      : CFG.aAcc * Mt;
    const im = len > 1 ? 1 : 0.98;
    s.vx += wx * a * im;
    s.vz += wz * a * im;

    const cap = s.grapple ? CFG.maxGrapple : s.boostT > 0 ? CFG.boostMax : sliding ? CFG.maxSlide : CFG.maxH;
    const hs = Math.hypot(s.vx, s.vz);
    if (hs > cap) {
      const k = cap / hs;
      s.vx *= k;
      s.vz *= k;
    }

    // 2) Move with sneak edge guard + swept Y/X/Z + step-up
    let vx = s.vx, vy = s.vy, vz = s.vz, land = 0;
    if (sneak && wasG) {
      const empty = (ox, oz) => !boxHit(world, s.x + ox, s.y - CFG.stepH, s.z + oz);
      const shrink = (q) => (Math.abs(q) < 0.05 ? 0 : q - Math.sign(q) * 0.05);
      while (vx !== 0 && empty(vx, 0)) vx = shrink(vx);
      while (vz !== 0 && empty(0, vz)) vz = shrink(vz);
      while (vx !== 0 && vz !== 0 && empty(vx, vz)) { vx = shrink(vx); vz = shrink(vz); }
    }

    const mx = vx, mz = vz;
    let r = sweep(world, s.x, s.y, s.z, mx, vy, mz);
    let stepped = false;
    if ((r.dx !== mx || r.dz !== mz) && (wasG || (vy < 0 && r.dy !== vy))) {
      const u = sweep(world, s.x, s.y, s.z, 0, CFG.stepH, 0);
      const m = sweep(world, u.x, u.y, u.z, mx, 0, mz);
      const d = sweep(world, m.x, m.y, m.z, 0, -(u.y - s.y), 0);
      if (m.dx * m.dx + m.dz * m.dz > r.dx * r.dx + r.dz * r.dz + 1e-9) {
        r = { x: d.x, y: d.y, z: d.z, dx: m.dx, dy: vy, dz: m.dz };
        stepped = true;
      }
    }

    s.x = r.x; s.y = r.y; s.z = r.z;
    if (!stepped) {
      if (r.dx !== mx) { if (Math.abs(s.vx) > 0.05) s.sprint = false; s.vx = 0; }
      if (r.dz !== mz) { if (Math.abs(s.vz) > 0.05) s.sprint = false; s.vz = 0; }
    }
    if (vy > 0 && r.dy !== vy) s.vy = 0;
    if (stepped || (vy <= 0 && r.dy !== vy)) {
      land = Math.min(vy, 0);
      s.vy = 0;
      s.ground = true;
      s.on = under(world, s.x, s.y, s.z) || s.on;
      s.airJumps = CFG.airJumps;
      s.coyote = CFG.coyoteTicks;
    } else {
      s.ground = false;
    }
    if (!wasG && s.ground && s.slideT > 0) {
      s.slideT = 0;
      s.vx *= 0.45;
      s.vz *= 0.45;
    }
    if (!s.ground && s.slideT > 0) s.slideT = 0;

    if (s.ground && s.on && s.on.t === 'slime' && !sneak && land < -0.03) {
      s.vy = Math.max(0.2, -land * 0.9);
      s.ground = false;
      ev.bounced = true;
    }
    if (!wasG && s.ground && land < -0.08) {
      ev.landed = true;
      ev.landSpeed = land;
    }

    // 3) Drag + gravity
    const dr = s.grapple ? 1 : (wasG ? (sliding ? CFG.slideDrag : slip * CFG.adrag) : CFG.adrag);
    s.vx *= dr;
    s.vz *= dr;
    s.vy = Math.max((s.vy - CFG.grav) * CFG.vdrag, CFG.term);
    if (s.ground && !len && !sliding && !s.grapple && !s.boostT &&
        !(s.on && s.on.t === 'ice') && Math.hypot(s.vx, s.vz) <= CFG.maxSlide) {
      s.vx *= CFG.stopDrag;
      s.vz *= CFG.stopDrag;
    }

    // 4) Anti-jitter
    if (Math.abs(s.vx) < CFG.thr) s.vx = 0;
    if (Math.abs(s.vz) < CFG.thr) s.vz = 0;
    if (s.y < voidY) ev.fell = true;
    return ev;
  }

  function rayBox(o, d, mn, mx) {
    let t0 = 0, t1 = 1e9;
    let hitAxis = -1, hitDir = 0;
    const axes = ['x', 'y', 'z'];
    for (let i = 0; i < 3; i++) {
      const a = axes[i];
      const inv = Math.abs(d[a]) < 1e-9 ? 1e9 : 1 / d[a];
      let tNear = (mn[a] - o[a]) * inv;
      let tFar = (mx[a] - o[a]) * inv;
      let sign = -Math.sign(d[a]);
      if (tNear > tFar) {
        const tmp = tNear; tNear = tFar; tFar = tmp;
      }
      if (tNear > t0) {
        t0 = tNear;
        hitAxis = i;
        hitDir = sign;
      }
      if (tFar < t1) t1 = tFar;
      if (t0 > t1) return null;
    }
    if (t0 < 0 || hitAxis < 0) return null;
    const normal = [0, 0, 0];
    normal[hitAxis] = hitDir;
    return { t: t0, normal };
  }

  function raycastWorld(world, origin, dir, maxDist = CFG.reach, opts) {
    const includeWalls = !!(opts && opts.includeWalls);
    let best = null;
    for (let i = 0; i < world.length; i++) {
      const b = world[i];
      if (!includeWalls && b.t === 'wall') continue; // cannot place on invisible barrier walls
      const [x0, x1, y0, y1, z0, z1] = bounds(b);
      const hit = rayBox(origin, dir, { x: x0, y: y0, z: z0 }, { x: x1, y: y1, z: z1 });
      if (hit && hit.t <= maxDist && (!best || hit.t < best.t)) {
        const hx = origin.x + dir.x * hit.t;
        const hy = origin.y + dir.y * hit.t;
        const hz = origin.z + dir.z * hit.t;
        // Snap hit point slightly inside the hit block to find exact integer cell, then step along normal
        const eps = 0.002;
        const cx = Math.floor(hx - hit.normal[0] * eps);
        const cy = Math.floor(hy - hit.normal[1] * eps);
        const cz = Math.floor(hz - hit.normal[2] * eps);
        best = {
          t: hit.t,
          box: b,
          normal: hit.normal,
          cell: [cx, cy, cz],
          placeCell: [cx + hit.normal[0], cy + hit.normal[1], cz + hit.normal[2]],
        };
      }
    }
    return best;
  }

  function raycastPlayer(origin, dir, target, maxDist = CFG.pvpReach) {
    const pad = 0.12;
    const hit = rayBox(
      origin,
      dir,
      { x: target.x - 0.3 - pad, y: target.y - pad, z: target.z - 0.3 - pad },
      { x: target.x + 0.3 + pad, y: target.y + 1.85 + pad, z: target.z + 0.3 + pad }
    );
    return hit && hit.t <= maxDist ? hit.t : -1;
  }

  function canPlaceBlock(world, cell, players) {
    const [cx, cy, cz] = cell;
    if (cy < -18 || cy > 48) return false;
    const bx = cx + 0.5, by = cy + 1, bz = cz + 0.5;
    // Check overlap with existing placed blocks or static boxes
    for (let i = 0; i < world.length; i++) {
      const [x0, x1, y0, y1, z0, z1] = bounds(world[i]);
      if (bx + 0.45 > x0 && bx - 0.45 < x1 && by - 0.05 > y0 && by - 0.95 < y1 && bz + 0.45 > z0 && bz - 0.45 < z1) {
        return false;
      }
    }
    // Prevent placing directly inside any player hitbox
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      if (p.x + 0.3 > cx && p.x - 0.3 < cx + 1 && p.y + 1.8 > cy && p.y < cy + 1 && p.z + 0.3 > cz && p.z - 0.3 < cz + 1) {
        return false;
      }
    }
    return true;
  }

  function dmgOf(base, isCrit) {
    return isCrit ? base + (base >> 1) + 1 : base;
  }

  function applyKnockback(attacker, target, ayaw, mult = 1) {
    let kb = 0.135;
    if (attacker.sprint && attacker.kb) {
      kb = 0.36;
      attacker.kb = false;
    }
    kb *= mult;
    target.vx -= Math.sin(ayaw) * kb;
    target.vz -= Math.cos(ayaw) * kb;
    target.vy = 0.135;
  }

  VOX.Physics = {
    CFG,
    bounds,
    createState,
    boxHit,
    tick,
    raycastWorld,
    raycastPlayer,
    canPlaceBlock,
    dmgOf,
    applyKnockback,
  };
})(window);
