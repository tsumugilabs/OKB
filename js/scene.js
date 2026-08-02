/**
 * Mission scenes for OKB — the escort's route (and, in the finale, the hunt).
 * This replaces the platformer's level.js.
 *
 * Stages now span a WORLD wider than the screen; the game scrolls a horizontal
 * camera to follow the escort/target. A scene owns: a vector background drawn
 * across `worldW`, the ground line, the escort's start/exit x, and either a
 * spawn schedule (escort stages) or a cover list (the "hunt" finale).
 *
 * Two stage modes:
 *  - "escort": the escort walks start -> exit; enemies ambush; protect them.
 *  - "hunt":   a traitor darts cover-to-cover toward an escape; snipe them in
 *              the open before they get away.
 *
 * All art is original vector drawing (no images) so it runs offline / sandboxed.
 * Coordinates assume a 512x480 viewport (VIEW).
 */
(function (global) {
  "use strict";

  var VIEW = 512, H = 480;

  // ---- shared background helpers (parametric over world width) -----------

  function starField(ctx, worldW, step, y0, y1) {
    ctx.fillStyle = "rgba(220,228,245,0.7)";
    for (var x = 0; x < worldW; x += step) {
      var y = y0 + ((x * 53) % (y1 - y0));
      ctx.fillRect(x, y, 1, 1);
    }
  }

  function skyline(ctx, worldW, baseY, color) {
    ctx.fillStyle = color;
    var seed = [120, 175, 96, 150, 110, 168, 120, 150, 96, 140, 132, 104];
    var x = -10, i = 0;
    while (x < worldW + 10) {
      var w = 46 + (i % 4) * 14, h = seed[i % seed.length];
      ctx.fillRect(x, baseY - h, w - 4, h + 40);
      x += w; i++;
    }
    ctx.fillStyle = "rgba(210,220,250,0.35)";
    for (var wy = baseY - 150; wy < baseY - 10; wy += 12)
      for (var wx = 8; wx < worldW; wx += 14)
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

  // ---- backgrounds --------------------------------------------------------

  function drawHarbor(ctx, worldW) {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#0a1020"); g.addColorStop(0.6, "#0e1830"); g.addColorStop(1, "#0b111f");
    ctx.fillStyle = g; ctx.fillRect(0, 0, worldW, H);
    starField(ctx, worldW, 6, 8, 180);
    skyline(ctx, worldW, 300, "#111a2e");
    var w = ctx.createLinearGradient(0, 320, 0, 360);
    w.addColorStop(0, "#0d1a30"); w.addColorStop(1, "#0a1526");
    ctx.fillStyle = w; ctx.fillRect(0, 320, worldW, 40);
    ctx.fillStyle = "rgba(120,150,210,0.18)";
    for (var i = 0; i * 61 < worldW; i++) ctx.fillRect((i * 61) % worldW, 326 + (i % 4) * 7, 18, 1);
    ctx.fillStyle = "#20242c"; ctx.fillRect(0, 372, worldW, H - 372);
    ctx.fillStyle = "#2a2f38"; ctx.fillRect(0, 372, worldW, 5);
    ctx.strokeStyle = "#171a20"; ctx.lineWidth = 2;
    for (var px = 0; px < worldW; px += 40) { ctx.beginPath(); ctx.moveTo(px, 378); ctx.lineTo(px, H); ctx.stroke(); }
    for (var cx = 120; cx < worldW; cx += 300) { crate(ctx, cx, 338, 34); crate(ctx, cx + 34, 338, 34); }
    for (var lx = 150; lx < worldW; lx += 260) lampPool(ctx, lx, 372);
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

  function drawAlley(ctx, worldW) {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#160a1e"); g.addColorStop(1, "#0c0713");
    ctx.fillStyle = g; ctx.fillRect(0, 0, worldW, H);
    ctx.fillStyle = "#1a1424"; ctx.fillRect(0, 40, worldW, 352);
    for (var wy = 60; wy < 340; wy += 22)
      for (var wx = 12; wx < worldW; wx += 26)
        if ((wx + wy) % 3 === 0) { ctx.fillStyle = "rgba(255,196,120,0.5)"; ctx.fillRect(wx, wy, 10, 12); }
    var signs = ["#ff3b7b", "#3bd6ff", "#ffd93b"], labels = ["夜", "OPEN", "24H"];
    for (var s = 0; s * 300 < worldW; s++) neon(ctx, 40 + s * 300, 80 + (s % 2) * 40, 120, 24, signs[s % 3], labels[s % 3]);
    ctx.fillStyle = "#141019"; ctx.fillRect(0, 392, worldW, H - 392);
    ctx.fillStyle = "#1b1622"; ctx.fillRect(0, 392, worldW, 4);
    ctx.globalAlpha = 0.16;
    for (var r = 40; r < worldW; r += 220) { ctx.fillStyle = signs[(r / 220 | 0) % 3]; ctx.fillRect(r, 408, 64, 56); }
    ctx.globalAlpha = 1;
  }

  function drawTower(ctx, worldW) {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#241633"); g.addColorStop(0.5, "#3a2140"); g.addColorStop(1, "#160e1f");
    ctx.fillStyle = g; ctx.fillRect(0, 0, worldW, H);
    var sun = ctx.createRadialGradient(worldW * 0.5, 150, 10, worldW * 0.5, 150, 260);
    sun.addColorStop(0, "rgba(255,150,90,0.35)"); sun.addColorStop(1, "rgba(255,150,90,0)");
    ctx.fillStyle = sun; ctx.fillRect(0, 0, worldW, 340);
    skyline(ctx, worldW, 340, "#1c1330");
    ctx.fillStyle = "#2a2130"; ctx.fillRect(0, 372, worldW, H - 372);
    ctx.fillStyle = "#342838"; ctx.fillRect(0, 372, worldW, 5);
    ctx.fillStyle = "#241d2b"; ctx.strokeStyle = "#3a2f42"; ctx.lineWidth = 2;
    for (var vx = 120; vx < worldW; vx += 260) { ctx.fillRect(vx, 348, 46, 24); ctx.strokeRect(vx, 348, 46, 24); }
  }

  // Rooftop at deep dusk for the betrayal hunt — cover pillars drawn separately.
  function drawRoofHunt(ctx, worldW) {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#1a1020"); g.addColorStop(0.5, "#2a1424"); g.addColorStop(1, "#0e0810");
    ctx.fillStyle = g; ctx.fillRect(0, 0, worldW, H);
    var moon = ctx.createRadialGradient(worldW * 0.3, 120, 8, worldW * 0.3, 120, 150);
    moon.addColorStop(0, "rgba(180,120,200,0.35)"); moon.addColorStop(1, "rgba(180,120,200,0)");
    ctx.fillStyle = moon; ctx.fillRect(0, 0, worldW, 320);
    starField(ctx, worldW, 7, 8, 150);
    skyline(ctx, worldW, 350, "#150e22");
    ctx.fillStyle = "#241a2c"; ctx.fillRect(0, 384, worldW, H - 384);
    ctx.fillStyle = "#2e2236"; ctx.fillRect(0, 384, worldW, 5);
    // gravel speckle
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    for (var gx = 0; gx < worldW; gx += 9) ctx.fillRect(gx, 396 + (gx % 3) * 18, 2, 2);
  }

  /** A cover pillar (AC unit / vent) the traitor hides behind. Centre at x. */
  function drawCover(ctx, x, ground, kind) {
    var w = 46, h = 40, left = x - w / 2, top = ground - h;
    ctx.fillStyle = "#2a2230"; ctx.fillRect(left, top, w, h);
    ctx.fillStyle = "#372b40"; ctx.fillRect(left, top, w, 5);
    ctx.strokeStyle = "#453552"; ctx.lineWidth = 2; ctx.strokeRect(left + 0.5, top + 0.5, w, h);
    // louvres
    ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 1;
    for (var i = top + 10; i < ground - 4; i += 6) { ctx.beginPath(); ctx.moveTo(left + 5, i); ctx.lineTo(left + w - 5, i); ctx.stroke(); }
  }

  // ---- scene table --------------------------------------------------------

  var SCENES = {
    harbor: {
      mode: "escort", name: "港 ―― 脱出艇まで",
      worldW: 1024, ground: 372, startX: 30, exitX: 994, exit: "boat",
      escortSpeed: 0.6, escortHp: 6, drawBg: drawHarbor,
      spawns: [
        { t: 40, x: 220, type: "gunner", dir: -1 },
        { t: 40, x: 430, type: "gunner", dir: -1 },
        { t: 40, x: 630, type: "gunner", dir: -1 },
        { t: 40, x: 820, type: "gunner", dir: -1 },
        { t: 40, x: 950, type: "gunner", dir: -1 }
      ]
    },
    alley: {
      mode: "escort", name: "歓楽街 ―― 路地を抜けて",
      worldW: 1024, ground: 392, startX: 30, exitX: 994, exit: "door",
      escortSpeed: 0.62, escortHp: 6, drawBg: drawAlley,
      spawns: [
        { t: 40,  x: 260, type: "gunner", dir: -1 },
        { t: 220, rel: 340, type: "rusher", speed: 0.95 },
        { t: 40,  x: 500, type: "gunner", dir: -1 },
        { t: 40,  x: 720, type: "gunner", dir: -1 },
        { t: 560, rel: 340, type: "rusher", speed: 1.0 },
        { t: 40,  x: 900, type: "gunner", dir: -1 },
        { t: 900, rel: 340, type: "rusher", speed: 1.05 }
      ]
    },
    tower: {
      mode: "escort", name: "塔上 ―― 首魁の狙撃",
      worldW: 1120, ground: 372, startX: 30, exitX: 1090, exit: "heli",
      escortSpeed: 0.58, escortHp: 6, drawBg: drawTower,
      spawns: [
        { t: 40,  x: 280, type: "gunner", dir: -1 },
        { t: 200, rel: 330, type: "rusher", speed: 1.0 },
        { t: 40,  x: 580, type: "gunner", dir: -1 },
        { t: 560, rel: 330, type: "rusher", speed: 1.05 },
        { t: 40,  x: 860, type: "gunner", dir: -1 },
        { t: 40,  x: 1010, type: "gunner", dir: -1, boss: true }
      ]
    },
    betrayal: {
      mode: "hunt", name: "裏切り ―― 元・護衛対象の狩り",
      worldW: 1120, ground: 384, exit: "van", escapeX: 1080,
      drawBg: drawRoofHunt, drawCover: drawCover,
      covers: [140, 400, 660, 900]
    }
  };

  function get(key) {
    var s = SCENES[key];
    if (!s) return null;
    if (s.mode === "escort") s.enemyTotal = s.spawns.length;
    return s;
  }

  global.OKB_SCENE = { get: get, W: VIEW, VIEW: VIEW, H: H, drawCover: drawCover };
})(window);
