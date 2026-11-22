// Atlas-based voxel-ish world mesher: face culling, per-cell tiling, chunks,
// themed sky/lighting, moving platforms, dynamic blocks and particles.
(function (global) {
  const VOX = (global.VOX = global.VOX || {});
  const THREE = global.THREE;
  if (!THREE) throw new Error('world.js requires three.min.js');

  const CHUNK = 32;
  const EPS = 1e-3;

  function hash2(a, b) {
    const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
    return s - Math.floor(s);
  }

  function disposeGroup(group) {
    group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
  }

  function geometryFromChunk(data) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(data.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(data.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(data.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(data.col, 3));
    g.setIndex(data.idx);
    g.computeBoundingSphere();
    return g;
  }

  const FACE_KEYS = ['top', 'bottom', 'east', 'west', 'south', 'north'];
  const FACE_LIGHT = { top: 1.0, bottom: 0.58, east: 0.8, west: 0.8, south: 0.88, north: 0.88 };

  const WorldView = function (scene) {
    this.scene = scene;
    this.root = new THREE.Group();
    scene.add(this.root);
    this.chunkMeshes = [];
    this.wallMeshes = [];
    this.staticBlocks = [];
    this.movers = new Map();
    this.dynamic = new Map();
    this.time = 0;
    this.theme = null;
    this.quality = 'high';

    this.hemi = new THREE.HemisphereLight(0xdfefff, 0x44505c, 0.9);
    scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight(0xffffff, 0.95);
    this.sun.position.set(40, 80, 20);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.bias = -0.0002;
    this.sun.shadow.normalBias = 0.02;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 220;
    this.sun.shadow.camera.left = -60;
    this.sun.shadow.camera.right = 60;
    this.sun.shadow.camera.top = 60;
    this.sun.shadow.camera.bottom = -60;
    scene.add(this.sun);
    scene.add(this.sun.target);

    this.sunSprite = this.makeSunSprite();
    scene.add(this.sunSprite);

    this.stars = this.makeStars();
    scene.add(this.stars);

    this.clouds = new THREE.Group();
    scene.add(this.clouds);
    this.buildClouds(16);

    this.particles = [];
    this.makeParticles(80);

    this.atlas = VOX.Textures.buildAtlas();
  };

  WorldView.prototype.makeSunSprite = function () {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 6, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,240,1)');
    g.addColorStop(0.25, 'rgba(255,246,205,0.9)');
    g.addColorStop(0.6, 'rgba(255,225,150,0.25)');
    g.addColorStop(1, 'rgba(255,220,140,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false });
    const sp = new THREE.Sprite(mat);
    sp.scale.set(120, 120, 1);
    sp.position.set(220, 200, -260);
    return sp;
  };

  WorldView.prototype.makeStars = function () {
    const g = new THREE.BufferGeometry();
    const n = 700;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const r = 280 + Math.random() * 160;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(Math.random() * 0.9 + 0.05);
      arr[i * 3] = Math.sin(ph) * Math.cos(th) * r;
      arr[i * 3 + 1] = Math.abs(Math.cos(ph)) * r * 0.9 + 20;
      arr[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * r;
    }
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const m = new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0.85, fog: false });
    const p = new THREE.Points(g, m);
    p.visible = false;
    return p;
  };

  WorldView.prototype.buildClouds = function (count) {
    while (this.clouds.children.length) {
      const c = this.clouds.children.pop();
      if (c.geometry) c.geometry.dispose();
    }
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.82, emissive: 0x888888 });
    for (let i = 0; i < count; i++) {
      const g = new THREE.Group();
      const blocks = 2 + ((Math.random() * 4) | 0);
      for (let j = 0; j < blocks; j++) {
        const w = 8 + Math.random() * 16;
        const h = 3 + Math.random() * 4;
        const d = 6 + Math.random() * 12;
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        m.position.set((Math.random() - 0.5) * 22, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 16);
        g.add(m);
      }
      g.position.set((Math.random() - 0.5) * 420, 70 + Math.random() * 45, (Math.random() - 0.5) * 420 + -60);
      g.userData.speed = 1.2 + Math.random() * 2.2;
      this.clouds.add(g);
    }
  };

  WorldView.prototype.makeParticles = function (count) {
    const geo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const m = new THREE.Mesh(geo, mat);
      m.visible = false;
      m.userData.life = 0;
      m.userData.vel = new THREE.Vector3();
      this.scene.add(m);
      this.particles.push(m);
    }
  };

  WorldView.prototype.spark = function (x, y, z, color, count, power) {
    count = count || 10;
    power = power || 3;
    let used = 0;
    for (let i = 0; i < this.particles.length && used < count; i++) {
      const m = this.particles[i];
      if (m.userData.life > 0) continue;
      used++;
      m.userData.life = 0.45 + Math.random() * 0.35;
      m.position.set(x, y, z);
      m.userData.vel.set((Math.random() - 0.5) * power, Math.random() * power * 0.8 + 1, (Math.random() - 0.5) * power);
      m.material.color.setHex(color === undefined ? 0xffffff : color);
      m.scale.setScalar(0.7 + Math.random() * 0.9);
      m.visible = true;
    }
  };

  WorldView.prototype.setTheme = function (theme) {
    this.theme = theme;
    this.scene.background = VOX.Textures.makeSkyTexture(theme.skyTop, theme.skyBottom);
    this.scene.fog = new THREE.Fog(theme.fog, theme.fogNear || 50, theme.fogFar || 190);
    this.hemi.color.setHex(theme.hemiSky === undefined ? 0xdfefff : theme.hemiSky);
    this.hemi.groundColor.setHex(theme.hemiGround === undefined ? 0x44505c : theme.hemiGround);
    this.hemi.intensity = theme.hemiIntensity === undefined ? 0.9 : theme.hemiIntensity;
    this.sun.color.setHex(theme.sunColor === undefined ? 0xffffff : theme.sunColor);
    this.sun.intensity = theme.sunIntensity === undefined ? 0.95 : theme.sunIntensity;
    this.stars.visible = !!theme.night;
    if (theme.night) {
      this.sun.intensity *= 0.35;
      this.hemi.intensity = Math.max(this.hemi.intensity, 0.55);
    }
    if (theme.clouds !== undefined) this.buildClouds(theme.clouds);
  };

  WorldView.prototype.clear = function () {
    for (let i = 0; i < this.chunkMeshes.length; i++) {
      const m = this.chunkMeshes[i];
      this.root.remove(m);
      if (m.geometry) m.geometry.dispose();
    }
    this.chunkMeshes.length = 0;
    for (let i = 0; i < this.wallMeshes.length; i++) {
      const m = this.wallMeshes[i];
      this.root.remove(m);
      if (m.geometry) m.geometry.dispose();
      if (m.material) m.material.dispose();
    }
    this.wallMeshes.length = 0;
    this.movers.forEach((m) => {
      this.root.remove(m);
      if (m.geometry) m.geometry.dispose();
    });
    this.movers.clear();
    this.dynamic.forEach((m) => {
      this.root.remove(m);
      if (m.geometry) m.geometry.dispose();
    });
    this.dynamic.clear();
    this.staticBlocks = [];
  };

  WorldView.prototype.buildEnclosure = function (info, tileName) {
    if (!info || !(info.wallTop > info.baseTop)) return;
    const tex = VOX.Textures.getTileTexture(tileName || 'stone_brick');
    const mat = new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide });
    const pos = [], nor = [], uv = [], idx = [];
    const y0 = info.baseTop, y1 = info.wallTop;
    const pushWall = (ax, az, bx, bz, nx, nz) => {
      const base = pos.length / 3;
      pos.push(ax, y0, az, bx, y0, bz, bx, y1, bz, ax, y1, az);
      nor.push(nx, 0, nz, nx, 0, nz, nx, 0, nz, nx, 0, nz);
      const uRep = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az)));
      const vRep = Math.max(1, Math.round(y1 - y0));
      uv.push(0, 0, uRep, 0, uRep, vRep, 0, vRep);
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    };
    pushWall(info.x0, info.z1, info.x0, info.z0, 1, 0);
    pushWall(info.x1, info.z0, info.x1, info.z1, -1, 0);
    pushWall(info.x0, info.z0, info.x1, info.z0, 0, 1);
    pushWall(info.x1, info.z1, info.x0, info.z1, 0, -1);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    this.root.add(mesh);
    this.wallMeshes.push(mesh);
  };

  WorldView.prototype.covered = function (blocks, b, face) {
    const th = b.th || 1;
    const x0 = b.x - b.w / 2;
    const x1 = b.x + b.w / 2;
    const y0 = b.y - th;
    const y1 = b.y;
    const z0 = b.z - b.d / 2;
    const z1 = b.z + b.d / 2;
    for (let i = 0; i < blocks.length; i++) {
      const o = blocks[i];
      if (o === b || o.mover || VOX.Textures.isInvisible(o.t)) continue;
      const oth = o.th || 1;
      const ox0 = o.x - o.w / 2;
      const ox1 = o.x + o.w / 2;
      const oy0 = o.y - oth;
      const oy1 = o.y;
      const oz0 = o.z - o.d / 2;
      const oz1 = o.z + o.d / 2;
      if (ox1 < x0 - EPS || ox0 > x1 + EPS || oy1 < y0 - EPS || oy0 > y1 + EPS || oz1 < z0 - EPS || oz0 > z1 + EPS) continue;
      const coversXZ = ox0 <= x0 + EPS && ox1 >= x1 - EPS && oz0 <= z0 + EPS && oz1 >= z1 - EPS;
      const coversYZ = oy0 <= y0 + EPS && oy1 >= y1 - EPS && oz0 <= z0 + EPS && oz1 >= z1 - EPS;
      const coversXY = ox0 <= x0 + EPS && ox1 >= x1 - EPS && oy0 <= y0 + EPS && oy1 >= y1 - EPS;
      if (face === 'top') {
        if (Math.abs(oy0 - y1) < EPS && coversXZ) return true;
      } else if (face === 'bottom') {
        if (Math.abs(oy1 - y0) < EPS && coversXZ) return true;
      } else if (face === 'east') {
        if (Math.abs(ox0 - x1) < EPS && coversYZ) return true;
      } else if (face === 'west') {
        if (Math.abs(ox1 - x0) < EPS && coversYZ) return true;
      } else if (face === 'south') {
        if (Math.abs(oz0 - z1) < EPS && coversXY) return true;
      } else if (face === 'north') {
        if (Math.abs(oz1 - z0) < EPS && coversXY) return true;
      }
    }
    return false;
  };

  function chunkFor(map, b) {
    const key = Math.floor(b.x / CHUNK) + ':' + Math.floor(b.z / CHUNK);
    let d = map[key];
    if (!d) {
      d = { pos: [], nor: [], uv: [], col: [], idx: [] };
      map[key] = d;
    }
    return d;
  }

  function pushQuad(d, p0, p1, p2, p3, n, uv, light) {
    const base = d.pos.length / 3;
    d.pos.push(p0[0], p0[1], p0[2], p1[0], p1[1], p1[2], p2[0], p2[1], p2[2], p3[0], p3[1], p3[2]);
    for (let i = 0; i < 4; i++) d.nor.push(n[0], n[1], n[2]);
    d.uv.push(uv[0], uv[1], uv[2], uv[1], uv[2], uv[3], uv[0], uv[3]);
    for (let i = 0; i < 4; i++) d.col.push(light, light, light);
    d.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  const FACE_SETUP = {
    top: { n: [0, 1, 0], o: (x0, x1, y0, y1, z0, z1) => [x0, y1, z1], u: [1, 0, 0], v: [0, 0, -1], lu: (w) => w, lv: (d) => d },
    bottom: { n: [0, -1, 0], o: (x0, x1, y0, y1, z0, z1) => [x0, y0, z0], u: [1, 0, 0], v: [0, 0, 1], lu: (w) => w, lv: (d) => d },
    east: { n: [1, 0, 0], o: (x0, x1, y0, y1, z0, z1) => [x1, y0, z1], u: [0, 0, -1], v: [0, 1, 0], lu: (w, h, d) => d, lv: (w, h) => h },
    west: { n: [-1, 0, 0], o: (x0, x1, y0, y1, z0, z1) => [x0, y0, z0], u: [0, 0, 1], v: [0, 1, 0], lu: (w, h, d) => d, lv: (w, h) => h },
    south: { n: [0, 0, 1], o: (x0, x1, y0, y1, z0, z1) => [x0, y0, z1], u: [1, 0, 0], v: [0, 1, 0], lu: (w) => w, lv: (w, h) => h },
    north: { n: [0, 0, -1], o: (x0, x1, y0, y1, z0, z1) => [x1, y0, z0], u: [-1, 0, 0], v: [0, 1, 0], lu: (w) => w, lv: (w, h) => h },
  };

  WorldView.prototype.meshBox = function (blocks, b, maps) {
    const T = VOX.Textures;
    if (T.isInvisible(b.t)) return;
    const atlas = this.atlas;
    const th = b.th || 1;
    const x0 = b.x - b.w / 2;
    const x1 = b.x + b.w / 2;
    const y0 = b.y - th;
    const y1 = b.y;
    const z0 = b.z - b.d / 2;
    const z1 = b.z + b.d / 2;
    const trans = T.isTransparent(b.t);
    const targetMap = trans ? maps.trans : maps.opaque;

    for (let f = 0; f < FACE_KEYS.length; f++) {
      const key = FACE_KEYS[f];
      if (this.covered(blocks, b, key)) continue;
      const setup = FACE_SETUP[key];
      const faceSide = key === 'top' ? 'top' : key === 'bottom' ? 'bottom' : 'side';
      const tile = T.getFaceTile(b.t, faceSide);
      const uv = atlas.uv(tile);
      const d = chunkFor(targetMap, b);
      const uLen = setup.lu(b.w, th, b.d);
      const vLen = setup.lv(b.w, th, b.d);
      const cu = Math.max(1, Math.round(uLen));
      const cv = Math.max(1, Math.round(vLen));
      const o = setup.o(x0, x1, y0, y1, z0, z1);
      const u = setup.u;
      const v = setup.v;
      const baseLight = FACE_LIGHT[key];
      for (let iu = 0; iu < cu; iu++) {
        const a0 = (uLen * iu) / cu;
        const a1 = (uLen * (iu + 1)) / cu;
        for (let iv = 0; iv < cv; iv++) {
          const b0 = (vLen * iv) / cv;
          const b1 = (vLen * (iv + 1)) / cv;
          const p0 = [o[0] + u[0] * a0 + v[0] * b0, o[1] + u[1] * a0 + v[1] * b0, o[2] + u[2] * a0 + v[2] * b0];
          const p1 = [o[0] + u[0] * a1 + v[0] * b0, o[1] + u[1] * a1 + v[1] * b0, o[2] + u[2] * a1 + v[2] * b0];
          const p2 = [o[0] + u[0] * a1 + v[0] * b1, o[1] + u[1] * a1 + v[1] * b1, o[2] + u[2] * a1 + v[2] * b1];
          const p3 = [o[0] + u[0] * a0 + v[0] * b1, o[1] + u[1] * a0 + v[1] * b1, o[2] + u[2] * a0 + v[2] * b1];
          const tint = baseLight * (0.94 + hash2(iu + b.x * 7, iv + b.z * 11 + b.y) * 0.1);
          pushQuad(d, p0, p1, p2, p3, setup.n, uv, tint);
        }
      }
    }
  };

  WorldView.prototype.build = function (blocks, theme) {
    this.clear();
    if (theme) this.setTheme(theme);
    this.staticBlocks = blocks || [];
    const maps = { opaque: {}, trans: {} };
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      if (b.mover) continue;
      this.meshBox(blocks, b, maps);
    }
    const addMeshes = (map, material, castShadow) => {
      for (const key in map) {
        const data = map[key];
        if (!data.idx.length) continue;
        const geo = geometryFromChunk(data);
        const mesh = new THREE.Mesh(geo, material);
        mesh.castShadow = castShadow;
        mesh.receiveShadow = true;
        mesh.matrixAutoUpdate = false;
        mesh.updateMatrix();
        this.root.add(mesh);
        this.chunkMeshes.push(mesh);
      }
    };
    addMeshes(maps.opaque, this.atlas.material(), true);
    addMeshes(maps.trans, this.atlas.transparentMaterial(), false);

    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      if (!b.mover) continue;
      this.addMoverMesh(b);
    }
  };

  WorldView.prototype.localGeometry = function (b) {
    const T = VOX.Textures;
    const atlas = this.atlas;
    const th = b.th || 1;
    const hw = b.w / 2;
    const hd = b.d / 2;
    const d = { pos: [], nor: [], uv: [], col: [], idx: [] };
    const fake = { x: 0, y: 0, z: 0, w: b.w, d: b.d, th: th, t: b.t };
    const x0 = -hw;
    const x1 = hw;
    const y0 = -th;
    const y1 = 0;
    const z0 = -hd;
    const z1 = hd;
    for (let f = 0; f < FACE_KEYS.length; f++) {
      const key = FACE_KEYS[f];
      const setup = FACE_SETUP[key];
      const faceSide = key === 'top' ? 'top' : key === 'bottom' ? 'bottom' : 'side';
      const uv = atlas.uv(T.getFaceTile(b.t, faceSide));
      const uLen = setup.lu(b.w, th, b.d);
      const vLen = setup.lv(b.w, th, b.d);
      const cu = Math.max(1, Math.round(uLen));
      const cv = Math.max(1, Math.round(vLen));
      const o = setup.o(x0, x1, y0, y1, z0, z1);
      const u = setup.u;
      const v = setup.v;
      const light = FACE_LIGHT[key];
      for (let iu = 0; iu < cu; iu++) {
        const a0 = (uLen * iu) / cu;
        const a1 = (uLen * (iu + 1)) / cu;
        for (let iv = 0; iv < cv; iv++) {
          const b0 = (vLen * iv) / cv;
          const b1 = (vLen * (iv + 1)) / cv;
          const p0 = [o[0] + u[0] * a0 + v[0] * b0, o[1] + u[1] * a0 + v[1] * b0, o[2] + u[2] * a0 + v[2] * b0];
          const p1 = [o[0] + u[0] * a1 + v[0] * b0, o[1] + u[1] * a1 + v[1] * b0, o[2] + u[2] * a1 + v[2] * b0];
          const p2 = [o[0] + u[0] * a1 + v[0] * b1, o[1] + u[1] * a1 + v[1] * b1, o[2] + u[2] * a1 + v[2] * b1];
          const p3 = [o[0] + u[0] * a0 + v[0] * b1, o[1] + u[1] * a0 + v[1] * b1, o[2] + u[2] * a0 + v[2] * b1];
          pushQuad(d, p0, p1, p2, p3, setup.n, uv, light);
        }
      }
    }
    return geometryFromChunk(d);
  };

  WorldView.prototype.addMoverMesh = function (b) {
    const geo = this.localGeometry(b);
    const trans = VOX.Textures.isTransparent(b.t);
    const mat = trans ? this.atlas.transparentMaterial() : this.atlas.material();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = !trans;
    mesh.receiveShadow = true;
    mesh.position.set(b.x, b.y, b.z);
    this.root.add(mesh);
    this.movers.set(b, mesh);
    return mesh;
  };

  WorldView.prototype.addBox = function (b) {
    if (b.mover) return this.addMoverMesh(b);
    const geo = this.localGeometry(b);
    const trans = VOX.Textures.isTransparent(b.t);
    const mat = trans ? this.atlas.transparentMaterial() : this.atlas.material();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = !trans;
    mesh.receiveShadow = true;
    mesh.position.set(b.x, b.y, b.z);
    this.root.add(mesh);
    this.dynamic.set(b, mesh);
    return mesh;
  };

  WorldView.prototype.removeBox = function (b) {
    let mesh = this.dynamic.get(b);
    if (!mesh) mesh = this.movers.get(b);
    if (!mesh) return false;
    this.root.remove(mesh);
    if (mesh.geometry) mesh.geometry.dispose();
    this.dynamic.delete(b);
    this.movers.delete(b);
    return true;
  };

  WorldView.prototype.setQuality = function (q) {
    this.quality = q;
    if (this.sun.shadow.map) {
      this.sun.shadow.map.dispose();
      this.sun.shadow.map = null;
    }
    if (q === 'low') {
      this.sun.castShadow = false;
      this.sun.shadow.mapSize.set(512, 512);
      this.sun.shadow.camera.left = -42;
      this.sun.shadow.camera.right = 42;
      this.sun.shadow.camera.top = 42;
      this.sun.shadow.camera.bottom = -42;
      this.buildClouds(8);
    } else if (q === 'medium') {
      this.sun.castShadow = true;
      this.sun.shadow.mapSize.set(1024, 1024);
      this.sun.shadow.camera.left = -48;
      this.sun.shadow.camera.right = 48;
      this.sun.shadow.camera.top = 48;
      this.sun.shadow.camera.bottom = -48;
      this.buildClouds(12);
    } else {
      this.sun.castShadow = true;
      this.sun.shadow.mapSize.set(1024, 1024);
      this.sun.shadow.camera.left = -55;
      this.sun.shadow.camera.right = 55;
      this.sun.shadow.camera.top = 55;
      this.sun.shadow.camera.bottom = -55;
      this.buildClouds(16);
    }
    this.sun.shadow.camera.updateProjectionMatrix();
  };

  WorldView.prototype.update = function (dt, camera, playerPos) {
    this.time += dt;
    this.movers.forEach((mesh, b) => {
      mesh.position.set(b.x, b.y, b.z);
    });
    this.dynamic.forEach((mesh, b) => {
      mesh.position.set(b.x, b.y, b.z);
    });
    if (playerPos) {
      this.sun.position.set(playerPos.x + 55, playerPos.y + 90, playerPos.z + 30);
      this.sun.target.position.set(playerPos.x, playerPos.y, playerPos.z);
      this.sun.target.updateMatrixWorld();
      this.sunSprite.position.set(playerPos.x + 240, playerPos.y + 210, playerPos.z - 300);
      this.stars.position.set(playerPos.x, 0, playerPos.z);
    }
    for (let i = 0; i < this.clouds.children.length; i++) {
      const c = this.clouds.children[i];
      c.position.x += c.userData.speed * dt;
      if (c.position.x > 260) c.position.x = -260;
    }
    for (let i = 0; i < this.particles.length; i++) {
      const m = this.particles[i];
      if (m.userData.life <= 0) continue;
      m.userData.life -= dt;
      m.userData.vel.y -= 11 * dt;
      m.position.addScaledVector(m.userData.vel, dt);
      m.scale.multiplyScalar(1 - dt * 1.4);
      if (m.userData.life <= 0) {
        m.visible = false;
      }
    }
  };

  VOX.World = {
    WorldView: WorldView,
  };
})(window);
