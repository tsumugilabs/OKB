/**
 * Mission scenes for OKB — the escort's route and the enemies that ambush it.
 * This replaces the platformer's level.js.
 *
 * A scene owns: a hand-drawn vector background, the ground line the escort and
 * enemies stand on, the escort's start/exit x, and a spawn schedule (a table of
 * {t, x|side, type, dir, boss} the game turns into `Entities.Enemy`s over time).
 * All art is original vector drawing (no external images) so the page works
 * offline / in a sandbox. Each stage plays on a single 512x480 screen.
 */
(function (global) {
  "use strict";

  var W = 512, H = 480;

  function starField(ctx, n, y0, y1) {
    ctx.fillStyle = "rgba(220,228,245,0.7)";
    for (var i = 0; i < n; i++) {
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
    ctx.fillStyle = "rgba(210,220,250,0.35)";
    for (var wy = baseY - 150; wy < baseY - 10; wy += 12)
      for (var wx = 8; wx < W; wx += 14)
        if ((wx * 3 + wy) % 5 === 0) ctx.fillRect(wx, wy, 3, 4);
  }

  function crate(ctx, x, y, s) {
    ctx.fillStyle = "#5a4a2c"; ctx.fillRect(x, y, s, s);
    ctx.strokeStyle = "#2e2614"; ctx.lineWidth = 2; ctx.strokeRect(x + 0.5, y + 0.5, s, s);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + s, y + s);
    ctx.moveTo(x + s, y); ctx.lineTo(x, y + s); ctx.stroke();
  }

  function lampPool(ctx, cx, gy) {
    var g = ctx.createRadialGradient(cx, gy, 4, cx, gy, 70);
    g.addColorStop(0, "rgba(255,230,150,0.16)"); g.addColorStop(1, "rgba(255,230,150,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, gy, 70, 26, 0, 0, Math.PI * 2); ctx.fill();
  }

  // ---- Backgrounds --------------------------------------------------------

  function drawHarbor(ctx) {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#0a1020"); g.addColorStop(0.6, "#0e1830"); g.addColorStop(1, "#0b111f");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    starField(ctx, 90, 8, 180);
    skyline(ctx, 300, "#111a2e");
    // Water band.
    var w = ctx.createLinearGradient(0, 320, 0, 360);
    w.addColorStop(0, "#0d1a30"); w.addColorStop(1, "#0a1526");
    ctx.fillStyle = w; ctx.fillRect(0, 320, W, 40);
    ctx.fillStyle = "rgba(120,150,210,0.18)";
    for (var i = 0; i < 20; i++) ctx.fillRect((i * 61) % W, 326 + (i % 4) * 7, 18, 1);
    // Pier.
    ctx.fillStyle = "#20242c"; ctx.fillRect(0, 372, W, H - 372);
    ctx.fillStyle = "#2a2f38"; ctx.fillRect(0, 372, W, 5);
    ctx.strokeStyle = "#171a20"; ctx.lineWidth = 2;
    for (var pxx = 0; pxx < W; pxx += 40) { ctx.beginPath(); ctx.moveTo(pxx, 378); ctx.lineTo(pxx, H); ctx.stroke(); }
    crate(ctx, 120, 338, 34); crate(ctx, 300, 338, 34); crate(ctx, 334, 338, 34);
    lampPool(ctx, 150, 372); lampPool(ctx, 380, 372);
  }

  function neon(ctx, x, y, w, h, color, label) {
    ctx.save();
    ctx.shadowColor = color; ctx.shadowBlur = 14;
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.font = "bold 15px 'Courier New', monospace"; ctx.textAlign = "center";
    ctx.fillText(label, x + w / 2, y + h - 7);
    ctx.textAlign = "left";
    ctx.restore();
  }

  function drawAlley(ctx) {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#160a1e"); g.addColorStop(1, "#0c0713");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#1a1424"; ctx.fillRect(0, 40, W, 320);
    for (var wy = 60; wy < 340; wy += 22)
      for (var wx = 12; wx < W; wx += 26)
        if ((wx + wy) % 3 === 0) { ctx.fillStyle = "rgba(255,196,120,0.5)"; ctx.fillRect(wx, wy, 10, 12); }
    neon(ctx, 40, 90, 120, 26, "#ff3b7b", "夜");
    neon(ctx, 330, 120, 150, 24, "#3bd6ff", "OPEN");
    neon(ctx, 210, 70, 90, 20, "#ffd93b", "24H");
    // Street.
    ctx.fillStyle = "#141019"; ctx.fillRect(0, 392, W, H - 392);
    ctx.fillStyle = "#1b1622"; ctx.fillRect(0, 392, W, 4);
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = "#ff3b7b"; ctx.fillRect(60, 410, 60, 60);
    ctx.fillStyle = "#3bd6ff"; ctx.fillRect(350, 420, 70, 50);
    ctx.globalAlpha = 1;
  }

  function drawTower(ctx) {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#241633"); g.addColorStop(0.5, "#3a2140"); g.addColorStop(1, "#160e1f");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    var s = ctx.createRadialGradient(W * 0.72, 150, 10, W * 0.72, 150, 180);
    s.addColorStop(0, "rgba(255,150,90,0.4)"); s.addColorStop(1, "rgba(255,150,90,0)");
    ctx.fillStyle = s; ctx.fillRect(0, 0, W, 320);
    skyline(ctx, 340, "#1c1330");
    ctx.strokeStyle = "#120c1e"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(70, 120); ctx.lineTo(40, 340); ctx.moveTo(70, 120); ctx.lineTo(100, 340); ctx.stroke();
    ctx.lineWidth = 2;
    for (var i = 1; i < 6; i++) {
      var yy = 120 + (340 - 120) * (i / 6), wte = 6 + i * 5;
      ctx.beginPath(); ctx.moveTo(70 - wte, yy); ctx.lineTo(70 + wte, yy); ctx.stroke();
    }
    ctx.fillStyle = "#2a2130"; ctx.fillRect(0, 372, W, H - 372);
    ctx.fillStyle = "#342838"; ctx.fillRect(0, 372, W, 5);
    ctx.fillStyle = "#241d2b";
    ctx.fillRect(120, 348, 46, 24); ctx.fillRect(300, 344, 52, 28);
    ctx.strokeStyle = "#3a2f42"; ctx.lineWidth = 2;
    ctx.strokeRect(120, 348, 46, 24); ctx.strokeRect(300, 344, 52, 28);
  }

  // ---- Scene table --------------------------------------------------------

  var SCENES = {
    harbor: {
      name: "港 ―― 脱出艇まで",
      ground: 372,
      startX: 24, exitX: 486, exit: "boat",
      escortSpeed: 0.5, escortHp: 5,
      drawBg: drawHarbor,
      spawns: [
        { t: 130, x: 300, type: "gunner", dir: -1 },
        { t: 300, x: 430, type: "gunner", dir: -1 },
        { t: 470, x: 210, type: "gunner", dir: 1 },
        { t: 650, x: 440, type: "gunner", dir: -1 }
      ]
    },
    alley: {
      name: "歓楽街 ―― 路地を抜けて",
      ground: 392,
      startX: 24, exitX: 486, exit: "door",
      escortSpeed: 0.55, escortHp: 5,
      drawBg: drawAlley,
      spawns: [
        { t: 90,  x: 340, type: "gunner", dir: -1 },
        { t: 210, side: "right", type: "rusher", speed: 0.95 },
        { t: 340, x: 260, type: "gunner", dir: -1 },
        { t: 450, side: "left",  type: "rusher", speed: 1.0 },
        { t: 560, x: 430, type: "gunner", dir: -1 },
        { t: 660, side: "right", type: "rusher", speed: 1.05 }
      ]
    },
    tower: {
      name: "塔上 ―― 首魁の狙撃",
      ground: 372,
      startX: 24, exitX: 486, exit: "heli",
      escortSpeed: 0.5, escortHp: 5,
      drawBg: drawTower,
      spawns: [
        { t: 100, x: 300, type: "gunner", dir: -1 },
        { t: 230, side: "right", type: "rusher", speed: 1.0 },
        { t: 360, x: 360, type: "gunner", dir: -1 },
        { t: 470, side: "left",  type: "rusher", speed: 1.05 },
        { t: 590, x: 432, type: "gunner", dir: -1, boss: true }
      ]
    }
  };

  function get(key) {
    var s = SCENES[key];
    if (!s) return null;
    s.enemyTotal = s.spawns.length;
    return s;
  }

  global.OKB_SCENE = { get: get, W: W, H: H };
})(window);
