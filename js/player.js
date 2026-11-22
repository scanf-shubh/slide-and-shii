// Articulated Minecraft-style Voxel Player Rig & Separate-Pass First-Person Viewmodel
(function (global) {
  const VOX = (global.VOX = global.VOX || {});

  function cloneMat(m) {
    return Array.isArray(m) ? m.map((x) => x.clone()) : m.clone();
  }

  function makeVoxelSword(tier = 'diamond') {
    const g = new THREE.Group();
    const colors = {
      diamond: { blade: 0x4ae8f5, edge: 0x9efaff, guard: 0x2a7a85, hilt: 0x6e4a28, pommel: 0x35b8c7 },
      iron: { blade: 0xd8dee6, edge: 0xffffff, guard: 0x6b7480, hilt: 0x6e4a28, pommel: 0x9aa4b0 },
      gold: { blade: 0xf7cf3b, edge: 0xfff394, guard: 0xb88214, hilt: 0x5c3c1e, pommel: 0xd9a020 },
    }[tier] || {};

    const addPart = (w, h, d, x, y, z, col) => {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshLambertMaterial({ color: col })
      );
      m.position.set(x, y, z);
      g.add(m);
      return m;
    };

    // Sword points forward along -Z and slightly up
    addPart(0.05, 0.05, 0.14, 0, 0, 0.07, colors.hilt);       // handle
    addPart(0.07, 0.07, 0.05, 0, 0, 0.16, colors.pommel);     // pommel
    addPart(0.18, 0.05, 0.05, 0, 0, -0.02, colors.guard);     // crossguard
    addPart(0.07, 0.03, 0.56, 0, 0, -0.32, colors.blade);     // core blade
    addPart(0.04, 0.04, 0.50, 0, 0, -0.31, colors.edge);      // center ridge
    addPart(0.04, 0.025, 0.08, 0, 0, -0.63, colors.edge);     // tip
    return g;
  }

  function makeVoxelSpear() {
    const g = new THREE.Group();
    const addPart = (w, h, d, x, y, z, col) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color: col }));
      m.position.set(x, y, z);
      g.add(m);
      return m;
    };
    addPart(0.045, 0.045, 1.28, 0, 0, -0.42, 0x8a6438);
    addPart(0.075, 0.075, 0.06, 0, 0, 0.24, 0x5b4025);
    addPart(0.06, 0.06, 0.16, 0, 0, -1.12, 0xc9d1da);
    addPart(0.16, 0.035, 0.24, 0, 0, -1.25, 0xe9f3ff);
    addPart(0.035, 0.16, 0.24, 0, 0, -1.25, 0xe9f3ff);
    addPart(0.045, 0.045, 0.18, 0, 0, -1.43, 0xffffff);
    return g;
  }

  function makeGrappleHook() {
    const g = new THREE.Group();
    const addPart = (w, h, d, x, y, z, col) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color: col }));
      m.position.set(x, y, z);
      g.add(m);
      return m;
    };
    addPart(0.07, 0.07, 0.42, 0, 0, -0.12, 0x4a5663);
    addPart(0.05, 0.05, 0.18, 0, 0, -0.38, 0xffd23f);
    addPart(0.24, 0.05, 0.06, 0, 0, -0.48, 0x35e0e8);
    addPart(0.05, 0.24, 0.06, 0, 0, -0.48, 0x35e0e8);
    const prong = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.28, 0.05), new THREE.MeshLambertMaterial({ color: 0xffd23f }));
    prong.position.set(0, -0.15, -0.54);
    prong.rotation.x = -0.6;
    g.add(prong);
    return g;
  }

  function makeGoldenApple() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.22, 0.22),
      new THREE.MeshLambertMaterial({ color: 0xf7ca2e, emissive: 0x3a2600 })
    );
    const stem = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.08, 0.04),
      new THREE.MeshLambertMaterial({ color: 0x5c3c1e })
    );
    stem.position.y = 0.14;
    const leaf = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.04, 0.06),
      new THREE.MeshLambertMaterial({ color: 0x57bd3e })
    );
    leaf.position.set(0.05, 0.14, 0);
    g.add(body, stem, leaf);
    return g;
  }

  function makeNameSprite(name, teamColor) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    function redraw(hp, maxHp, displayName) {
      ctx.clearRect(0, 0, 256, 64);
      const label = displayName || name || 'Player';
      ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
      const tw = Math.min(220, ctx.measureText(label).width + 24);
      const bx = (256 - tw) / 2;

      ctx.fillStyle = 'rgba(10, 14, 20, 0.72)';
      ctx.fillRect(bx, 4, tw, 30);
      if (teamColor) {
        ctx.fillStyle = teamColor;
        ctx.fillRect(bx, 4, 5, 30);
      }

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, 128, 19);

      // Health bar under name
      if (typeof hp === 'number') {
        const bw = 110;
        const hx = (256 - bw) / 2;
        ctx.fillStyle = 'rgba(10, 14, 20, 0.8)';
        ctx.fillRect(hx - 2, 38, bw + 4, 10);
        const pct = Math.max(0, Math.min(1, hp / (maxHp || 20)));
        ctx.fillStyle = pct > 0.5 ? '#7ce635' : pct > 0.25 ? '#f5b82e' : '#e8483f';
        ctx.fillRect(hx, 40, Math.round(bw * pct), 6);
      }
    }

    redraw(20, 20, name);
    const tex = new THREE.CanvasTexture(canvas);
    tex.encoding = THREE.sRGBEncoding;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(1.6, 0.4, 1);
    sprite.position.set(0, 2.22, 0);
    sprite.userData.redraw = (hp, maxHp, n) => {
      redraw(hp, maxHp, n);
      tex.needsUpdate = true;
    };
    return sprite;
  }

  function createPlayerRig(opts = {}) {
    const skinId = opts.skin || 'steve';
    const skinBundle = VOX.Textures.makeSkinMaterials(skinId);

    const root = new THREE.Group();
    const body = new THREE.Group(); // shifts down slightly when sneaking
    root.add(body);

    const headMat = cloneMat(skinBundle.head);
    const torsoMat = cloneMat(skinBundle.torso);
    const armMatL = cloneMat(skinBundle.arm);
    const armMatR = cloneMat(skinBundle.arm);
    const legMatL = cloneMat(skinBundle.leg);
    const legMatR = cloneMat(skinBundle.leg);

    const allMats = [];
    [headMat, torsoMat, armMatL, armMatR, legMatL, legMatR].forEach((m) => {
      if (Array.isArray(m)) allMats.push(...m);
      else allMats.push(m);
    });

    // Head pivot at neck y = 1.36
    const headPivot = new THREE.Group();
    headPivot.position.set(0, 1.36, 0);
    const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.46, 0.46), headMat);
    headMesh.position.set(0, 0.23, 0);
    headMesh.castShadow = true;
    headPivot.add(headMesh);
    body.add(headPivot);

    // Torso centered at y = 1.04 (0.72 .. 1.36)
    const torsoMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.64, 0.26), torsoMat);
    torsoMesh.position.set(0, 1.04, 0);
    torsoMesh.castShadow = true;
    body.add(torsoMesh);

    // Left Arm pivot at shoulder (-0.36, 1.32, 0)
    const leftArmPivot = new THREE.Group();
    leftArmPivot.position.set(-0.36, 1.32, 0);
    const leftArmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.64, 0.22), armMatL);
    leftArmMesh.position.set(0, -0.28, 0);
    leftArmMesh.castShadow = true;
    leftArmPivot.add(leftArmMesh);
    body.add(leftArmPivot);

    // Right Arm pivot at shoulder (+0.36, 1.32, 0)
    const rightArmPivot = new THREE.Group();
    rightArmPivot.position.set(0.36, 1.32, 0);
    const rightArmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.64, 0.22), armMatR);
    rightArmMesh.position.set(0, -0.28, 0);
    rightArmMesh.castShadow = true;
    rightArmPivot.add(rightArmMesh);
    body.add(rightArmPivot);

    // Held items inside right hand
    const handAnchor = new THREE.Group();
    handAnchor.position.set(0, -0.56, -0.06);
    rightArmPivot.add(handAnchor);

    const sword = makeVoxelSword(opts.swordTier || 'diamond');
    sword.rotation.x = Math.PI * 0.42;
    sword.position.set(0, -0.02, -0.04);
    handAnchor.add(sword);

    const spear = makeVoxelSpear();
    spear.rotation.x = Math.PI * 0.46;
    spear.position.set(0, -0.02, -0.1);
    spear.visible = false;
    handAnchor.add(spear);

    const hook = makeGrappleHook();
    hook.rotation.x = Math.PI * 0.38;
    hook.position.set(0, -0.02, -0.08);
    hook.visible = false;
    handAnchor.add(hook);

    const heldBlock = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.26, 0.26),
      VOX.Textures.getBlockMaterial(opts.blockType || 'wool_red')
    );
    heldBlock.position.set(0, -0.02, -0.14);
    heldBlock.visible = false;
    handAnchor.add(heldBlock);

    const gapple = makeGoldenApple();
    gapple.position.set(0, -0.02, -0.12);
    gapple.visible = false;
    handAnchor.add(gapple);

    // Left Leg pivot at hip (-0.125, 0.72, 0)
    const leftLegPivot = new THREE.Group();
    leftLegPivot.position.set(-0.125, 0.72, 0);
    const leftLegMesh = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.72, 0.24), legMatL);
    leftLegMesh.position.set(0, -0.36, 0);
    leftLegMesh.castShadow = true;
    leftLegPivot.add(leftLegMesh);
    body.add(leftLegPivot);

    // Right Leg pivot at hip (+0.125, 0.72, 0)
    const rightLegPivot = new THREE.Group();
    rightLegPivot.position.set(0.125, 0.72, 0);
    const rightLegMesh = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.72, 0.24), legMatR);
    rightLegMesh.position.set(0, -0.36, 0);
    rightLegMesh.castShadow = true;
    rightLegPivot.add(rightLegMesh);
    body.add(rightLegPivot);

    // Contact shadow disk (lightweight ground anchor even when Shadows = Low/Off)
    const blobShadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.36, 12),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false })
    );
    blobShadow.rotation.x = -Math.PI / 2;
    blobShadow.position.y = 0.015;
    root.add(blobShadow);

    const ringGeo = THREE.RingGeometry ? new THREE.RingGeometry(0.42, 0.56, 28) : new THREE.CircleGeometry(0.56, 28);
    const teamRing = new THREE.Mesh(
      ringGeo,
      new THREE.MeshBasicMaterial({
        color: opts.teamColor === undefined ? 0x35e0e8 : opts.teamColor,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    teamRing.rotation.x = -Math.PI / 2;
    teamRing.position.y = 0.02;
    root.add(teamRing);

    // Optional nametag
    let nameSprite = null;
    if (opts.showTag !== false) {
      nameSprite = makeNameSprite(opts.name || 'Player', opts.teamColor || null);
      root.add(nameSprite);
    }

    const rig = {
      root,
      body,
      headPivot,
      torsoMesh,
      leftArmPivot,
      rightArmPivot,
      leftLegPivot,
      rightLegPivot,
      sword,
      spear,
      hook,
      heldBlock,
      gapple,
      weapon: 'sword',
      blobShadow,
      teamRing,
      nameSprite,
      allMats,
      walkPhase: 0,
      currentSkin: skinId,

      setSkin(newSkin) {
        if (this.currentSkin === newSkin) return;
        this.currentSkin = newSkin;
        const b = VOX.Textures.makeSkinMaterials(newSkin);
        headMesh.material = cloneMat(b.head);
        torsoMesh.material = cloneMat(b.torso);
        leftArmMesh.material = cloneMat(b.arm);
        rightArmMesh.material = cloneMat(b.arm);
        leftLegMesh.material = cloneMat(b.leg);
        rightLegMesh.material = cloneMat(b.leg);
        this.allMats = [];
        [headMesh.material, torsoMesh.material, leftArmMesh.material, rightArmMesh.material, leftLegMesh.material, rightLegMesh.material].forEach((m) => {
          if (Array.isArray(m)) this.allMats.push(...m);
          else this.allMats.push(m);
        });
      },

      setHeldSlot(slot, blockType) {
        sword.visible = false;
        spear.visible = false;
        hook.visible = false;
        heldBlock.visible = slot === 1;
        gapple.visible = slot === 2;
        if (slot === 0) this.setWeapon(this.weapon || 'sword');
        if (blockType && slot === 1) {
          heldBlock.material = VOX.Textures.getBlockMaterial(blockType);
        }
      },

      setWeapon(id) {
        this.weapon = id || 'sword';
        sword.visible = this.weapon === 'sword';
        spear.visible = this.weapon === 'spear';
        hook.visible = this.weapon === 'grapple';
        heldBlock.visible = false;
        gapple.visible = false;
      },

      setHurtFlash(amount) {
        const hex = amount > 0 ? 0xaa1111 : 0x000000;
        for (let i = 0; i < this.allMats.length; i++) {
          this.allMats[i].emissive.setHex(hex);
        }
      },

      setTeamColor(hex) {
        this.teamRing.material.color.setHex(hex);
      },

      setLabel(name, hp, maxHp) {
        if (this.nameSprite) {
          this.nameSprite.userData.redraw(hp, maxHp, name);
        }
      },

      animate(dt, { speed, yaw, pitch, sneak, sprint, ground, slide, swing, block, weapon }) {
        root.rotation.y = yaw || 0;
        headPivot.rotation.x = Math.max(-1.2, Math.min(1.2, pitch || 0));
        if (weapon && weapon !== this.weapon) this.setWeapon(weapon);

        // Crouch/slide animation
        const targetBodyY = slide ? -0.58 : sneak ? -0.18 : 0;
        const targetTorsoTilt = slide ? 1.18 : sneak ? 0.35 : 0;
        body.position.y += (targetBodyY - body.position.y) * Math.min(1, dt * 18);
        torsoMesh.rotation.x = targetTorsoTilt;
        headPivot.position.y = slide ? 1.08 : sneak ? 1.32 : 1.36;

        // Walk/sprint limb swing
        const moveFactor = Math.min(1, (speed || 0) / 7);
        if (moveFactor > 0.05) {
          this.walkPhase += dt * (sprint ? 16 : 11) * Math.max(0.4, moveFactor);
        } else {
          this.walkPhase = Math.abs(Math.sin(this.walkPhase)) < 0.05 ? 0 : this.walkPhase + dt * 6;
        }
        const limbAmp = (sprint ? 0.9 : 0.62) * moveFactor;
        const sw = Math.sin(this.walkPhase) * limbAmp;

        if (slide) {
          leftLegPivot.rotation.x = -1.15;
          rightLegPivot.rotation.x = -0.55;
          leftArmPivot.rotation.x = 0.9;
        } else {
          leftLegPivot.rotation.x = sw;
          rightLegPivot.rotation.x = -sw;
          leftArmPivot.rotation.x = -sw * 0.85;
        }

        // Right arm: weapon action, block, or walk swing
        const w = weapon || this.weapon;
        if (block) {
          rightArmPivot.rotation.x = 0.95;
          rightArmPivot.rotation.y = 0.65;
          rightArmPivot.rotation.z = -0.25;
        } else if (swing > 0) {
          const s = Math.sin(swing * Math.PI);
          if (w === 'spear') {
            rightArmPivot.rotation.x = 1.1 - s * 0.7;
            rightArmPivot.rotation.y = -0.12;
            rightArmPivot.rotation.z = 0.08;
          } else {
            rightArmPivot.rotation.x = 0.4 + s * 1.45;
            rightArmPivot.rotation.y = -s * 0.45;
            rightArmPivot.rotation.z = s * 0.25;
          }
        } else if (w === 'grapple') {
          rightArmPivot.rotation.x = 0.95 + (ground ? 0 : 0.12);
          rightArmPivot.rotation.y = -0.08;
          rightArmPivot.rotation.z = 0;
        } else {
          rightArmPivot.rotation.x = sw * 0.85 + (ground ? 0 : 0.25);
          rightArmPivot.rotation.y = 0;
          rightArmPivot.rotation.z = 0;
        }
      },
    };

    return rig;
  }

  // Separate scene + camera for first-person viewmodel (zero polygon clipping/depth bugs)
  function createViewmodel(skinId = 'steve') {
    const vmScene = new THREE.Scene();
    const vmCam = new THREE.PerspectiveCamera(62, 1, 0.05, 10);
    vmScene.add(new THREE.HemisphereLight(0xeeffff, 0x44505c, 1.0));
    const vmSun = new THREE.DirectionalLight(0xffffff, 0.75);
    vmSun.position.set(1.5, 3, 2);
    vmScene.add(vmSun);

    const holder = new THREE.Group();
    vmScene.add(holder);

    const skin = VOX.Textures.makeSkinMaterials(skinId);
    const armMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.18, 0.54),
      cloneMat(skin.arm)
    );
    armMesh.position.set(0.06, -0.04, 0.04);
    armMesh.rotation.set(0.15, -0.2, 0.08);
    holder.add(armMesh);

    const sword = makeVoxelSword('diamond');
    sword.position.set(-0.04, 0.14, -0.16);
    sword.rotation.set(0.85, 0.25, -0.15);
    holder.add(sword);

    const spear = makeVoxelSpear();
    spear.position.set(-0.04, 0.1, -0.28);
    spear.rotation.set(0.78, 0.12, -0.06);
    spear.visible = false;
    holder.add(spear);

    const hook = makeGrappleHook();
    hook.position.set(-0.05, 0.12, -0.24);
    hook.rotation.set(0.72, 0.22, -0.08);
    hook.visible = false;
    holder.add(hook);

    const blockMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.28, 0.28),
      VOX.Textures.getBlockMaterial('wool_red')
    );
    blockMesh.position.set(-0.06, 0.1, -0.2);
    blockMesh.rotation.set(0.2, 0.55, 0);
    blockMesh.visible = false;
    holder.add(blockMesh);

    const gapple = makeGoldenApple();
    gapple.position.set(-0.04, 0.1, -0.18);
    gapple.rotation.set(0.1, 0.4, 0);
    gapple.visible = false;
    holder.add(gapple);

    let bobT = 0;

    return {
      scene: vmScene,
      camera: vmCam,
      holder,
      weapon: 'sword',
      setSkin(id) {
        const b = VOX.Textures.makeSkinMaterials(id);
        armMesh.material = cloneMat(b.arm);
      },
      setWeapon(id) {
        this.weapon = id || 'sword';
        sword.visible = this.weapon === 'sword';
        spear.visible = this.weapon === 'spear';
        hook.visible = this.weapon === 'grapple';
        blockMesh.visible = false;
        gapple.visible = false;
      },
      setSlot(slot, blockType) {
        sword.visible = false;
        spear.visible = false;
        hook.visible = false;
        blockMesh.visible = slot === 1;
        gapple.visible = slot === 2;
        if (slot === 0) this.setWeapon(this.weapon || 'sword');
        if (slot === 1 && blockType) {
          blockMesh.material = VOX.Textures.getBlockMaterial(blockType);
        }
      },
      update(dt, aspect, { speed, ground, sprint, swing, block, eat, slide, weapon }) {
        if (weapon && weapon !== this.weapon) this.setWeapon(weapon);
        if (Math.abs(vmCam.aspect - aspect) > 0.001) {
          vmCam.aspect = aspect;
          vmCam.updateProjectionMatrix();
        }
        const moveK = ground ? Math.min(1, speed / 7) : 0;
        bobT += dt * (sprint ? 12 : 8.5) * Math.max(0.2, moveK);
        const bobX = Math.cos(bobT * 0.5) * 0.018 * moveK;
        const bobY = Math.abs(Math.sin(bobT)) * -0.022 * moveK;

        if (block) {
          holder.position.set(0.22, -0.25, -0.48);
          holder.rotation.set(0.52, 0.88, -0.2);
        } else if (eat > 0) {
          const wob = Math.sin(eat * 28) * 0.05;
          holder.position.set(0.14, -0.22 + wob, -0.38);
          holder.rotation.set(0.3 + wob, 0.4, 0);
        } else {
          const sw = Math.sin(swing * Math.PI);
          const spear = this.weapon === 'spear';
          const hook = this.weapon === 'grapple';
          holder.position.set(
            0.34 + bobX - sw * (spear ? 0.28 : 0.16),
            -0.34 + bobY - sw * (spear ? 0.02 : 0.06) + (slide ? 0.18 : 0),
            -0.54 - sw * (spear ? 0.24 : 0.14)
          );
          holder.rotation.set(
            (spear ? -0.35 : hook ? -0.18 : -sw * 1.15) + (sprint ? 0.18 : 0) + (slide ? 0.28 : 0),
            sw * 0.45,
            sw * 0.35
          );
        }
      },
    };
  }

  VOX.Player = {
    createPlayerRig,
    createViewmodel,
    makeVoxelSword,
    makeVoxelSpear,
    makeGrappleHook,
  };
})(window);
