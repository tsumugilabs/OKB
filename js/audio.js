/**
 * Chiptune audio: synthesized SFX and a looping BGM via the Web Audio API.
 * No asset files — everything is generated from oscillators/noise so it works
 * offline and inside a sandboxed page. Audio must be resumed from a user
 * gesture (the START button/tap), per browser autoplay policy.
 *
 * Ported from the Elevator Action engine (js/audio.js) and re-scored for OKB:
 * a slower, tenser spy ostinato in D-minor that suits a sniper's stillness.
 */
(function (global) {
  "use strict";

  var ctx = null;
  var master = null;      // global volume (muting sets this to 0)
  var musicBus = null;    // sub-mix for the BGM
  var muted = false;

  var TEMPO = 104;                    // BPM — slower than the action game
  var musicTimer = null;
  var step = 0;
  var nextNoteTime = 0;

  // D-minor spy ostinato. null = rest. Lead is eighth-notes (16 steps = 2 bars).
  var LEAD = [
    587, null, 698, 587, 440, null, 587, 698,
    784, 698, 587, 523, 440, null, 349, null
  ];
  var BASS = [147, 147, 110, 110, 117, 117, 131, 131]; // quarter notes

  function ensure() {
    if (ctx) return;
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.85;
    master.connect(ctx.destination);
    musicBus = ctx.createGain();
    musicBus.gain.value = 0.26;
    musicBus.connect(master);
  }

  function resume() {
    ensure();
    if (ctx && ctx.state === "suspended") ctx.resume();
  }

  // ---- One-shot voices ----------------------------------------------------

  function blip(o) {
    if (!ctx || muted) return;
    var t = ctx.currentTime;
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = o.type || "square";
    osc.frequency.setValueAtTime(o.f0, t);
    if (o.f1) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f1), t + o.dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.gain || 0.25, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    osc.connect(g); g.connect(master);
    osc.start(t); osc.stop(t + o.dur + 0.02);
  }

  function noiseBurst(dur, gain) {
    if (!ctx || muted) return;
    var t = ctx.currentTime;
    var n = Math.floor(ctx.sampleRate * dur);
    var buf = ctx.createBuffer(1, n, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    var src = ctx.createBufferSource(); src.buffer = buf;
    var g = ctx.createGain(); g.gain.value = gain || 0.3;
    src.connect(g); g.connect(master);
    src.start(t);
  }

  function arpeggio(freqs, dur, type) {
    freqs.forEach(function (f, i) {
      setTimeout(function () {
        blip({ type: type || "square", f0: f, dur: dur, gain: 0.28 });
      }, i * dur * 900);
    });
  }

  var SFX = {
    // Sniper: a crisp shot then a bolt-action reload cycle.
    snipe:   function () { noiseBurst(0.12, 0.4);
                           blip({ type: "sawtooth", f0: 170, f1: 45, dur: 0.35, gain: 0.32 }); },
    reload:  function () { blip({ type: "square", f0: 300, f1: 180, dur: 0.06, gain: 0.14 });
                           setTimeout(function () { blip({ type: "square", f0: 220, f1: 320, dur: 0.06, gain: 0.14 }); }, 140); },
    lock:    function () { blip({ type: "square", f0: 1320, dur: 0.05, gain: 0.14 }); },
    empty:   function () { blip({ type: "square", f0: 140, dur: 0.05, gain: 0.12 }); }, // firing while reloading
    // Threats.
    enemyfire: function () { blip({ type: "sawtooth", f0: 520, f1: 120, dur: 0.14, gain: 0.2 }); noiseBurst(0.06, 0.15); },
    alert:   function () { blip({ type: "square", f0: 620, dur: 0.08, gain: 0.18 });
                           setTimeout(function () { blip({ type: "square", f0: 620, dur: 0.08, gain: 0.18 }); }, 120); },
    hurt:    function () { blip({ type: "sawtooth", f0: 300, f1: 70, dur: 0.4, gain: 0.3 }); }, // escort takes a hit
    explode: function () { noiseBurst(0.26, 0.32); blip({ type: "sawtooth", f0: 180, f1: 40, dur: 0.26, gain: 0.18 }); },
    // GUILTY finisher stinger (reserved for boss moments).
    guilty:  function () {
      blip({ type: "sawtooth", f0: 110, dur: 0.9, gain: 0.22 });
      blip({ type: "sawtooth", f0: 146, dur: 0.9, gain: 0.18 });
      blip({ type: "square", f0: 55, dur: 0.9, gain: 0.16 });
    },
    // Flow.
    arrive:  function () { arpeggio([523, 659, 784], 0.1, "triangle"); }, // escort reaches a checkpoint
    clear:   function () { arpeggio([523, 659, 784, 1047, 1319], 0.14, "square"); },
    over:    function () { arpeggio([392, 330, 262, 196], 0.24, "sawtooth"); },
    win:     function () { arpeggio([523, 659, 784, 1047, 1319, 1568], 0.16, "square"); },
    ui:      function () { blip({ type: "triangle", f0: 660, dur: 0.06, gain: 0.16 }); },
    text:    function () { blip({ type: "square", f0: 880, dur: 0.02, gain: 0.05 }); } // typewriter blip
  };

  function play(name) { if (SFX[name]) SFX[name](); }

  // ---- BGM scheduler (lookahead) -----------------------------------------

  function musicNote(freq, time, dur, type, gain) {
    if (!ctx) return;
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(gain, time + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(g); g.connect(musicBus);
    osc.start(time); osc.stop(time + dur + 0.02);
  }

  function scheduler() {
    if (!ctx) return;
    var eighth = (60 / TEMPO) / 2;
    while (nextNoteTime < ctx.currentTime + 0.12) {
      var lead = LEAD[step % LEAD.length];
      if (lead) musicNote(lead, nextNoteTime, eighth * 0.9, "square", 0.09);
      if (step % 2 === 0) {
        var bass = BASS[(step / 2) % BASS.length];
        musicNote(bass, nextNoteTime, eighth * 1.7, "triangle", 0.16);
      }
      nextNoteTime += eighth;
      step = (step + 1) % LEAD.length;
    }
  }

  function startMusic() {
    ensure();
    if (!ctx || musicTimer) return;
    step = 0;
    nextNoteTime = ctx.currentTime + 0.1;
    musicTimer = setInterval(scheduler, 25);
  }

  function stopMusic() {
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
  }

  function setMuted(m) {
    muted = m;
    if (master) master.gain.value = muted ? 0 : 0.85;
  }

  global.Sound = {
    resume: resume,
    play: play,
    startMusic: startMusic,
    stopMusic: stopMusic,
    setMuted: setMuted,
    isMuted: function () { return muted; }
  };
})(window);
