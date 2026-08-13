/* 星海远航 · WebAudio 合成音效（零外部资源） */
(function (root) {
  'use strict';
  const S = (root.STARFALL = root.STARFALL || {});

  const Audio = {
    ctx: null, master: null, _unlocked: false, _muted: false, _engine: null, _engineGain: null,

    unlock() {
      if (this._unlocked) return;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this._muted ? 0 : 0.85;
        this.master.connect(this.ctx.destination);
        this._unlocked = true;
        this._startEngineHum();
      } catch (e) { /* 无音频环境则静默 */ }
    },

    setMuted(m) { this._muted = m; if (this.master) this.master.gain.value = m ? 0 : 0.85; },
    isMuted() { return this._muted; },

    _now() { return this.ctx.currentTime; },

    tone(opts) {
      if (!this._unlocked) return;
      try {
        const { freq = 440, end = freq, dur = 0.15, type = 'sine', vol = 0.2, attack = 0.005, delay = 0 } = opts;
        const t0 = this._now() + delay;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = type; osc.frequency.setValueAtTime(freq, t0);
        osc.frequency.exponentialRampToValueAtTime(Math.max(1, end), t0 + dur);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        osc.connect(g); g.connect(this.master);
        osc.start(t0); osc.stop(t0 + dur + 0.02);
      } catch (e) {}
    },

    noise(opts) {
      if (!this._unlocked) return;
      try {
        const { dur = 0.3, vol = 0.2, type = 'lowpass', freq = 800, end = freq, delay = 0 } = opts;
        const t0 = this._now() + delay;
        const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        const src = this.ctx.createBufferSource(); src.buffer = buf;
        const f = this.ctx.createBiquadFilter(); f.type = type;
        f.frequency.setValueAtTime(freq, t0);
        f.frequency.exponentialRampToValueAtTime(Math.max(1, end), t0 + dur);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(vol, t0);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        src.connect(f); f.connect(g); g.connect(this.master);
        src.start(t0); src.stop(t0 + dur + 0.02);
      } catch (e) {}
    },

    _startEngineHum() {
      if (!this._unlocked || this._engine) return;
      try {
        const g = this.ctx.createGain(); g.gain.value = 0;
        const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 220;
        const o1 = this.ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 55;
        const o2 = this.ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 55.8;
        const g1 = this.ctx.createGain(); g1.gain.value = 0.5;
        const g2 = this.ctx.createGain(); g2.gain.value = 0.5;
        o1.connect(g1); o2.connect(g2); g1.connect(f); g2.connect(f); f.connect(g); g.connect(this.master);
        o1.start(); o2.start();
        this._engine = { o1, o2, g };
        this._engineGain = g;
      } catch (e) {}
    },

    /** 引擎声随推力 0..1 */
    setEngineLevel(v) {
      if (!this._engineGain) return;
      const lv = Math.max(0, Math.min(1, v));
      this._engineGain.gain.setTargetAtTime(lv * 0.14, this._now(), 0.08);
      this._engine.o1.frequency.setTargetAtTime(50 + lv * 55, this._now(), 0.1);
    },

    // ---- 具体音效 ----
    ui() { this.tone({ freq: 660, end: 880, dur: 0.06, type: 'square', vol: 0.08 }); },
    click() { this.tone({ freq: 520, end: 620, dur: 0.05, type: 'triangle', vol: 0.1 }); },
    error() { this.tone({ freq: 220, end: 140, dur: 0.18, type: 'square', vol: 0.1 }); },
    laser() { this.tone({ freq: 1400, end: 320, dur: 0.12, type: 'sawtooth', vol: 0.09 }); this.noise({ dur: 0.05, vol: 0.05, freq: 3000 }); },
    kinetic() { this.noise({ dur: 0.1, vol: 0.16, type: 'lowpass', freq: 1400, end: 300 }); },
    missile() { this.noise({ dur: 0.25, vol: 0.14, type: 'bandpass', freq: 900, end: 2200 }); },
    shieldHit() { this.tone({ freq: 900, end: 500, dur: 0.1, type: 'sine', vol: 0.1 }); },
    hullHit() { this.noise({ dur: 0.15, vol: 0.2, freq: 400, end: 120 }); this.tone({ freq: 160, end: 70, dur: 0.18, type: 'triangle', vol: 0.16 }); },
    explosion(big) { this.noise({ dur: big ? 0.8 : 0.4, vol: big ? 0.5 : 0.3, freq: 500, end: 60 }); this.tone({ freq: 120, end: 35, dur: big ? 0.7 : 0.4, type: 'triangle', vol: 0.35 }); },
    mine() { this.tone({ freq: 300, end: 180, dur: 0.08, type: 'square', vol: 0.07 }); },
    scanTick() { this.tone({ freq: 900 + Math.random() * 300, dur: 0.05, type: 'sine', vol: 0.07 }); },
    scanDone() { this.tone({ freq: 523, dur: 0.1, type: 'sine', vol: 0.12 }); this.tone({ freq: 784, dur: 0.14, type: 'sine', vol: 0.12, delay: 0.09 }); },
    alarm() { this.tone({ freq: 700, end: 500, dur: 0.4, type: 'square', vol: 0.09 }); },
    warpCharge() { this.tone({ freq: 120, end: 720, dur: 1.2, type: 'sawtooth', vol: 0.1 }); },
    warpJump() { this.noise({ dur: 0.7, vol: 0.3, freq: 400, end: 3000 }); this.tone({ freq: 200, end: 1200, dur: 0.6, type: 'sawtooth', vol: 0.16 }); },
    dock() { this.tone({ freq: 440, dur: 0.08, type: 'sine', vol: 0.1 }); this.tone({ freq: 660, dur: 0.12, type: 'sine', vol: 0.1, delay: 0.08 }); },
    pickup() { this.tone({ freq: 620, end: 980, dur: 0.12, type: 'triangle', vol: 0.12 }); },
    alarmLow() { this.tone({ freq: 240, end: 180, dur: 0.5, type: 'sawtooth', vol: 0.1 }); }
  };

  // 首次用户交互解锁音频
  function hook() {
    const f = () => { Audio.unlock(); };
    window.addEventListener('pointerdown', f, { once: false });
    window.addEventListener('keydown', f, { once: false });
  }
  if (typeof window !== 'undefined') hook();

  S.Audio = Audio;
})(typeof window !== 'undefined' ? window : globalThis);
