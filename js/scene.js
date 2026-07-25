/**
 * Mission scenes for OKB — this replaces the platformer's level.js.
 *
 * A scene owns: a hand-drawn vector background, the ground line marks walk on,
 * a time limit, and a spawn schedule (a table of {t, dir, speed, type} entries
 * the game turns into `Entities.Mark`s over time). All art is original vector
 * drawing (no external images) so the page works offline / in a sandbox.
 *
 * Coordinates assume a 512x480 canvas. There is no scrolling camera: each
 * mission plays out on a single screen, which keeps the sniper's frame steady.
 */
(function (global) {
  "use strict";

  var W = 512, H = 480;

  function starField(ctx, n, y0, y1) {
    ctx.fillStyle = "rgba(220,228,245,0.7)";
    for (var i = 0; i < n; i++) {
      // Deterministic-ish scatter using a cheap hash so stars don't twinkle.
      var x = (i * 97 % W);
      var y = y0 + (i * 53 % (y1 - y0));
      ctx.fillRect(x, y, 1, 1);
    }
  }

  function skyline(ctx, baseY, color) {
    ctx.fillStyle = color;
    var bx = [-10, 40, 96, 150, 210, 268, 330, 400, 460, 512];
    var bh = [120, 175, 96, 150, 110, 168, 120, 150, 96, 140];
    for (var c = 0; c < bx.length - 1; c++) {
      ctx.fillRect(bx[c], baseY - bh[c], (bx[c + 1] - bx[c]) - 4, bh[c] + 40);
    }
    // Window speckle.
    ctx.fillStyle = "rgba(210,220,250,0.35)";
    for (var wy = baseY - 150; wy < baseY - 10; wy += 12)
      for (var wx = 8; wx < W; wx += 14)
        if ((wx * 3 + wy) % 5 === 0) ctx.fillRect(wx, wy, 3, 4);
  }

  // ---- Backgrounds --------------------------------------------------------

  function drawHarbor(ctx) {
    // Night sky gradient.
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#0a1020"); g.addColorStop(0.6, "#0e1830"); g.addColorStop(1, "#0b111f");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    starField(ctx, 90, 8, 180);
    // Far shore skyline.
    skyline(ctx, 300, "#111a2e");
    // A moored ship silhouette on the right.
    ctx.fillStyle = "#0c1424";
    ctx.fillRect(300, 250, 200, 70);
    ctx.fillRect(340, 210, 26, 42);        // bridge
    ctx.fillRect(430, 200, 10, 52);        // crane mast
    ctx.strokeStyle = "#0c1424"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(435, 205); ctx.lineTo(470, 260); ctx.stroke();
    // Water with a few reflected highlights.
    var w = ctx.createLinearGradient(0, 320, 0, 360);
    w.addColorStop(0, "#0d1a30"); w.addColorStop(1, "#0a1526");
    ctx.fillStyle = w; ctx.fillRect(0, 320, W, 40);
    ctx.fillStyle = "rgba(120,150,210,0.18)";
    for (var i = 0; i < 20; i++) ctx.fillRect((i * 61) % W, 326 + (i % 4) * 7, 18, 1);
    // The pier / dock the marks walk on.
    ctx.fillStyle = "#20242c"; ctx.fillRect(0, 360, W, H - 360);
    ctx.fillStyle = "#2a2f38"; ctx.fillRect(0, 360, W, 5);
    ctx.strokeStyle = "#171a20"; ctx.lineWidth = 2;
    for (var px = 0; px < W; px += 40) { ctx.beginPath(); ctx.moveTo(px, 366); ctx.lineTo(px, H); ctx.stroke(); }
    // Stacked crates as scenery.
    crate(ctx, 30, 326, 34); crate(ctx, 64, 326, 34); crate(ctx, 47, 292, 34);
    crate(ctx, 452, 322, 38);
    // Sodium dock lamps casting pools.
    lampPool(ctx, 150, 360, "#3a3416"); lampPool(ctx, 380, 360, "#3a3416");
  }

  function crate(ctx, x, y, s) {
    ctx.fillStyle = "#5a4a2c"; ctx.fillRect(x, y, s, s);
    ctx.strokeStyle = "#2e2614"; ctx.lineWidth = 2; ctx.strokeRect(x + 0.5, y + 0.5, s, s);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + s, y + s);
    ctx.moveTo(x + s, y); ctx.lineTo(x, y + s); ctx.stroke();
  }

  function lampPool(ctx, cx, gy, color) {
    var g = ctx.createRadialGradient(cx, gy, 4, cx, gy, 70);
    g.addColorStop(0, "rgba(255,230,150,0.16)"); g.addColorStop(1, "rgba(255,230,150,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, gy, 70, 26, 0, 0, Math.PI * 2); ctx.fill();
  }

  function drawAlley(ctx) {
    // Deep magenta night.
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#160a1e"); g.addColorStop(1, "#0c0713");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // Buildings flanking a narrow alley.
    ctx.fillStyle = "#1a1424"; ctx.fillRect(0, 40, W, 300);
    // Lit windows.
    for (var wy = 60; wy < 320; wy += 22)
      for (var wx = 12; wx < W; wx += 26) {
        if ((wx + wy) % 3 === 0) { ctx.fillStyle = "rgba(255,196,120,0.5)"; ctx.fillRect(wx, wy, 10, 12); }
      }
    // Neon signs.
    neon(ctx, 40, 90, 120, 26, "#ff3b7b", "夜");
    neon(ctx, 330, 120, 150, 24, "#3bd6ff", "OPEN");
    neon(ctx, 210, 70, 90, 20, "#ffd93b", "24H");
    // Street.
    ctx.fillStyle = "#141019"; ctx.fillRect(0, 380, W, H - 380);
    ctx.fillStyle = "#1b1622"; ctx.fillRect(0, 380, W, 4);
    // Wet reflections of the neon.
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = "#ff3b7b"; ctx.fillRect(60, 400, 60, 60);
    ctx.fillStyle = "#3bd6ff"; ctx.fillRect(350, 410, 70, 50);
    ctx.globalAlpha = 1;
  }

  function neon(ctx, x, y, w, h, color, label) {
    ctx.save();
    ctx.shadowColor = color; ctx.shadowBlur = 14;
    ctx.strokeStyle = color; ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.font = "bold 15px 'Courier New', monospace"; ctx.textAlign = "center";
    ctx.fillText(label, x + w / 2, y + h - 7);
    ctx.textAlign = "left";
    ctx.restore();
  }

  function drawTower(ctx) {
    // Dusk gradient.
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#241633"); g.addColorStop(0.5, "#3a2140"); g.addColorStop(1, "#160e1f");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // Low sun haze.
    var s = ctx.createRadialGradient(W * 0.72, 150, 10, W * 0.72, 150, 180);
    s.addColorStop(0, "rgba(255,150,90,0.4)"); s.addColorStop(1, "rgba(255,150,90,0)");
    ctx.fillStyle = s; ctx.fillRect(0, 0, W, 320);
    // Distant skyline below the rooftop line.
    skyline(ctx, 340, "#1c1330");
    // A lattice tower motif on the left (original, not any real landmark).
    ctx.strokeStyle = "#120c1e"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(70, 120); ctx.lineTo(40, 340); ctx.moveTo(70, 120); ctx.lineTo(100, 340); ctx.stroke();
    ctx.lineWidth = 2;
    for (var i = 1; i < 6; i++) {
      var yy = 120 + (340 - 120) * (i / 6), wte = 6 + i * 5;
      ctx.beginPath(); ctx.moveTo(70 - wte, yy); ctx.lineTo(70 + wte, yy); ctx.stroke();
    }
    // The rooftop the fight happens on.
    ctx.fillStyle = "#2a2130"; ctx.fillRect(0, 360, W, H - 360);
    ctx.fillStyle = "#342838"; ctx.fillRect(0, 360, W, 5);
    // Parapet edge in the foreground.
    ctx.fillStyle = "#1c1622"; ctx.fillRect(0, 452, W, H - 452);
    // AC units / vents as cover scenery.
    ctx.fillStyle = "#241d2b";
    ctx.fillRect(40, 336, 46, 24); ctx.fillRect(420, 332, 52, 28);
    ctx.strokeStyle = "#3a2f42"; ctx.lineWidth = 2;
    ctx.strokeRect(40, 336, 46, 24); ctx.strokeRect(420, 332, 52, 28);
  }

  // ---- Scene table --------------------------------------------------------

  // Palette for the tower's suited guards (do-not-shoot, but not "civilians").
  var GUARD = { coat: "#2b2f3a", skin: "#e7c8a0", accent: "#454b5a" };

  var SCENES = {
    harbor: {
      name: "港の受け渡し",
      ground: 372,
      timeLimit: 60 * 30,
      drawBg: drawHarbor,
      spawns: [
        { t: 40,  dir: 1,  speed: 0.55, type: "civ" },
        { t: 150, dir: -1, speed: 0.55, type: "civ" },
        { t: 280, dir: 1,  speed: 0.5,  type: "target" },
        { t: 420, dir: 1,  speed: 0.6,  type: "civ" },
        { t: 560, dir: -1, speed: 0.55, type: "civ" }
      ]
    },
    alley: {
      name: "夜の歓楽街",
      ground: 392,
      timeLimit: 60 * 34,
      drawBg: drawAlley,
      spawns: [
        { t: 30,  dir: 1,  speed: 0.8, type: "civ" },
        { t: 110, dir: 1,  speed: 0.95, type: "target" },
        { t: 200, dir: -1, speed: 0.85, type: "civ" },
        { t: 280, dir: 1,  speed: 0.8, type: "civ" },
        { t: 350, dir: -1, speed: 1.0, type: "target" },
        { t: 450, dir: 1,  speed: 0.85, type: "civ" },
        { t: 520, dir: 1,  speed: 1.0, type: "target" },
        { t: 610, dir: -1, speed: 0.85, type: "civ" }
      ]
    },
    tower: {
      name: "塔上の首魁",
      ground: 372,
      timeLimit: 60 * 30,
      drawBg: drawTower,
      spawns: [
        { t: 30,  dir: 1,  speed: 0.7,  type: "civ", palette: GUARD },
        { t: 120, dir: -1, speed: 0.7,  type: "civ", palette: GUARD },
        { t: 220, dir: 1,  speed: 0.28, type: "target" },   // 〈鴉〉 paces slowly
        { t: 300, dir: 1,  speed: 0.75, type: "civ", palette: GUARD },
        { t: 380, dir: -1, speed: 0.75, type: "civ", palette: GUARD }
      ]
    }
  };

  function get(key) {
    var s = SCENES[key];
    if (!s) return null;
    s.targetsTotal = s.spawns.filter(function (e) { return e.type === "target"; }).length;
    return s;
  }

  global.OKB_SCENE = {
    get: get,
    W: W,
    H: H
  };
})(window);
