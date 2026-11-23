// Shared Minecraft-style PvP combat: reach, crits, i-frames, knockback.
(function (global) {
  const VOX = (global.VOX = global.VOX || {});
  const Physics = VOX.Physics;

  const Combat = {
    MAX_HP: 20,
    BASE_DAMAGE: 6,
    REACH: 3.15,
    SWORD_BLOCK_MULT: 0.5,
    IFRAMES: 4,
    weapons: {
      sword: { id: 'sword', name: 'Sword', damage: 6, reach: 3.2, cooldown: 8, maxHits: 1, cone: 0.54, kb: 0.135, block: 0.5 },
      spear: { id: 'spear', name: 'Spear', damage: 4, reach: 4.7, cooldown: 12, maxHits: 2, cone: 0.76, kb: 0.09, block: 0.6, dashRange: 6.5, chargeMin: 16, chargeMax: 60, chargeRange: 9, chargeDamage: 10, chargeKb: 0.2, chargeCooldown: 32 },
      bow: { id: 'bow', name: 'Bow', damage: 5, reach: 32, cooldown: 16, maxHits: 1, cone: 0.5, kb: 0.11, block: 0.65, speed: 0.62, gravity: 0.0035, ttl: 110 },
    },
    weapon(id) {
      return this.weapons[id] || this.weapons.sword;
    },

    dirFrom(yaw, pitch) {
      return {
        x: -Math.sin(yaw) * Math.cos(pitch),
        y: Math.sin(pitch),
        z: -Math.cos(yaw) * Math.cos(pitch),
      };
    },

    eye(st, sneak) {
      return { x: st.x, y: st.y + (sneak ? 1.52 : 1.62), z: st.z };
    },

    crit(st) {
      return !st.ground && st.vy < 0;
    },

    hitTest(origin, dir, st, reach, cone) {
      const r = reach || this.REACH;
      const t = Physics.raycastPlayer(origin, dir, { x: st.x, y: st.y, z: st.z }, r);
      if (t >= 0) return t;
      const cx = st.x, cy = st.y + 0.95, cz = st.z;
      const dx = cx - origin.x, dy = cy - origin.y, dz = cz - origin.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d < 1e-4 || d > r + 0.45) return -1;
      const dot = (dx * dir.x + dy * dir.y + dz * dir.z) / d;
      return dot >= (cone || 0.62) ? d : -1;
    },

    applyDamage(target, dmg) {
      if (!target) return 0;
      if (target.invuln > 0) {
        if (dmg <= target.lastHit) return 0;
        const diff = dmg - target.lastHit;
        target.lastHit = dmg;
        target.invuln = this.IFRAMES;
        target.hp -= diff;
        return diff;
      }
      target.invuln = this.IFRAMES;
      target.lastHit = dmg;
      target.hp -= dmg;
      return dmg;
    },

    knock(attacker, target, yaw, mult) {
      if (!attacker || !target) return;
      Physics.applyKnockback(attacker.st, target.st, yaw, mult || 1);
      target.hitFlash = 6;
    },

    tickStatus(p) {
      if (p.invuln > 0) p.invuln--;
      if (p.hitFlash > 0) p.hitFlash--;
      if (!p.st.sprint) p.st.kb = true;
    },
  };

  VOX.Combat = Combat;
})(window);
