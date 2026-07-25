/**
 * Main game loop and state machine for OKB — a story-driven sniper shooter.
 *
 * The signature verb is inherited from Elevator Action's "OKB 13": tap a target
 * and a dramatic sequence plays — slow zoom, lock-on, a one-second gekiga
 * "有罪（ギルティ）" cut, then the headshot. Here that is the *whole* game: each
 * mission is a single-screen scene where marks walk through; eliminate the red
 * TARGETS and spare everyone else. Story briefings thread the missions together.
 *
 * Reused from the original engine: the state-machine + single tick() loop, the
 * synthesized Sound, the AABB hit-test, and the entire GUILTY cinematic
 * (drawGuiltyCut and its vector-art helpers, ported verbatim).
 */
(function (global) {
  "use strict";

  var SCENES = global.OKB_SCENE;
  var STORY = global.OKB_STORY;
  var Entities = global.Entities;
  var Input = global.Input;

  var canvas = document.getElementById("game");
  var ctx = canvas.getContext("2d");
  var overlay = document.getElementById("overlay");

  var hud = {
    mission: document.getElementById("hud-mission"),
    score: document.getElementById("hud-score"),
    hi: document.getElementById("hud-hi"),
    targets: document.getElementById("hud-targets"),
    targetsTotal: document.getElementById("hud-targets-total"),
    cover: document.getElementById("hud-cover"),
    time: document.getElementById("hud-time")
  };

  var STATE = { MENU: 0, STORY: 1, PLAY: 2, RESULT: 3, OVER: 4, ENDING: 5 };
  var COVER_MAX = 3;

  var game = {
    state: STATE.MENU,
    chapterIdx: 0,
    scene: null,
    marks: [],
    spawnIdx: 0,
    frame: 0,
    timeLeft: 0,
    killed: 0,
    targetsTotal: 0,
    cover: COVER_MAX,
    civHits: 0,
    shots: 0,
    score: 0,
    hi: 0,
    camY: 0,               // no scrolling; kept so the ported scope math works
    snipe: null,           // active OKB sniper-kill animation
    story: null,           // { lines, idx, next }
    msg: "",
    msgTimer: 0,
    msgColor: "#fff"
  };

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function smooth(u) { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); }
  function snd(name) { if (global.Sound) global.Sound.play(name); }

  try { game.hi = parseInt(localStorage.getItem("okb_hi"), 10) || 0; } catch (e) {}

  // ---- Boot ---------------------------------------------------------------

  function init() {
    Input.bindPointer(canvas);
    var st = document.getElementById("sound-toggle");
    if (st) st.addEventListener("click", toggleSound);
    window.addEventListener("keydown", function (e) {
      if (e.code === "KeyM") { e.preventDefault(); toggleSound(); }
    });
    showMenu();
    syncHud();
    requestAnimationFrame(tick);
  }

  function toggleSound() {
    if (!global.Sound) return;
    var next = !global.Sound.isMuted();
    global.Sound.setMuted(next);
    global.Sound.resume();
    var st = document.getElementById("sound-toggle");
    if (st) st.textContent = next ? "🔇" : "🔊";
  }

  // ---- Overlays -----------------------------------------------------------

  function hideOverlay() { overlay.classList.add("hidden"); }
  function showOverlayHTML(cls, html) {
    overlay.className = "overlay " + (cls || "");
    overlay.innerHTML = html;
    overlay.classList.remove("hidden");
  }

  function showMenu() {
    game.state = STATE.MENU;
    if (global.Sound) global.Sound.stopMusic();
    showOverlayHTML("menu",
      '<h1>OKB</h1>' +
      '<p class="subtitle">' + STORY.subtitle + '</p>' +
      '<p class="lede">標的だけを狙撃する、ストーリー型スナイパー。<br>' +
      '画面をタップ／クリックで照準を合わせて撃つ。赤い標的だけを、確実に。</p>' +
      '<ul class="controls">' +
      '<li>🖱 / 👆 <b>照準＆射撃</b></li>' +
      '<li>🎯 赤い腕章＝<b>標的</b>（撃つ）</li>' +
      '<li>🚶 それ以外＝<b>市民・護衛</b>（撃つな）</li>' +
      '</ul>' +
      '<button id="start-btn">START</button>');
    var b = document.getElementById("start-btn");
    b.addEventListener("click", function () { snd("ui"); if (global.Sound) global.Sound.resume(); startGame(); });
  }

  function startGame() {
    game.score = 0;
    game.chapterIdx = 0;
    beginStory("prologue", STORY.prologue, function () { beginChapter(0); });
  }

  // ---- Story flow ---------------------------------------------------------

  function beginStory(kind, lines, next) {
    game.state = STATE.STORY;
    if (global.Sound) global.Sound.stopMusic();
    game.story = { kind: kind, lines: lines, idx: 0, next: next };
    renderStory();
  }

  function renderStory() {
    var s = game.story;
    var chap = STORY.chapters[game.chapterIdx];
    var heading = s.kind === "prologue" ? "PROLOGUE"
      : s.kind === "ending" ? "ENDING"
      : (chap ? chap.title : "");
    var body = "";
    for (var i = 0; i <= s.idx; i++) {
      var cur = i === s.idx;
      body += '<p class="line' + (cur ? " cur" : "") + '">' + s.lines[i] + '</p>';
    }
    var more = s.idx < s.lines.length - 1;
    showOverlayHTML("story",
      '<h2 class="chapter">' + heading + '</h2>' +
      '<div class="story-body">' + body + '</div>' +
      '<p class="advance">▼ ' + (more ? "タップで次へ" : "タップで開始") + '</p>');
    // Advance on click anywhere in the overlay.
    overlay.onclick = advanceStory;
  }

  function advanceStory() {
    if (game.state !== STATE.STORY) return;
    var s = game.story;
    snd("ui");
    if (s.idx < s.lines.length - 1) { s.idx++; renderStory(); }
    else { overlay.onclick = null; s.next(); }
  }

  function beginChapter(i) {
    game.chapterIdx = i;
    if (i >= STORY.chapters.length) { beginEnding(); return; }
    var chap = STORY.chapters[i];
    beginStory("brief", chap.brief, startMission);
  }

  function beginEnding() {
    beginStory("ending", STORY.ending, function () {
      snd("win");
      showOverlayHTML("result win",
        '<h1>ALL CLEAR</h1>' +
        '<p class="subtitle">全ての契約を遂行した。</p>' +
        '<p class="lede">最終スコア <b>' + game.score + '</b> ／ HI <b>' + game.hi + '</b></p>' +
        '<button id="start-btn">TITLE へ</button>');
      game.state = STATE.ENDING;
      document.getElementById("start-btn").addEventListener("click", function () { snd("ui"); showMenu(); });
    });
  }

  // ---- Mission ------------------------------------------------------------

  function startMission() {
    var chap = STORY.chapters[game.chapterIdx];
    game.scene = SCENES.get(chap.scene);
    game.targetsTotal = game.scene.targetsTotal;
    game.marks = [];
    game.spawnIdx = 0;
    game.frame = 0;
    game.timeLeft = game.scene.timeLimit;
    game.killed = 0;
    game.cover = COVER_MAX;
    game.civHits = 0;
    game.shots = 0;
    game.snipe = null;
    game.msgTimer = 0;
    // Drain any taps queued while the overlay was up.
    while (Input.takeFire()) {}
    hideOverlay();
    overlay.onclick = null;
    game.state = STATE.PLAY;
    if (global.Sound) { global.Sound.resume(); global.Sound.startMusic(); }
    flash("MISSION START", "#ffd166");
    syncHud();
  }

  function spawnDue() {
    var sp = game.scene.spawns;
    while (game.spawnIdx < sp.length && game.frame >= sp[game.spawnIdx].t) {
      var e = sp[game.spawnIdx++];
      var x = e.dir > 0 ? -20 : SCENES.W + 4;
      game.marks.push(new Entities.Mark({
        x: x, y: game.scene.ground, dir: e.dir, speed: e.speed,
        type: e.type, palette: e.palette
      }));
    }
  }

  function updateMarks() {
    var live = [];
    for (var i = 0; i < game.marks.length; i++) {
      var m = game.marks[i];
      if (m.dead) continue;
      m.update();
      var off = m.x < -30 || m.x > SCENES.W + 30;
      if (off) {
        if (m.type === "target") { targetEscaped(); return; }
        continue;   // civilian left the scene harmlessly
      }
      live.push(m);
    }
    game.marks = live;
  }

  function targetEscaped() {
    game.cover--;
    snd("escape");
    flash("標的を逃した！", "#ff5a5a");
    syncHud();
    missionFail("標的を取り逃がした");
  }

  function missionClear() {
    if (global.Sound) global.Sound.stopMusic();
    snd("clear");
    var accuracy = game.shots > 0 ? Math.round((game.killed / game.shots) * 100) : 100;
    var bonus = game.cover * 500 + Math.max(0, Math.floor(game.timeLeft / 60)) * 20;
    game.score += bonus;
    commitHi();
    game.state = STATE.RESULT;
    var chap = STORY.chapters[game.chapterIdx];
    showOverlayHTML("result win",
      '<h1>MISSION CLEAR</h1>' +
      '<p class="subtitle">' + chap.title + '</p>' +
      '<ul class="stats">' +
      '<li>命中率 <b>' + accuracy + '%</b></li>' +
      '<li>残カバー <b>' + game.cover + '</b> ＝ +' + (game.cover * 500) + '</li>' +
      '<li>残り時間ボーナス <b>+' + (Math.max(0, Math.floor(game.timeLeft / 60)) * 20) + '</b></li>' +
      '<li>SCORE <b>' + game.score + '</b></li>' +
      '</ul>' +
      '<button id="next-btn">次へ</button>');
    document.getElementById("next-btn").addEventListener("click", function () {
      snd("ui");
      beginStory("outro", chap.outro, function () { beginChapter(game.chapterIdx + 1); });
    });
  }

  function missionFail(reason) {
    if (global.Sound) global.Sound.stopMusic();
    snd("over");
    commitHi();
    game.state = STATE.OVER;
    showOverlayHTML("result over",
      '<h1>MISSION FAILED</h1>' +
      '<p class="subtitle">' + (reason || "契約は破談となった") + '</p>' +
      '<p class="lede">SCORE ' + game.score + ' ／ HI ' + game.hi + '</p>' +
      '<div class="over-btns">' +
      '<button id="retry-btn">このミッションを再開</button>' +
      '<button id="title-btn" class="secondary">TITLE</button>' +
      '</div>');
    document.getElementById("retry-btn").addEventListener("click", function () { snd("ui"); startMission(); });
    document.getElementById("title-btn").addEventListener("click", function () { snd("ui"); showMenu(); });
  }

  function commitHi() {
    if (game.score > game.hi) {
      game.hi = game.score;
      try { localStorage.setItem("okb_hi", String(game.hi)); } catch (e) {}
    }
  }

  function addScore(n) { game.score += n; commitHi(); syncHud(); }

  function flash(msg, color) { game.msg = msg; game.msgColor = color || "#fff"; game.msgTimer = 70; }

  // ---- Firing / the OKB sniper sequence -----------------------------------

  // Frame budgets for each phase (~3s + a ~0.75s afterglow at 60fps).
  var SNIPE = { zoom: 54, aim: 44, guilty: 62, fire: 20, after: 46 };

  function handleFire(p) {
    if (game.state !== STATE.PLAY || game.snipe) return;
    game.shots++;
    // Topmost mark under the tap wins.
    for (var i = game.marks.length - 1; i >= 0; i--) {
      var m = game.marks[i];
      if (!m.dead && m.hit(p.x, p.y)) {
        if (m.type === "target") {
          game.snipe = { mark: m, phase: "zoom", t: 0 };
          snd("lock");
        } else {
          misfire(m);
        }
        return;
      }
    }
    // A shot into empty air still counts against accuracy.
  }

  function misfire(m) {
    game.cover--;
    game.civHits++;
    snd("wrong");
    flash("誤射！ 民間人を撃った", "#ff5a5a");
    syncHud();
    if (game.cover <= 0) missionFail("民間人を撃ってしまった");
  }

  function updateSnipe() {
    var s = game.snipe;
    s.t++;
    if (s.phase === "zoom" && s.t >= SNIPE.zoom) {
      s.phase = "aim"; s.t = 0; snd("lock");
    } else if (s.phase === "aim" && s.t >= SNIPE.aim) {
      s.phase = "guilty"; s.t = 0; snd("guilty");
    } else if (s.phase === "guilty" && s.t >= SNIPE.guilty) {
      s.phase = "fire"; s.t = 0; snd("snipe");
    } else if (s.phase === "fire" && s.t >= SNIPE.fire) {
      s.mark.dead = true;
      game.marks = game.marks.filter(function (x) { return !x.dead; });
      game.killed++;
      addScore(1500);
      snd("explode");
      s.phase = "after"; s.t = 0;
    } else if (s.phase === "after" && s.t >= SNIPE.after) {
      game.snipe = null;
      if (game.killed >= game.targetsTotal) missionClear();
    }
  }

  // ---- Update / tick ------------------------------------------------------

  function tick() {
    update();
    draw();
    Input.endFrame();
    requestAnimationFrame(tick);
  }

  function update() {
    if (game.msgTimer > 0) game.msgTimer--;

    if (game.state === STATE.STORY) {
      if (Input.pressed("start")) advanceStory();
      return;
    }
    if (game.state !== STATE.PLAY) return;

    // The world freezes during the sniper-kill sequence.
    if (game.snipe) { updateSnipe(); return; }

    game.frame++;
    game.timeLeft--;
    spawnDue();
    updateMarks();
    if (game.state !== STATE.PLAY) return;   // a fail may have fired above

    var tap = Input.takeFire();
    if (tap) handleFire(tap);

    if (game.timeLeft <= 0 && game.killed < game.targetsTotal) {
      missionFail("時間切れ");
    }
    syncHud();
  }

  // ---- Draw ---------------------------------------------------------------

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (game.state === STATE.MENU || game.state === STATE.STORY ||
        game.state === STATE.RESULT || game.state === STATE.OVER ||
        game.state === STATE.ENDING) {
      // Draw the last scene faintly behind story/result overlays for mood.
      if (game.scene) { ctx.globalAlpha = 0.5; game.scene.drawBg(ctx); ctx.globalAlpha = 1; }
      return;
    }

    ctx.save();
    // During a snipe, zoom the whole world in on the target for extra drama.
    var sn = game.snipe;
    if (sn && sn.phase !== "guilty") {
      var z = snipeZoom(sn);
      var zx = sn.mark.x + sn.mark.w / 2;
      var zy = sn.mark.y + 8;
      var shake = sn.phase === "fire" ? (Math.random() - 0.5) * 6 : 0;
      ctx.translate(zx + shake, zy + shake);
      ctx.scale(z, z);
      ctx.translate(-zx, -zy);
    }

    game.scene.drawBg(ctx);
    for (var i = 0; i < game.marks.length; i++) game.marks[i].draw(ctx);
    ctx.restore();

    // Reticle (screen space), hidden while a snipe cinematic runs.
    if (!sn) drawReticle();

    if (sn) {
      if (sn.phase === "guilty") drawGuiltyCut(sn.t);
      else if (sn.phase === "after") drawAfterglow(sn);
      else drawScope(sn);
    }
    drawCoverBar();
    if (game.msgTimer > 0) drawFlash();
  }

  function drawReticle() {
    var a = Input.aim();
    if (!a.inside) return;
    var x = a.x, y = a.y;
    // Colour the reticle red when it's over a valid target.
    var onTarget = false;
    for (var i = 0; i < game.marks.length; i++) {
      var m = game.marks[i];
      if (m.type === "target" && !m.dead && m.hit(x, y)) { onTarget = true; break; }
    }
    ctx.save();
    ctx.strokeStyle = onTarget ? "rgba(255,70,70,0.95)" : "rgba(230,236,245,0.8)";
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, 13, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 20, y); ctx.lineTo(x - 6, y);
    ctx.moveTo(x + 6, y); ctx.lineTo(x + 20, y);
    ctx.moveTo(x, y - 20); ctx.lineTo(x, y - 6);
    ctx.moveTo(x, y + 6); ctx.lineTo(x, y + 20);
    ctx.stroke();
    ctx.fillStyle = onTarget ? "rgba(255,70,70,0.95)" : "rgba(230,236,245,0.9)";
    ctx.fillRect(x - 1, y - 1, 2, 2);
    ctx.restore();
  }

  function drawCoverBar() {
    ctx.save();
    for (var i = 0; i < COVER_MAX; i++) {
      ctx.fillStyle = i < game.cover ? "#4fd28a" : "rgba(120,130,140,0.35)";
      ctx.fillRect(10 + i * 16, canvas.height - 18, 12, 8);
    }
    ctx.restore();
  }

  function drawFlash() {
    var a = Math.min(1, game.msgTimer / 45);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = game.msgColor;
    ctx.font = "bold 22px 'Courier New', monospace";
    ctx.textAlign = "center";
    ctx.fillText(game.msg, canvas.width / 2, 64);
    ctx.restore();
    ctx.textAlign = "left";
  }

  function snipeZoom(s) {
    var Z = 2.7;
    if (s.phase === "zoom") return 1 + (Z - 1) * smooth(s.t / SNIPE.zoom);
    if (s.phase === "after") return 1 + (Z - 1) * (1 - smooth(s.t / SNIPE.after)); // pull back
    return Z;                              // aim / fire hold zoomed in
  }

  /** Dramatic OKB sniper scope, drawn in screen space over the frozen world. */
  function drawScope(s) {
    var W = canvas.width, H = canvas.height;
    var e = s.mark;
    var tx = e.x + e.w / 2;
    var ty = e.y + 8;                          // aim at the head
    var sway = s.phase === "aim" ? 2.5 : 0;    // slow breathing sway
    tx += Math.sin(s.t / 9) * sway;
    ty += Math.cos(s.t / 11) * sway;

    var full = Math.max(W, H) * 1.15, rMin = 96;
    var r = s.phase === "zoom"
      ? full - (full - rMin) * smooth(s.t / SNIPE.zoom)
      : rMin;

    ctx.save();
    if (s.phase === "zoom" || s.phase === "aim") {
      ctx.fillStyle = "rgba(50,90,170,0.12)";
      ctx.fillRect(0, 0, W, H);
    }
    // Dark vignette with a circular hole punched at the target.
    ctx.fillStyle = "rgba(2,3,8,0.93)";
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.arc(tx, ty, r, 0, Math.PI * 2, true);
    ctx.fill("evenodd");
    ctx.lineWidth = 12; ctx.strokeStyle = "#04050a";
    ctx.beginPath(); ctx.arc(tx, ty, r, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 2; ctx.strokeStyle = "#2a3350";
    ctx.beginPath(); ctx.arc(tx, ty, r - 6, 0, Math.PI * 2); ctx.stroke();

    ctx.save();
    ctx.beginPath(); ctx.arc(tx, ty, r - 6, 0, Math.PI * 2); ctx.clip();
    ctx.strokeStyle = "rgba(235,70,70,0.85)"; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(tx - r, ty); ctx.lineTo(tx + r, ty);
    ctx.moveTo(tx, ty - r); ctx.lineTo(tx, ty + r);
    ctx.stroke();
    for (var k = -6; k <= 6; k++) {
      if (!k) continue;
      ctx.beginPath();
      ctx.moveTo(tx + k * 10, ty - 3); ctx.lineTo(tx + k * 10, ty + 3);
      ctx.moveTo(tx - 3, ty + k * 10); ctx.lineTo(tx + 3, ty + k * 10);
      ctx.stroke();
    }
    if (s.phase === "aim") {
      var pr = 26 + (Math.sin(s.t / 5) + 1) * 8;
      ctx.strokeStyle = "rgba(255,80,80,0.7)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(tx, ty, pr, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.fillStyle = "rgba(255,50,50,0.95)"; ctx.fillRect(tx - 2, ty - 2, 4, 4);
    ctx.restore();

    ctx.textAlign = "center";
    if (s.phase === "zoom" || s.phase === "aim") {
      ctx.fillStyle = "#ff6a6a"; ctx.font = "bold 13px 'Courier New', monospace";
      ctx.fillText("O K B", tx, ty - r + 22);
      ctx.fillStyle = "rgba(180,200,230,0.7)"; ctx.font = "11px 'Courier New', monospace";
      ctx.fillText("RANGE 1200m  WIND 3", tx, ty + r - 14);
      if (s.phase === "aim" && Math.floor(s.t / 8) % 2 === 0) {
        ctx.fillStyle = "#ffd166"; ctx.font = "bold 16px 'Courier New', monospace";
        ctx.fillText("TARGET LOCKED", W / 2, H - 30);
      }
    }
    if (s.phase === "fire") {
      var a = 1 - s.t / SNIPE.fire;
      ctx.fillStyle = "rgba(255,255,255," + (a * 0.95) + ")"; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#ff2a2a";
      for (var b = 0; b < 12; b++) {
        var ang = b * Math.PI / 6, len = 6 + s.t * 3;
        ctx.fillRect(tx + Math.cos(ang) * len - 2, ty + Math.sin(ang) * len - 2, 5, 5);
      }
      ctx.fillStyle = "#fff"; ctx.font = "bold 24px 'Courier New', monospace";
      ctx.fillText("HEADSHOT!", W / 2, 54);
    }
    ctx.textAlign = "left";
    ctx.restore();
  }

  /** Lingering aftermath after the shot: fading vignette + slow-mo pull-back. */
  function drawAfterglow(s) {
    var W = canvas.width, H = canvas.height;
    var u = clamp(s.t / SNIPE.after, 0, 1);
    var fade = 1 - smooth(u);
    ctx.save();
    ctx.fillStyle = "rgba(50,90,170," + (0.10 * fade) + ")"; ctx.fillRect(0, 0, W, H);
    var g = ctx.createRadialGradient(W / 2, H / 2, 70, W / 2, H / 2, W * 0.85);
    g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0," + (0.5 * fade) + ")");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    if (u < 0.85) {
      ctx.globalAlpha = clamp(1 - u / 0.85, 0, 1);
      ctx.fillStyle = "#ff5a5a"; ctx.font = "bold 22px 'Courier New', monospace";
      ctx.textAlign = "center"; ctx.fillText("TARGET DOWN", W / 2, 58);
      ctx.globalAlpha = 1; ctx.textAlign = "left";
    }
    ctx.restore();
  }

  // ---- GUILTY cut (ported verbatim from the Elevator Action engine) -------
  // A 1-second gekiga-style cut: a stern OKB sniper in high-contrast ink with
  // focus lines and a jagged "有罪（ギルティ）" speech burst, just before the shot.

  function drawGuiltyCut(t) {
    var W = canvas.width, H = canvas.height;
    var intro = clamp(t / 9, 0, 1);
    var shake = t < 9 ? (1 - intro) * 7 : 0;

    ctx.save();
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    var zc = 1 + (1 - smooth(intro)) * 0.08;
    ctx.translate(W / 2, H / 2); ctx.scale(zc, zc); ctx.translate(-W / 2, -H / 2);

    // Sky.
    ctx.fillStyle = "#cbd1db"; ctx.fillRect(-30, -30, W + 60, H + 60);
    ctx.fillStyle = "#3c414d";
    inkCloud(60, 54, 150, 40); inkCloud(280, 38, 180, 52); inkCloud(470, 96, 150, 46);
    hatch(0, 0, W, 150, 7, -1, "rgba(20,22,28,0.30)");
    ctx.strokeStyle = "rgba(20,22,28,0.18)"; ctx.lineWidth = 1;
    for (var a = 0; a < 22; a++) {
      var yy0 = 150 + a * 16;
      ctx.beginPath(); ctx.moveTo(W, 250); ctx.lineTo(-20, yy0); ctx.stroke();
    }
    // City skyline.
    ctx.fillStyle = "#242932";
    var bx = [-10, 40, 78, 120, 150, 196, 250, 300, 470, 500];
    var bh = [120, 165, 96, 140, 80, 130, 100, 150, 90, 130];
    for (var c = 0; c < bx.length; c++) ctx.fillRect(bx[c], 372 - bh[c], (bx[c + 1] || W) - bx[c] - 4, bh[c] + 20);
    drawTowerCut(430, 214, 372);
    ctx.fillStyle = "rgba(200,208,220,0.5)";
    for (var wy = 262; wy < 366; wy += 10) for (var wx = 20; wx < 320; wx += 12)
      if ((wx + wy) % 3 === 0) ctx.fillRect(wx, wy, 3, 4);
    // Parapet.
    ctx.fillStyle = "#b3b9c4"; ctx.fillRect(-20, 366, W + 40, H - 360);
    ctx.fillStyle = "#8b929e"; ctx.fillRect(-20, 366, W + 40, 5);
    ctx.strokeStyle = "#7c8390"; ctx.lineWidth = 2;
    for (var sx = 26; sx < W; sx += 74) { ctx.beginPath(); ctx.moveTo(sx, 372); ctx.lineTo(sx, H); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(0, 420); ctx.lineTo(W, 420); ctx.stroke();
    hatch(0, 366, W, H - 366, 8, 1, "rgba(60,66,76,0.22)");
    // Rifle + sniper.
    drawSniperRifle();
    drawSniperHead(t);
    // Speech bubble.
    if (t > 10) drawGuiltyBubble(W - 92, 92, smooth(clamp((t - 10) / 8, 0, 1)));
    // Entry flash.
    if (t < 6) { ctx.fillStyle = "rgba(255,255,255," + (1 - t / 6) * 0.55 + ")"; ctx.fillRect(-30, -30, W + 60, H + 60); }
    // Corner caption.
    ctx.fillStyle = "rgba(10,11,14,0.82)"; ctx.fillRect(0, H - 24, 132, 24);
    ctx.fillStyle = "#e6e9ef"; ctx.font = "bold 12px 'Courier New', monospace";
    ctx.textAlign = "left"; ctx.fillText("OKB   NO MISS", 8, H - 8);
    ctx.restore();
  }

  function inkCloud(x, y, w, h) {
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.bezierCurveTo(x - w * 0.3, y + h * 0.2, x + w * 0.2, y - h, x + w * 0.5, y);
    ctx.bezierCurveTo(x + w * 0.8, y - h * 0.9, x + w * 1.4, y + h * 0.4, x + w, y + h);
    ctx.closePath(); ctx.fill();
  }

  function hatch(x, y, w, h, gap, dir, color) {
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.strokeStyle = color; ctx.lineWidth = 1;
    for (var i = -h; i < w + h; i += gap) {
      ctx.beginPath();
      ctx.moveTo(x + i, y); ctx.lineTo(x + i + dir * h, y + h); ctx.stroke();
    }
    ctx.restore();
  }

  function drawTowerCut(cx, top, base) {
    ctx.strokeStyle = "#20242c"; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, top); ctx.lineTo(cx - 34, base);
    ctx.moveTo(cx, top); ctx.lineTo(cx + 34, base);
    ctx.stroke();
    ctx.lineWidth = 2;
    for (var i = 1; i < 6; i++) {
      var y = top + (base - top) * (i / 6), wte = 6 + i * 5;
      ctx.beginPath(); ctx.moveTo(cx - wte, y); ctx.lineTo(cx + wte, y); ctx.stroke();
    }
    ctx.fillStyle = "#20242c"; ctx.fillRect(cx - 3, top - 22, 6, 24);
  }

  function drawSniperRifle() {
    ctx.fillStyle = "#14161c"; ctx.fillRect(300, 244, 168, 11);
    ctx.fillStyle = "#3a404c"; ctx.fillRect(300, 245, 168, 2);
    ctx.fillStyle = "#0c0e13"; ctx.fillRect(452, 238, 36, 22);
    ctx.fillStyle = "#cbd1db";
    for (var m = 0; m < 3; m++) ctx.fillRect(458 + m * 10, 240, 3, 18);
    ctx.fillStyle = "#1b1f27"; ctx.fillRect(300, 234, 130, 30);
    ctx.fillStyle = "#cbd1db";
    for (var hgx = 312; hgx < 424; hgx += 18) { ctx.beginPath(); ctx.arc(hgx, 249, 5, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = "#1b1f27";
    for (var hgx2 = 312; hgx2 < 424; hgx2 += 18) { ctx.beginPath(); ctx.arc(hgx2, 249, 2.4, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = "#1c212b"; ctx.fillRect(168, 236, 138, 46);
    ctx.fillStyle = "#0e1116"; ctx.fillRect(168, 236, 138, 4);
    ctx.fillStyle = "#12151b"; ctx.fillRect(214, 214, 96, 16);
    ctx.beginPath(); ctx.arc(214, 222, 12, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(312, 222, 13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#3a404c"; ctx.fillRect(214, 216, 96, 2);
    ctx.fillStyle = "#0e1116"; ctx.fillRect(238, 208, 10, 22); ctx.fillRect(276, 208, 10, 22);
    ctx.fillStyle = "#5b93b8"; ctx.beginPath(); ctx.arc(312, 222, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#161a22"; ctx.fillRect(196, 282, 34, 46);
    ctx.strokeStyle = "#0e1116"; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(360, 258); ctx.lineTo(338, 372); ctx.moveTo(360, 258); ctx.lineTo(392, 372); ctx.stroke();
    ctx.lineWidth = 3; ctx.strokeStyle = "#3a404c";
    ctx.beginPath(); ctx.moveTo(360, 258); ctx.lineTo(392, 372); ctx.stroke();
    ctx.fillStyle = "#161a22"; ctx.fillRect(120, 244, 52, 30);
  }

  function drawSniperHead(t) {
    var H = canvas.height;
    ctx.fillStyle = "#0e1015";
    ctx.beginPath();
    ctx.moveTo(0, H); ctx.lineTo(0, 300); ctx.lineTo(70, 262);
    ctx.lineTo(150, 300); ctx.lineTo(210, 300); ctx.lineTo(230, H); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#dee2e9";
    ctx.beginPath();
    ctx.moveTo(64, 300); ctx.lineTo(150, 300); ctx.lineTo(196, 250);
    ctx.lineTo(196, 236); ctx.lineTo(120, 208); ctx.lineTo(70, 232); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#e7ebf1";
    ctx.beginPath();
    ctx.moveTo(70, 232);
    ctx.lineTo(150, 214);
    ctx.quadraticCurveTo(206, 214, 208, 236);
    ctx.lineTo(214, 252);
    ctx.lineTo(196, 258);
    ctx.lineTo(196, 286);
    ctx.lineTo(150, 300);
    ctx.lineTo(96, 288);
    ctx.closePath(); ctx.fill();
    hatch(120, 250, 90, 52, 6, 1, "rgba(90,98,112,0.5)");
    ctx.fillStyle = "#14161c";
    ctx.fillRect(150, 236, 44, 5);
    ctx.beginPath(); ctx.moveTo(168, 246); ctx.lineTo(190, 244);
    ctx.lineTo(190, 251); ctx.lineTo(168, 252); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#c9d0da"; ctx.fillRect(180, 246, 4, 3);
    ctx.strokeStyle = "#3a404c"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(168, 276); ctx.lineTo(192, 272); ctx.stroke();
    ctx.fillStyle = "#eef1f6";
    ctx.beginPath();
    ctx.moveTo(58, 250);
    ctx.quadraticCurveTo(20, 150, 120, 150);
    ctx.quadraticCurveTo(178, 150, 172, 210);
    ctx.lineTo(150, 214); ctx.quadraticCurveTo(120, 196, 84, 214);
    ctx.lineTo(70, 232); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#aeb5c1"; ctx.lineWidth = 1.5;
    for (var s = 0; s < 8; s++) {
      ctx.beginPath();
      ctx.moveTo(60 + s * 13, 156 + (s % 2) * 6);
      ctx.quadraticCurveTo(70 + s * 12, 190, 78 + s * 12, 220);
      ctx.stroke();
    }
    ctx.fillStyle = "#14161c";
    ctx.beginPath(); ctx.arc(186, 300, 20, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(300, 300, 18, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#2a2f3a"; ctx.fillRect(292, 268, 16, 34);
  }

  function drawGuiltyBubble(cx, cy, sc) {
    if (sc <= 0) return;
    ctx.save();
    ctx.translate(cx, cy); ctx.scale(sc, sc);
    ctx.beginPath();
    ctx.ellipse(0, 0, 76, 58, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#f6f7fa"; ctx.fill();
    ctx.lineWidth = 3.5; ctx.strokeStyle = "#111"; ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-40, 34); ctx.lineTo(-92, 96); ctx.lineTo(-20, 44); ctx.closePath();
    ctx.fillStyle = "#f6f7fa"; ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#111"; ctx.textAlign = "center";
    ctx.font = "bold 34px 'Yu Mincho','Hiragino Mincho ProN',serif";
    ctx.fillText("有罪", 0, -2);
    ctx.font = "bold 15px 'Hiragino Kaku Gothic ProN',sans-serif";
    ctx.fillText("（ギルティ）", 0, 30);
    ctx.textAlign = "left";
    ctx.restore();
  }

  // ---- HUD ----------------------------------------------------------------

  function syncHud() {
    if (hud.mission) hud.mission.textContent = (game.chapterIdx + 1);
    if (hud.score) hud.score.textContent = game.score;
    if (hud.hi) hud.hi.textContent = game.hi;
    if (hud.targets) hud.targets.textContent = game.killed;
    if (hud.targetsTotal) hud.targetsTotal.textContent = game.targetsTotal;
    if (hud.cover) hud.cover.textContent = Math.max(0, game.cover);
    if (hud.time) hud.time.textContent = Math.max(0, Math.ceil(game.timeLeft / 60));
  }

  global.__OKB = game; // expose for debugging

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(window);
