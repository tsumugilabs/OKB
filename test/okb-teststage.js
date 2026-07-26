/**
 * Single-stage TEST BUILD data for OKB.
 *
 * Overrides window.OKB_SCENE / window.OKB_STORY with ONE self-contained stage
 * so the core escort-sniper loop can be play-tested end to end (gunners +
 * rushers + a boss GUILTY finisher) without the full campaign. The engine
 * (audio/input/entities/cutscene/game) is reused unchanged — this file just
 * replaces the scene table and the story script.
 *
 * Load order in the test build: audio → input → entities → cutscene →
 * THIS FILE → game.
 */
(function (global) {
  "use strict";

  var W = 512, H = 480;

  // ---- A fresh test location: a night shipping yard ----------------------

  function drawYard(ctx) {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#0a0f1a"); g.addColorStop(0.55, "#0d1524"); g.addColorStop(1, "#0a0e18");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // Stars.
    ctx.fillStyle = "rgba(210,220,245,0.6)";
    for (var i = 0; i < 70; i++) ctx.fillRect(i * 89 % W, 6 + (i * 47 % 150), 1, 1);
    // Distant gantry cranes (silhouettes).
    crane(ctx, 90, 150); crane(ctx, 360, 130);
    // Stacked shipping containers as scenery.
    var cols = ["#2b5f6b", "#6b442b", "#3b4b6b", "#5a2b3b", "#4b5a2b"];
    var stacks = [[30, 3], [86, 2], [402, 3], [452, 2]];
    for (var s = 0; s < stacks.length; s++) {
      var bx = stacks[s][0], n = stacks[s][1];
      for (var k = 0; k < n; k++) container(ctx, bx, 344 - k * 22, cols[(s + k) % cols.length]);
    }
    // Ground: the yard apron.
    ctx.fillStyle = "#1a1f28"; ctx.fillRect(0, 384, W, H - 384);
    ctx.fillStyle = "#232a34"; ctx.fillRect(0, 384, W, 5);
    // Painted lane line + sodium lamp pools.
    ctx.strokeStyle = "rgba(230,200,120,0.25)"; ctx.setLineDash([14, 10]); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, 430); ctx.lineTo(W, 430); ctx.stroke(); ctx.setLineDash([]);
    lampPool(ctx, 150, 384); lampPool(ctx, 380, 384);
  }

  function crane(ctx, x, top) {
    ctx.strokeStyle = "#141a24"; ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x, top); ctx.lineTo(x - 18, 344); ctx.moveTo(x, top); ctx.lineTo(x + 18, 344);
    ctx.stroke();
    ctx.fillStyle = "#141a24"; ctx.fillRect(x - 60, top - 6, 140, 8);   // boom
    ctx.fillRect(x + 70, top - 6, 8, 40);                               // hoist
  }

  function container(ctx, x, y, color) {
    ctx.fillStyle = color; ctx.fillRect(x, y, 52, 20);
    ctx.strokeStyle = "rgba(0,0,0,0.4)"; ctx.lineWidth = 1;
    for (var r = 2; r < 52; r += 5) { ctx.beginPath(); ctx.moveTo(x + r, y + 2); ctx.lineTo(x + r, y + 18); ctx.stroke(); }
    ctx.strokeStyle = "rgba(0,0,0,0.5)"; ctx.strokeRect(x + 0.5, y + 0.5, 52, 20);
  }

  function lampPool(ctx, cx, gy) {
    var g = ctx.createRadialGradient(cx, gy, 4, cx, gy, 70);
    g.addColorStop(0, "rgba(255,225,150,0.15)"); g.addColorStop(1, "rgba(255,225,150,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, gy, 70, 24, 0, 0, Math.PI * 2); ctx.fill();
  }

  // ---- Single-stage scene table ------------------------------------------

  var SCENES = {
    yard: {
      name: "コンテナヤード（テスト）",
      ground: 384,
      startX: 24, exitX: 486, exit: "boat",
      escortSpeed: 0.45, escortHp: 6,
      drawBg: drawYard,
      spawns: [
        { t: 80,  x: 300, type: "gunner", dir: -1 },
        { t: 190, side: "right", type: "rusher", speed: 0.95 },
        { t: 300, x: 360, type: "gunner", dir: -1 },
        { t: 410, x: 180, type: "gunner", dir: 1 },
        { t: 520, side: "right", type: "rusher", speed: 1.0 },
        { t: 640, x: 420, type: "gunner", dir: -1 },
        { t: 760, side: "left",  type: "rusher", speed: 1.05 },
        { t: 880, x: 430, type: "gunner", dir: -1, boss: true }
      ]
    }
  };

  function get(key) {
    var sc = SCENES[key];
    if (!sc) return null;
    sc.enemyTotal = sc.spawns.length;
    return sc;
  }

  global.OKB_SCENE = { get: get, W: W, H: H };

  // ---- Single-chapter story (snappy, for testing the flow) ---------------

  global.OKB_STORY = {
    title: "OKB",
    subtitle: "― 護衛対象を、狙撃で守れ（テストステージ） ―",
    prologue: { panels: [
      { bg: "scope", speaker: "通信", text: "「テスト任務だ。護衛対象をヤードの出口まで通せ。」" }
    ]},
    chapters: [{
      id: 1,
      title: "テストステージ　コンテナヤード",
      scene: "yard",
      intro: { panels: [
        { bg: "harbor_night", figure: "agent", figureX: 150, speaker: "エージェント",
          text: "「ヤードを抜けて脱出艇へ向かう。狙撃手、露払いを頼む。」" },
        { bg: "scope", speaker: "OKB",
          text: "「歩け。妨害する者は、俺が全部落とす。」" }
      ]},
      outro: { panels: [
        { bg: "harbor_night", figure: "agent", figureX: 360, speaker: "エージェント",
          text: "「脱出艇に着いた。……いい腕だ。テスト合格だな。」" }
      ]}
    }],
    ending: { panels: [
      { bg: "scope", speaker: "OKB", text: "「護衛完了。テスト任務、異常なし。」" },
      { bg: "black", text: "《 テストステージ ―― 終 》" }
    ]}
  };
})(window);
