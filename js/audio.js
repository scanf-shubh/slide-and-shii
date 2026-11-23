// Lightweight Web Audio API Synthesizer for Minecraft-style SFX
(function (global) {
  const VOX = (global.VOX = global.VOX || {});
  let AC = null;
  let volume = 0.6;

  function ctx() {
    if (!AC) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (C) AC = new C();
    }
    if (AC && AC.state === 'suspended') AC.resume().catch(() => {});
    return AC;
  }

  function tone(freq, dur, type, vol, endFreq, delay = 0) {
    if (volume <= 0.01) return;
    const c = ctx();
    if (!c) return;
    try {
      const t = c.currentTime + delay;
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      if (endFreq) o.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t + dur);
      g.gain.setValueAtTime(Math.max(0.001, vol * volume), t);
      g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      o.connect(g);
      g.connect(c.destination);
      o.start(t);
      o.stop(t + dur);
    } catch (e) {}
  }

  function play(name) {
    switch (name) {
      case 'swing':
        tone(240, 0.07, 'triangle', 0.06, 90);
        break;
      case 'hit':
        tone(280, 0.11, 'square', 0.12, 110);
        break;
      case 'impact':
        tone(95, 0.13, 'sine', 0.2, 48);
        tone(190, 0.06, 'square', 0.07, 90, 0.01);
        break;
      case 'block':
        tone(520, 0.06, 'square', 0.08, 360);
        tone(780, 0.1, 'triangle', 0.05, 520, 0.02);
        break;
      case 'crit':
        tone(680, 0.08, 'square', 0.12, 420);
        tone(960, 0.12, 'triangle', 0.1, 560, 0.04);
        tone(120, 0.16, 'sine', 0.18, 55, 0.01);
        break;
      case 'hurt':
        tone(160, 0.15, 'sawtooth', 0.14, 70);
        break;
      case 'place':
        tone(210, 0.06, 'triangle', 0.12, 130);
        break;
      case 'break':
        tone(140, 0.09, 'square', 0.11, 60);
        break;
      case 'jump':
        tone(310, 0.08, 'triangle', 0.06, 480);
        break;
      case 'doubleJump':
        tone(420, 0.07, 'triangle', 0.06, 720);
        tone(620, 0.1, 'sine', 0.05, 940, 0.03);
        break;
      case 'slide':
        tone(180, 0.12, 'sawtooth', 0.045, 90);
        break;
      case 'spear':
        tone(190, 0.09, 'triangle', 0.05, 310);
        break;
      case 'spearCharge':
        tone(120, 0.16, 'sawtooth', 0.04, 260);
        break;
      case 'spearDash':
        tone(260, 0.14, 'triangle', 0.08, 760);
        tone(90, 0.2, 'sine', 0.12, 45, 0.02);
        break;
      case 'bow':
        tone(720, 0.045, 'triangle', 0.055, 380);
        tone(240, 0.08, 'sine', 0.045, 120, 0.01);
        break;
      case 'arrow':
        tone(380, 0.055, 'sawtooth', 0.035, 620);
        break;
      case 'hookHit':
        tone(300, 0.08, 'square', 0.08, 160);
        tone(620, 0.1, 'triangle', 0.05, 260, 0.02);
        break;
      case 'grapple':
        tone(520, 0.08, 'triangle', 0.08, 920);
        tone(260, 0.14, 'sine', 0.06, 120, 0.03);
        break;
      case 'miss':
        tone(180, 0.07, 'square', 0.04, 120);
        break;
      case 'land':
        tone(110, 0.07, 'triangle', 0.09, 55);
        break;
      case 'bounce':
        tone(200, 0.14, 'sine', 0.12, 520);
        break;
      case 'eat':
        tone(380, 0.06, 'square', 0.06, 260);
        tone(440, 0.06, 'square', 0.06, 300, 0.08);
        tone(620, 0.12, 'sine', 0.1, 880, 0.16);
        break;
      case 'cp':
        tone(660, 0.1, 'sine', 0.12, 880);
        tone(880, 0.16, 'sine', 0.12, 1180, 0.08);
        break;
      case 'win':
        tone(523, 0.14, 'sine', 0.14, 523);
        tone(659, 0.14, 'sine', 0.14, 659, 0.12);
        tone(784, 0.28, 'sine', 0.16, 784, 0.24);
        break;
      case 'fall':
        tone(290, 0.28, 'sawtooth', 0.09, 70);
        break;
      case 'step':
        tone(130, 0.04, 'triangle', 0.035, 90);
        break;
      case 'respawn':
        tone(330, 0.1, 'sine', 0.08, 520);
        tone(520, 0.14, 'sine', 0.07, 720, 0.06);
        break;
      case 'count':
        tone(440, 0.1, 'square', 0.09, 440);
        break;
      case 'go':
        tone(880, 0.16, 'square', 0.11, 880);
        tone(1180, 0.2, 'sine', 0.08, 1180, 0.06);
        break;
      case 'kill':
        tone(160, 0.12, 'square', 0.14, 50);
        tone(90, 0.22, 'sawtooth', 0.1, 40, 0.06);
        break;
      case 'boost':
        tone(260, 0.16, 'sawtooth', 0.07, 760);
        break;
    }
  }

  VOX.Audio = {
    play,
    setVolume(v) { volume = Math.max(0, Math.min(1, v)); },
  };
})(window);
