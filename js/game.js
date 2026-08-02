/**
 * Main game loop and state machine for OKB — an escort-sniper shooter.
 *
 * The player is a sniper on the roofs. An ESCORT (the previous game's
 * protagonist) walks each stage autonomously toward the exit; the player taps
 * ENEMIES to remove them before they can harm the escort. Between stages,
 * Ninja Gaiden-style cutscenes (cutscene.js) tell the story.
 *
 * Reused from the Elevator Action engine: the state-machine + single tick()
 * loop, the synthesized Sound, the AABB hit-test, and the OKB sniper cinematic
 * (drawScope / drawGuiltyCut). Unlike the original, a normal kill does NOT
 * freeze the world (you must keep protecting). You aim through a magnifying
 * scope and fire with a dedicated trigger; the bolt is re-chambered by a manual
 * RELOAD. The full "GUILTY" freeze is reserved for boss / traitor finishers.
 */
(function (global) {
  "use strict";

  var SCENES = global.OKB_SCENE;
  var STORY = global.OKB_STORY;
  var CUT = global.OKB_CUTSCENE;
  var Entities = global.Entities;
  var Input = global.Input;

  var canvas = document.getElementById("game");
  var ctx = canvas.getContext("2d");
  var overlay = document.getElementById("overlay");

  var hud = {
    mission: document.getElementById("hud-mission"),
    score: document.getElementById("hud-score"),
    hi: document.getElementById("hud-hi"),
    hp: document.getElementById("hud-hp"),
    hpMax: document.getElementById("hud-hp-max"),
    dist: document.getElementById("hud-dist"),
    note: document.getElementById("hud-note")
  };

  var STATE = { MENU: 0, CUTSCENE: 1, PLAY: 2, RESULT: 3, OVER: 4, ENDING: 5 };
  var RELOAD_TIME = 30;    // manual bolt re-chamber (~0.5s) after pressing RELOAD
  var VIEW_W = SCENES.VIEW || 512;   // the visible slice of the scrolling world
  // Scoped-sniper view: enemies read as distant in the hip view; you pinch-in
  // (double-click) to look through the scope, where the world is magnified.
  var HIP_ACTOR = 0.62;    // actors drawn small in the hip view (feel far)
  var SCOPE_Z = 3.0;       // scope magnification
  var SCOPE_R = 152;       // scope lens radius (screen px)

  var game = {
    state: STATE.MENU,
    chapterIdx: 0,
    scene: null,
    mode: "escort",        // "escort" | "hunt"
    escort: null,
    traitor: null,         // hunt-stage target
    enemies: [],
    spawnIdx: 0,
    frame: 0,
    loaded: true,          // is a round chambered? (fire empties it; RELOAD refills)
    reloadTimer: 0,        // >0 while re-chambering
    killed: 0,
    shots: 0,
    misfires: 0,           // run-wide friendly-fire count (3 = game over; carries to finale)
    bonusSpawns: [],       // extra enemy spawn times added by misfires
    score: 0,
    hi: 0,
    worldW: VIEW_W,        // stage world width (>= VIEW_W)
    camX: 0,               // horizontal camera scroll (world -> screen)
    camY: 0,               // kept so the ported scope math reads cleanly
    cut: null,             // active cutscene controller
    cutNext: null,         // what to do when the cutscene finishes
    finisher: null,        // GUILTY sequence (freezes the world)
    scoped: false,         // looking through the scope (can fire; camera frozen)
    hintTimer: 0,          // "look through the scope" nudge
    effects: [],           // hit sparks
    tracers: [],           // enemy fire lines
    shotFlash: 0,
    msg: "", msgTimer: 0, msgColor: "#fff"
  };

  // Convert a screen-space tap to world space (camera only scrolls in x).
  function toWorld(p) { return { x: p.x + game.camX, y: p.y }; }
  // Follow a subject with a clamped, eased horizontal camera.
  function updateCamera(subject) {
    var target = subject.x + subject.w / 2 - VIEW_W / 2;
    var maxX = Math.max(0, game.worldW - VIEW_W);
    target = clamp(target, 0, maxX);
    game.camX += (target - game.camX) * 0.12;
    game.camX = clamp(game.camX, 0, maxX);
  }

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function smooth(u) { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); }
  function snd(name) { if (global.Sound) global.Sound.play(name); }

  try { game.hi = parseInt(localStorage.getItem("okb_hi"), 10) || 0; } catch (e) {}

  // ---- Boot ---------------------------------------------------------------

  function init() {
    Input.bindPointer(canvas);
    Input.bindButtons({ "btn-shot": "shot", "btn-reload": "reload" });
    var st = document.getElementById("sound-toggle");
    if (st) st.addEventListener("click", toggleSound);
    window.addEventListener("keydown", function (e) {
      if (e.code === "KeyM") { e.preventDefault(); toggleSound(); }
    });
    // A tap during a cutscene advances it.
    canvas.addEventListener("pointerdown", function () {
      if (game.state === STATE.CUTSCENE && game.cut) { game.cut.advance(); }
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

  function hideOverlay() { overlay.classList.add("hidden"); overlay.onclick = null; }
  function showOverlayHTML(cls, html) {
    overlay.className = "overlay " + (cls || "");
    overlay.innerHTML = html;
    overlay.classList.remove("hidden");
  }

  function showMenu() {
    game.state = STATE.MENU;
    game.scene = null;
    if (global.Sound) global.Sound.stopMusic();
    showOverlayHTML("menu",
      '<h1>OKB</h1>' +
      '<p class="subtitle">' + STORY.subtitle + '</p>' +
      '<p class="lede">あなたは屋上のスナイパー。敵は<b>遠く</b>にいる。<br>' +
      '護衛対象（前作の主人公）が自ら出口へ歩く。<br>' +
      '狙う敵を<b>スコープで拡大</b>し、照準を合わせて撃て。</p>' +
      '<ul class="controls">' +
      '<li>🔭 <b>ダブルクリック / ピンチイン</b>でスコープ（照準はドラッグ）</li>' +
      '<li>🔫 <b>SHOT</b>ボタン / Space・F で発砲（照準はズレない）</li>' +
      '<li>🔄 <b>RELOAD</b>ボタン / R で再装填（＝スコープ解除・手動）</li>' +
      '<li>🟥 <b>敵</b>（撃つ）｜ 🟦 <b>護衛対象</b>（守る・撃つな）</li>' +
      '<li>⚠ <b>誤射3回で失敗</b>。誤射のたび護衛は遅くなり敵も増える</li>' +
      '</ul>' +
      '<button id="start-btn">START</button>');
    document.getElementById("start-btn").addEventListener("click", function () {
      snd("ui"); if (global.Sound) global.Sound.resume(); startGame();
    });
  }

  function startGame() {
    game.score = 0;
    game.misfires = 0;
    game.chapterIdx = 0;
    beginCut(STORY.prologue, function () { beginChapter(0); });
  }

  // ---- Cutscenes ----------------------------------------------------------

  function beginCut(script, next) {
    if (global.Sound) global.Sound.stopMusic();
    game.cut = CUT.make(script);
    game.cutNext = next;
    game.state = STATE.CUTSCENE;
    hideOverlay();
  }

  function beginChapter(i) {
    game.chapterIdx = i;
    if (i >= STORY.chapters.length) { beginEnding(); return; }
    beginCut(STORY.chapters[i].intro, startMission);
  }

  function beginEnding() {
    beginCut(STORY.ending, function () {
      snd("win");
      showOverlayHTML("result win",
        '<h1>ALL CLEAR</h1>' +
        '<p class="subtitle">護衛対象は無事に脱出した。</p>' +
        '<p class="lede">最終スコア <b>' + game.score + '</b> ／ HI <b>' + game.hi + '</b></p>' +
        '<button id="start-btn">TITLE へ</button>');
      game.state = STATE.ENDING;
      document.getElementById("start-btn").addEventListener("click", function () { snd("ui"); showMenu(); });
    });
  }

  // ---- Mission ------------------------------------------------------------

  function startMission() {
    var chap = STORY.chapters[game.chapterIdx];
    var sc = SCENES.get(chap.scene);
    game.scene = sc;
    game.mode = sc.mode || "escort";
    game.worldW = sc.worldW || VIEW_W;
    game.enemies = [];
    game.spawnIdx = 0;
    game.frame = 0;
    game.loaded = true;
    game.reloadTimer = 0;
    game.killed = 0;
    game.shots = 0;
    game.finisher = null;
    game.scoped = false;
    game.hintTimer = 0;
    game.effects = [];
    game.tracers = [];
    game.bonusSpawns = [];
    game.shotFlash = 0;
    game.msgTimer = 0;
    if (game.mode === "hunt") {
      game.escort = null;
      // Prior friendly fire (wounds, max 2) lowers the traitor's HP and speed.
      var wounds = Math.min(2, game.misfires);
      game.traitor = new Entities.Traitor({
        covers: sc.covers, y: sc.ground, escapeX: sc.escapeX,
        hp: 3 - wounds,
        dashSpeed: 4.6 - wounds * 1.0,
        peekT: 30 + wounds * 15,
        hideT: 60
      });
      game.camX = clamp(game.traitor.x + game.traitor.w / 2 - VIEW_W / 2, 0, Math.max(0, game.worldW - VIEW_W));
    } else {
      game.traitor = null;
      // Each prior misfire has permanently slowed the escort (~x0.8 each).
      var slow = Math.pow(0.8, game.misfires);
      game.escort = new Entities.Escort({ x: sc.startX, y: sc.ground, speed: sc.escortSpeed * slow, hp: sc.escortHp });
      // Carried misfires also mean more enemies — seed a few extra rushers.
      for (var m = 0; m < game.misfires; m++) game.bonusSpawns.push(140 + m * 170);
      game.camX = 0;
    }
    while (Input.takeGesture()) {}
    hideOverlay();
    game.state = STATE.PLAY;
    if (global.Sound) { global.Sound.resume(); global.Sound.startMusic(); }
    if (game.mode === "hunt") {
      flash("排除任務 ―― " + sc.name, "#ffd166");
      if (wounds > 0) setTimeout(function () { if (game.state === STATE.PLAY) flash("標的は負傷している（誤射の代償）", "#7fe6a6"); }, 1200);
    } else {
      flash("護衛開始 ―― 護衛対象を撃つな！（誤射3回で失敗）", "#ff9a6a");
    }
    syncHud();
  }

  function spawnDue() {
    var sp = game.scene.spawns;
    while (game.spawnIdx < sp.length && game.frame >= sp[game.spawnIdx].t) {
      var e = sp[game.spawnIdx++];
      var x;
      if (e.rel != null) x = game.escort.x + e.rel;                 // near the escort
      else if (e.side === "left") x = game.camX - 20;              // enter at a view edge
      else if (e.side === "right") x = game.camX + VIEW_W + 4;
      else x = e.x;                                                 // posted at a world x
      game.enemies.push(new Entities.Enemy({
        x: x, y: game.scene.ground, type: e.type, dir: e.dir,
        speed: e.speed, boss: e.boss
      }));
      if (e.type === "rusher" || e.boss) snd("alert");
    }
  }

  // Extra rushers injected by friendly fire ("more enemies appear").
  function processBonus() {
    for (var i = game.bonusSpawns.length - 1; i >= 0; i--) {
      if (game.frame >= game.bonusSpawns[i]) {
        game.bonusSpawns.splice(i, 1);
        var fromRight = Math.random() < 0.6;
        var x = fromRight ? game.escort.x + 340 : game.escort.x - 300;
        game.enemies.push(new Entities.Enemy({ x: x, y: game.scene.ground, type: "rusher", speed: 1.0 + Math.random() * 0.15 }));
        snd("alert");
      }
    }
  }

  function updateEnemies() {
    var live = [];
    for (var i = 0; i < game.enemies.length; i++) {
      var e = game.enemies[i];
      if (e.dead) continue;
      var ev = e.update(game.escort);
      if (ev === "fire") {
        gunnerFire(e);
      } else if (ev === "contact") {
        game.escort.hurt();
        snd("hurt");
        addSpark(game.escort.x + game.escort.w / 2, game.escort.y + 14, "#ff5a5a");
        flash("護衛が接触された！", "#ff5a5a");
      }
      // Retire threats the escort has safely walked past.
      if (!e.dead && game.escort.x - e.x > 400) continue;
      if (!e.dead) live.push(e);
    }
    game.enemies = live;
  }

  function gunnerFire(e) {
    var ex = e.dir > 0 ? e.x + e.w + 4 : e.x - 4;
    var tx = game.escort.x + game.escort.w / 2;
    var ty = game.escort.y + 10;
    game.tracers.push({ x0: ex, y0: e.y + 15, x1: tx, y1: ty, t: 0 });
    game.escort.hurt();
    snd("enemyfire"); snd("hurt");
    addSpark(tx, ty, "#ff8a3a");
    flash("護衛が撃たれた！", "#ff5a5a");
  }

  function addSpark(x, y, color) {
    game.effects.push({ x: x, y: y, t: 0, color: color || "#ffd166" });
  }

  function missionClear() {
    if (global.Sound) global.Sound.stopMusic();
    snd("clear");
    var acc = game.shots > 0 ? Math.round((game.killed / game.shots) * 100) : 100;
    var chap = STORY.chapters[game.chapterIdx];
    game.state = STATE.RESULT;
    var stats;
    if (game.mode === "hunt") {
      var bonus = 4000;
      game.score += bonus; commitHi();
      showOverlayHTML("result win",
        '<h1>排除完了</h1>' +
        '<p class="subtitle">' + chap.title + '</p>' +
        '<ul class="stats">' +
        '<li>命中率 <b>' + acc + '%</b></li>' +
        '<li>決着ボーナス <b>+' + bonus + '</b></li>' +
        '<li>SCORE <b>' + game.score + '</b></li>' +
        '</ul>' +
        '<button id="next-btn">次へ</button>');
    } else {
      var hpBonus = game.escort.hp * 400;
      game.score += hpBonus; commitHi();
      showOverlayHTML("result win",
        '<h1>護衛成功</h1>' +
        '<p class="subtitle">' + chap.title + '</p>' +
        '<ul class="stats">' +
        '<li>命中率 <b>' + acc + '%</b></li>' +
        '<li>護衛の残HP <b>' + game.escort.hp + '</b> ＝ +' + hpBonus + '</li>' +
        '<li>SCORE <b>' + game.score + '</b></li>' +
        '</ul>' +
        '<button id="next-btn">次へ</button>');
    }
    document.getElementById("next-btn").addEventListener("click", function () {
      snd("ui");
      beginCut(chap.outro, function () { beginChapter(game.chapterIdx + 1); });
    });
  }

  function missionFail(reason) {
    if (global.Sound) global.Sound.stopMusic();
    snd("over");
    commitHi();
    game.state = STATE.OVER;
    var sub = reason || (game.mode === "hunt" ? "標的に逃げられた。追跡は失敗だ。" : "護衛対象が倒れた。契約は破談だ。");
    showOverlayHTML("result over",
      '<h1>MISSION FAILED</h1>' +
      '<p class="subtitle">' + sub + '</p>' +
      '<p class="lede">SCORE ' + game.score + ' ／ HI ' + game.hi + '</p>' +
      '<div class="over-btns">' +
      '<button id="retry-btn">このステージを再開</button>' +
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

  // ---- Shooting -----------------------------------------------------------

  // Resolve one fired round at world point p. Empties the chamber (manual
  // RELOAD required for the next shot). Called only when loaded & scoped.
  function resolveShot(p) {
    game.shots++;
    game.loaded = false;
    game.shotFlash = 6;
    if (game.mode === "hunt") {
      if (game.traitor && game.traitor.hit(p.x, p.y)) {
        game.traitor.hp--;
        addSpark(game.traitor.x + game.traitor.w / 2, game.traitor.y + 8, "#ff5a5a");
        if (game.traitor.hp <= 0) { startFinisher(game.traitor); }
        else { game.traitor.stumble(); snd("snipe"); addScore(300); flash("命中！ 残り " + game.traitor.hp, "#ffd166"); }
      } else { snd("snipe"); }
      return;
    }
    // Topmost enemy under the crosshair wins.
    for (var i = game.enemies.length - 1; i >= 0; i--) {
      var e = game.enemies[i];
      if (e.hit(p.x, p.y)) {
        if (e.boss) startFinisher(e);   // boss = dramatic GUILTY
        else killEnemy(e);
        return;
      }
    }
    // Hitting the escort is FRIENDLY FIRE.
    if (game.escort && game.escort.hit(p.x, p.y)) { onMisfire(); return; }
    snd("snipe");   // clean miss
  }

  // Friendly fire: run-wide count. Each one slows the escort and adds enemies;
  // the third ends the run. The wounds also carry into the finale (the escort
  // turns out to be the traitor), lowering that target's HP and speed.
  function onMisfire() {
    game.misfires++;
    if (game.escort) game.escort.mark();
    game.shotFlash = 6;
    snd("wrong");
    if (game.misfires >= 3) {
      syncHud();
      missionFail("誤射3回 ―― 護衛対象を撃ちすぎた");
      return;
    }
    if (game.escort) game.escort.speed *= 0.8;                 // permanent slow
    game.bonusSpawns.push(game.frame + 30, game.frame + 70);   // more enemies
    flash("誤射！ 護衛対象を撃つな（" + game.misfires + "/3）", "#ff5a5a");
    syncHud();
  }

  function killEnemy(e) {
    e.dead = true;
    game.killed++;
    addScore(500);
    addSpark(e.x + e.w / 2, e.y + 6, "#ff5a5a");
    snd("snipe");
  }

  // Boss finisher: the one place the full "GUILTY" freeze returns.
  var SNIPE = { zoom: 54, aim: 44, guilty: 62, fire: 20, after: 46 };

  function startFinisher(e) {
    game.finisher = { enemy: e, phase: "zoom", t: 0 };
    snd("lock");
  }

  function updateFinisher() {
    var s = game.finisher;
    s.t++;
    if (s.phase === "zoom" && s.t >= SNIPE.zoom) { s.phase = "aim"; s.t = 0; snd("lock"); }
    else if (s.phase === "aim" && s.t >= SNIPE.aim) { s.phase = "guilty"; s.t = 0; snd("guilty"); }
    else if (s.phase === "guilty" && s.t >= SNIPE.guilty) { s.phase = "fire"; s.t = 0; snd("snipe"); }
    else if (s.phase === "fire" && s.t >= SNIPE.fire) {
      s.enemy.dead = true;
      if (game.mode !== "hunt") game.enemies = game.enemies.filter(function (x) { return !x.dead; });
      game.killed++;
      addScore(3000);
      snd("explode");
      s.phase = "after"; s.t = 0;
    } else if (s.phase === "after" && s.t >= SNIPE.after) {
      game.finisher = null;
      if (game.mode === "hunt") missionClear();   // the traitor is down — mission over
    }
  }

  // ---- Tick ---------------------------------------------------------------

  function tick() {
    update();
    draw();
    Input.endFrame();
    requestAnimationFrame(tick);
  }

  function update() {
    if (game.msgTimer > 0) game.msgTimer--;
    if (game.shotFlash > 0) game.shotFlash--;

    if (game.state === STATE.CUTSCENE) {
      if (game.cut) {
        game.cut.update();
        if (Input.consume("start")) game.cut.advance();
        if (game.cut.finished) { var n = game.cutNext; game.cut = null; game.cutNext = null; if (n) n(); }
      }
      while (Input.takeGesture()) {}   // drain stray gestures
      return;
    }

    if (game.state !== STATE.PLAY) return;

    // Advance transient visuals regardless of freeze.
    for (var t = game.tracers.length - 1; t >= 0; t--) { if (++game.tracers[t].t > 12) game.tracers.splice(t, 1); }
    for (var f = game.effects.length - 1; f >= 0; f--) { if (++game.effects[f].t > 20) game.effects.splice(f, 1); }

    // The finisher freezes the world; ignore aiming input during it.
    if (game.finisher) { updateFinisher(); while (Input.takeGesture()) {} return; }

    if (game.hintTimer > 0) game.hintTimer--;
    if (game.reloadTimer > 0 && --game.reloadTimer === 0) { game.loaded = true; }

    // Scope toggle via pinch / double-click. The gesture carries the focus
    // point so the scope opens centred exactly where you tapped/pinched.
    var g;
    while ((g = Input.takeGesture())) {
      if (g.kind === "in") scopeIn(g);
      else if (g.kind === "out") scopeOut();
      else { if (game.scoped) scopeOut(); else scopeIn(g); }
    }
    // Dedicated trigger / reload (buttons or keys) — the reticle never moves.
    if (Input.consume("reload")) doReload();
    if (Input.consume("shot")) doShot();
    if (game.finisher || game.state !== STATE.PLAY) { syncHud(); return; }

    game.frame++;

    if (game.mode === "hunt") {
      var hev = game.traitor.update();
      if (!game.scoped) updateCamera(game.traitor);
      if (hev === "escaped") { missionFail(); return; }
      syncHud();
      return;
    }

    game.escort.update(game.scene.exitX);
    spawnDue();
    processBonus();
    updateEnemies();
    if (!game.scoped) updateCamera(game.escort);

    if (game.escort.hp <= 0) { missionFail(); return; }
    if (game.escort.arrived) { snd("arrive"); missionClear(); return; }

    syncHud();
  }

  function scopeIn(focus) {
    if (game.scoped) return;
    game.scoped = true;
    if (focus && focus.x != null) Input.setAim(focus.x, focus.y);  // centre on the tap/pinch point
    snd("lock");
  }
  function scopeOut() { if (game.scoped) { game.scoped = false; snd("ui"); } }
  function nudgeScope() {
    if (game.hintTimer <= 0) { flash("スコープを覗け（ダブルクリック / ピンチ）", "#9fd0ff"); game.hintTimer = 90; }
  }

  // SHOT: fire at the current reticle (only through the scope, with a round).
  function doShot() {
    if (!game.scoped) { nudgeScope(); return; }
    if (game.reloadTimer > 0) { snd("empty"); return; }
    if (!game.loaded) { snd("empty"); if (game.hintTimer <= 0) { flash("空薬室 ―― RELOAD（R）", "#ffd166"); game.hintTimer = 80; } return; }
    var a = Input.aim();
    resolveShot({ x: a.x + game.camX, y: a.y });
  }

  // RELOAD: always drops the scope (lower the rifle); re-chambers if spent.
  function doReload() {
    scopeOut();
    if (!game.loaded && game.reloadTimer <= 0) { game.reloadTimer = RELOAD_TIME; snd("reload"); }
  }

  // ---- Draw ---------------------------------------------------------------

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (game.state === STATE.CUTSCENE && game.cut) { game.cut.draw(ctx); return; }

    if (game.state === STATE.MENU || game.state === STATE.RESULT ||
        game.state === STATE.OVER || game.state === STATE.ENDING) {
      if (game.scene) { ctx.globalAlpha = 0.5; game.scene.drawBg(ctx, game.worldW); ctx.globalAlpha = 1; }
      return;
    }

    // PLAY.
    var fn = game.finisher;
    if (fn) {
      ctx.save();
      if (fn.phase !== "guilty") {
        var z = snipeZoom(fn);
        var zx = fn.enemy.x + fn.enemy.w / 2 - game.camX;
        var zy = fn.enemy.y + 8;
        var shake = fn.phase === "fire" ? (Math.random() - 0.5) * 6 : 0;
        ctx.translate(zx + shake, zy + shake); ctx.scale(z, z); ctx.translate(-zx, -zy);
      }
      ctx.translate(-Math.round(game.camX), 0);
      drawWorldContent(1);
      ctx.restore();
      if (fn.phase === "guilty") drawGuiltyCut(fn.t);
      else if (fn.phase === "after") drawAfterglow(fn);
      else drawScope(fn);
    } else {
      // Hip view: the whole field at a distance (small figures).
      ctx.save();
      ctx.translate(-Math.round(game.camX), 0);
      drawWorldContent(HIP_ACTOR);
      ctx.restore();
      drawDistanceHaze();
      if (game.scoped) drawScopeView();
      else drawHipReticle();
    }
    if (game.shotFlash > 0) { ctx.fillStyle = "rgba(255,255,255,0.14)"; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    if (game.msgTimer > 0) drawFlash();
  }

  // Draw the world (bg, exit, actors, fx). `actorScale` shrinks living figures
  // so the hip view reads as distant; the scope re-draws them at 1.
  function drawWorldContent(actorScale) {
    game.scene.drawBg(ctx, game.worldW);
    drawExit();
    if (game.mode === "hunt") {
      if (game.traitor.exposed) { drawCovers(); drawActor(game.traitor, actorScale); }
      else { drawActor(game.traitor, actorScale); drawCovers(); }
    } else {
      if (game.escort) drawActor(game.escort, actorScale);
      for (var i = 0; i < game.enemies.length; i++) drawActor(game.enemies[i], actorScale);
      if (game.escort) drawEscortHp();
    }
    drawTracers();
    drawSparks();
  }

  function drawActor(ent, s) {
    if (s === 1) { ent.draw(ctx); return; }
    var fx = ent.x + ent.w / 2, fy = ent.y + ent.h;
    ctx.save(); ctx.translate(fx, fy); ctx.scale(s, s); ctx.translate(-fx, -fy);
    ent.draw(ctx); ctx.restore();
  }

  function drawDistanceHaze() {
    var g = ctx.createLinearGradient(0, 0, 0, canvas.height);
    g.addColorStop(0, "rgba(150,170,200,0.05)");
    g.addColorStop(0.6, "rgba(120,140,175,0.10)");
    g.addColorStop(1, "rgba(90,110,150,0.04)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function drawHipReticle() {
    var a = Input.aim();
    if (a.inside) {
      var x = a.x, y = a.y;
      ctx.save();
      ctx.strokeStyle = "rgba(210,220,235,0.5)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - 12, y); ctx.lineTo(x - 4, y); ctx.moveTo(x + 4, y); ctx.lineTo(x + 12, y);
      ctx.moveTo(x, y - 12); ctx.lineTo(x, y - 4); ctx.moveTo(x, y + 4); ctx.lineTo(x, y + 12);
      ctx.stroke();
      ctx.restore();
    }
    ctx.save();
    ctx.fillStyle = "rgba(159,208,255,0.7)";
    ctx.font = "11px 'Courier New', monospace"; ctx.textAlign = "center";
    ctx.fillText("ダブルクリック / ピンチイン → スコープ", canvas.width / 2, canvas.height - 12);
    ctx.textAlign = "left"; ctx.restore();
  }

  // The scope: dim the field, then a magnified circular lens follows the aim.
  function drawScopeView() {
    var a = Input.aim();
    var psx = a.inside ? a.x : canvas.width / 2;
    var psy = a.inside ? a.y : canvas.height / 2;
    var W = canvas.width, H = canvas.height;
    ctx.fillStyle = "rgba(2,3,8,0.9)"; ctx.fillRect(0, 0, W, H);   // tunnel-vision
    ctx.save();
    ctx.beginPath(); ctx.arc(psx, psy, SCOPE_R, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = "#0b1420"; ctx.fillRect(psx - SCOPE_R, psy - SCOPE_R, SCOPE_R * 2, SCOPE_R * 2);
    ctx.translate(psx, psy); ctx.scale(SCOPE_Z, SCOPE_Z); ctx.translate(-psx, -psy);
    ctx.translate(-game.camX, 0);
    drawWorldContent(1);
    ctx.restore();
    drawScopeRing(psx, psy);
  }

  function drawScopeRing(cx, cy) {
    var R = SCOPE_R;
    var wx = cx + game.camX, onTarget = false;
    if (game.mode === "hunt") onTarget = !!(game.traitor && game.traitor.hit(wx, cy));
    else for (var i = 0; i < game.enemies.length; i++) if (game.enemies[i].hit(wx, cy)) { onTarget = true; break; }
    var reloading = game.reloadTimer > 0;
    ctx.save();
    ctx.lineWidth = 12; ctx.strokeStyle = "#04050a"; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 2; ctx.strokeStyle = "#2a3350"; ctx.beginPath(); ctx.arc(cx, cy, R - 6, 0, Math.PI * 2); ctx.stroke();
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R - 6, 0, Math.PI * 2); ctx.clip();
    // Crosshair: red on a valid target when a round is chambered; dim otherwise.
    var cross = !game.loaded ? "rgba(150,160,175,0.6)" : onTarget ? "rgba(255,70,70,0.95)" : "rgba(200,215,235,0.7)";
    ctx.strokeStyle = cross; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke();
    for (var k = -8; k <= 8; k++) { if (!k) continue; ctx.beginPath(); ctx.moveTo(cx + k * 12, cy - 3); ctx.lineTo(cx + k * 12, cy + 3); ctx.moveTo(cx - 3, cy + k * 12); ctx.lineTo(cx + 3, cy + k * 12); ctx.stroke(); }
    ctx.fillStyle = cross; ctx.fillRect(cx - 2, cy - 2, 4, 4);
    if (reloading) { ctx.strokeStyle = "rgba(255,209,102,0.9)"; ctx.lineWidth = 3; var pr = 1 - game.reloadTimer / RELOAD_TIME; ctx.beginPath(); ctx.arc(cx, cy, 26, -Math.PI / 2, -Math.PI / 2 + pr * Math.PI * 2); ctx.stroke(); }
    ctx.restore();
    ctx.fillStyle = "#ff6a6a"; ctx.font = "bold 12px 'Courier New', monospace"; ctx.textAlign = "center";
    ctx.fillText("O K B", cx, cy - R + 20);
    ctx.fillStyle = game.loaded ? "rgba(180,230,190,0.85)" : "rgba(255,180,120,0.9)";
    ctx.font = "10px 'Courier New', monospace";
    ctx.fillText(reloading ? "RELOADING…" : game.loaded ? "● LOADED" : "○ EMPTY  R:RELOAD", cx, cy + R - 12);
    ctx.textAlign = "left";
    ctx.restore();
  }

  function drawCovers() {
    var sc = game.scene, cs = sc.covers;
    for (var i = 0; i < cs.length; i++) sc.drawCover(ctx, cs[i], sc.ground, sc.coverKind);
  }

  function drawExit() {
    var hunt = game.mode === "hunt";
    var x = hunt ? game.scene.escapeX : game.scene.exitX, gy = game.scene.ground;
    // In the hunt this is the traitor's ESCAPE (bad for the player) — tint it red.
    var tint = hunt ? "255,90,90" : "120,220,150";
    var g = ctx.createRadialGradient(x, gy - 24, 6, x, gy - 24, 60);
    g.addColorStop(0, "rgba(" + tint + ",0.4)"); g.addColorStop(1, "rgba(" + tint + ",0)");
    ctx.fillStyle = g; ctx.fillRect(x - 60, gy - 90, 120, 90);
    ctx.fillStyle = hunt ? "#ff8a8a" : "#7fe6a6"; ctx.font = "bold 11px 'Courier New', monospace";
    ctx.textAlign = "center"; ctx.fillText(hunt ? "ESCAPE" : "EXIT", x, gy - 60);
    ctx.textAlign = "left";
    ctx.fillStyle = "#9fb0c8";
    if (game.scene.exit === "boat") { ctx.fillRect(x - 16, gy - 10, 32, 6); ctx.fillRect(x - 2, gy - 24, 3, 14); }
    else if (game.scene.exit === "heli") { ctx.fillRect(x - 20, gy - 40, 40, 2); ctx.fillRect(x - 8, gy - 38, 16, 8); }
    else if (game.scene.exit === "van") { ctx.fillRect(x - 20, gy - 22, 40, 20); ctx.fillStyle = "#0e1116"; ctx.beginPath(); ctx.arc(x - 12, gy, 4, 0, 6.3); ctx.arc(x + 12, gy, 4, 0, 6.3); ctx.fill(); }
    else { ctx.fillRect(x - 10, gy - 34, 20, 34); }
  }

  function drawTracers() {
    for (var i = 0; i < game.tracers.length; i++) {
      var tr = game.tracers[i];
      var a = clamp(1 - tr.t / 12, 0, 1);
      ctx.strokeStyle = "rgba(255,140,60," + (a * 0.9) + ")";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(tr.x0, tr.y0); ctx.lineTo(tr.x1, tr.y1); ctx.stroke();
    }
  }

  function drawSparks() {
    for (var i = 0; i < game.effects.length; i++) {
      var e = game.effects[i];
      var a = clamp(1 - e.t / 20, 0, 1);
      ctx.fillStyle = e.color;
      for (var k = 0; k < 6; k++) {
        var ang = k * Math.PI / 3, len = 3 + e.t * 1.4;
        ctx.globalAlpha = a;
        ctx.fillRect(e.x + Math.cos(ang) * len - 1.5, e.y + Math.sin(ang) * len - 1.5, 3, 3);
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawEscortHp() {
    var e = game.escort, cx = e.x + e.w / 2;
    for (var i = 0; i < e.maxHp; i++) {
      ctx.fillStyle = i < e.hp ? "#5aa0ff" : "rgba(120,130,140,0.35)";
      ctx.fillRect(cx - e.maxHp * 3 + i * 6, e.y - 10, 4, 4);
    }
  }

  function drawFlash() {
    var a = Math.min(1, game.msgTimer / 45);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = game.msgColor;
    ctx.font = "bold 20px 'Courier New', monospace";
    ctx.textAlign = "center";
    ctx.fillText(game.msg, canvas.width / 2, 62);
    ctx.restore();
    ctx.textAlign = "left";
  }

  // ---- Boss finisher rendering (ported from Elevator Action) --------------

  function snipeZoom(s) {
    var Z = 2.7;
    if (s.phase === "zoom") return 1 + (Z - 1) * smooth(s.t / SNIPE.zoom);
    if (s.phase === "after") return 1 + (Z - 1) * (1 - smooth(s.t / SNIPE.after));
    return Z;
  }

  function drawScope(s) {
    var W = canvas.width, H = canvas.height;
    var e = s.enemy;
    var tx = e.x + e.w / 2 - game.camX;   // world -> screen
    var ty = e.y + 8;
    var sway = s.phase === "aim" ? 2.5 : 0;
    tx += Math.sin(s.t / 9) * sway;
    ty += Math.cos(s.t / 11) * sway;
    var full = Math.max(W, H) * 1.15, rMin = 96;
    var r = s.phase === "zoom" ? full - (full - rMin) * smooth(s.t / SNIPE.zoom) : rMin;

    ctx.save();
    if (s.phase === "zoom" || s.phase === "aim") { ctx.fillStyle = "rgba(50,90,170,0.12)"; ctx.fillRect(0, 0, W, H); }
    ctx.fillStyle = "rgba(2,3,8,0.93)";
    ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.arc(tx, ty, r, 0, Math.PI * 2, true); ctx.fill("evenodd");
    ctx.lineWidth = 12; ctx.strokeStyle = "#04050a"; ctx.beginPath(); ctx.arc(tx, ty, r, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 2; ctx.strokeStyle = "#2a3350"; ctx.beginPath(); ctx.arc(tx, ty, r - 6, 0, Math.PI * 2); ctx.stroke();
    ctx.save();
    ctx.beginPath(); ctx.arc(tx, ty, r - 6, 0, Math.PI * 2); ctx.clip();
    ctx.strokeStyle = "rgba(235,70,70,0.85)"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(tx - r, ty); ctx.lineTo(tx + r, ty); ctx.moveTo(tx, ty - r); ctx.lineTo(tx, ty + r); ctx.stroke();
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
      for (var b = 0; b < 12; b++) { var ang = b * Math.PI / 6, len = 6 + s.t * 3; ctx.fillRect(tx + Math.cos(ang) * len - 2, ty + Math.sin(ang) * len - 2, 5, 5); }
      ctx.fillStyle = "#fff"; ctx.font = "bold 24px 'Courier New', monospace"; ctx.fillText("HEADSHOT!", W / 2, 54);
    }
    ctx.textAlign = "left";
    ctx.restore();
  }

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
      ctx.textAlign = "center"; ctx.fillText("首魁を撃破", W / 2, 58);
      ctx.globalAlpha = 1; ctx.textAlign = "left";
    }
    ctx.restore();
  }

  function drawGuiltyCut(t) {
    var W = canvas.width, H = canvas.height;
    var intro = clamp(t / 9, 0, 1);
    var shake = t < 9 ? (1 - intro) * 7 : 0;
    ctx.save();
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    var zc = 1 + (1 - smooth(intro)) * 0.08;
    ctx.translate(W / 2, H / 2); ctx.scale(zc, zc); ctx.translate(-W / 2, -H / 2);
    ctx.fillStyle = "#cbd1db"; ctx.fillRect(-30, -30, W + 60, H + 60);
    ctx.fillStyle = "#3c414d";
    inkCloud(60, 54, 150, 40); inkCloud(280, 38, 180, 52); inkCloud(470, 96, 150, 46);
    hatch(0, 0, W, 150, 7, -1, "rgba(20,22,28,0.30)");
    ctx.strokeStyle = "rgba(20,22,28,0.18)"; ctx.lineWidth = 1;
    for (var a = 0; a < 22; a++) { var yy0 = 150 + a * 16; ctx.beginPath(); ctx.moveTo(W, 250); ctx.lineTo(-20, yy0); ctx.stroke(); }
    ctx.fillStyle = "#242932";
    var bx = [-10, 40, 78, 120, 150, 196, 250, 300, 470, 500];
    var bh = [120, 165, 96, 140, 80, 130, 100, 150, 90, 130];
    for (var c = 0; c < bx.length; c++) ctx.fillRect(bx[c], 372 - bh[c], (bx[c + 1] || W) - bx[c] - 4, bh[c] + 20);
    drawTowerCut(430, 214, 372);
    ctx.fillStyle = "rgba(200,208,220,0.5)";
    for (var wy = 262; wy < 366; wy += 10) for (var wx = 20; wx < 320; wx += 12) if ((wx + wy) % 3 === 0) ctx.fillRect(wx, wy, 3, 4);
    ctx.fillStyle = "#b3b9c4"; ctx.fillRect(-20, 366, W + 40, H - 360);
    ctx.fillStyle = "#8b929e"; ctx.fillRect(-20, 366, W + 40, 5);
    ctx.strokeStyle = "#7c8390"; ctx.lineWidth = 2;
    for (var sx = 26; sx < W; sx += 74) { ctx.beginPath(); ctx.moveTo(sx, 372); ctx.lineTo(sx, H); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(0, 420); ctx.lineTo(W, 420); ctx.stroke();
    hatch(0, 366, W, H - 366, 8, 1, "rgba(60,66,76,0.22)");
    drawSniperRifle();
    drawSniperHead(t);
    if (t > 10) drawGuiltyBubble(W - 92, 92, smooth(clamp((t - 10) / 8, 0, 1)));
    if (t < 6) { ctx.fillStyle = "rgba(255,255,255," + (1 - t / 6) * 0.55 + ")"; ctx.fillRect(-30, -30, W + 60, H + 60); }
    ctx.fillStyle = "rgba(10,11,14,0.82)"; ctx.fillRect(0, H - 24, 132, 24);
    ctx.fillStyle = "#e6e9ef"; ctx.font = "bold 12px 'Courier New', monospace";
    ctx.textAlign = "left"; ctx.fillText("OKB   NO MISS", 8, H - 8);
    ctx.restore();
  }

  function inkCloud(x, y, w, h) {
    ctx.beginPath(); ctx.moveTo(x, y + h);
    ctx.bezierCurveTo(x - w * 0.3, y + h * 0.2, x + w * 0.2, y - h, x + w * 0.5, y);
    ctx.bezierCurveTo(x + w * 0.8, y - h * 0.9, x + w * 1.4, y + h * 0.4, x + w, y + h);
    ctx.closePath(); ctx.fill();
  }
  function hatch(x, y, w, h, gap, dir, color) {
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.strokeStyle = color; ctx.lineWidth = 1;
    for (var i = -h; i < w + h; i += gap) { ctx.beginPath(); ctx.moveTo(x + i, y); ctx.lineTo(x + i + dir * h, y + h); ctx.stroke(); }
    ctx.restore();
  }
  function drawTowerCut(cx, top, base) {
    ctx.strokeStyle = "#20242c"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(cx, top); ctx.lineTo(cx - 34, base); ctx.moveTo(cx, top); ctx.lineTo(cx + 34, base); ctx.stroke();
    ctx.lineWidth = 2;
    for (var i = 1; i < 6; i++) { var y = top + (base - top) * (i / 6), wte = 6 + i * 5; ctx.beginPath(); ctx.moveTo(cx - wte, y); ctx.lineTo(cx + wte, y); ctx.stroke(); }
    ctx.fillStyle = "#20242c"; ctx.fillRect(cx - 3, top - 22, 6, 24);
  }
  function drawSniperRifle() {
    ctx.fillStyle = "#14161c"; ctx.fillRect(300, 244, 168, 11);
    ctx.fillStyle = "#3a404c"; ctx.fillRect(300, 245, 168, 2);
    ctx.fillStyle = "#0c0e13"; ctx.fillRect(452, 238, 36, 22);
    ctx.fillStyle = "#cbd1db"; for (var m = 0; m < 3; m++) ctx.fillRect(458 + m * 10, 240, 3, 18);
    ctx.fillStyle = "#1b1f27"; ctx.fillRect(300, 234, 130, 30);
    ctx.fillStyle = "#cbd1db"; for (var hgx = 312; hgx < 424; hgx += 18) { ctx.beginPath(); ctx.arc(hgx, 249, 5, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = "#1b1f27"; for (var hgx2 = 312; hgx2 < 424; hgx2 += 18) { ctx.beginPath(); ctx.arc(hgx2, 249, 2.4, 0, Math.PI * 2); ctx.fill(); }
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
    ctx.lineWidth = 3; ctx.strokeStyle = "#3a404c"; ctx.beginPath(); ctx.moveTo(360, 258); ctx.lineTo(392, 372); ctx.stroke();
    ctx.fillStyle = "#161a22"; ctx.fillRect(120, 244, 52, 30);
  }
  function drawSniperHead(t) {
    var H = canvas.height;
    ctx.fillStyle = "#0e1015";
    ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(0, 300); ctx.lineTo(70, 262); ctx.lineTo(150, 300); ctx.lineTo(210, 300); ctx.lineTo(230, H); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#dee2e9";
    ctx.beginPath(); ctx.moveTo(64, 300); ctx.lineTo(150, 300); ctx.lineTo(196, 250); ctx.lineTo(196, 236); ctx.lineTo(120, 208); ctx.lineTo(70, 232); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#e7ebf1";
    ctx.beginPath(); ctx.moveTo(70, 232); ctx.lineTo(150, 214); ctx.quadraticCurveTo(206, 214, 208, 236); ctx.lineTo(214, 252); ctx.lineTo(196, 258); ctx.lineTo(196, 286); ctx.lineTo(150, 300); ctx.lineTo(96, 288); ctx.closePath(); ctx.fill();
    hatch(120, 250, 90, 52, 6, 1, "rgba(90,98,112,0.5)");
    ctx.fillStyle = "#14161c"; ctx.fillRect(150, 236, 44, 5);
    ctx.beginPath(); ctx.moveTo(168, 246); ctx.lineTo(190, 244); ctx.lineTo(190, 251); ctx.lineTo(168, 252); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#c9d0da"; ctx.fillRect(180, 246, 4, 3);
    ctx.strokeStyle = "#3a404c"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(168, 276); ctx.lineTo(192, 272); ctx.stroke();
    ctx.fillStyle = "#eef1f6";
    ctx.beginPath(); ctx.moveTo(58, 250); ctx.quadraticCurveTo(20, 150, 120, 150); ctx.quadraticCurveTo(178, 150, 172, 210); ctx.lineTo(150, 214); ctx.quadraticCurveTo(120, 196, 84, 214); ctx.lineTo(70, 232); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#aeb5c1"; ctx.lineWidth = 1.5;
    for (var s = 0; s < 8; s++) { ctx.beginPath(); ctx.moveTo(60 + s * 13, 156 + (s % 2) * 6); ctx.quadraticCurveTo(70 + s * 12, 190, 78 + s * 12, 220); ctx.stroke(); }
    ctx.fillStyle = "#14161c";
    ctx.beginPath(); ctx.arc(186, 300, 20, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(300, 300, 18, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#2a2f3a"; ctx.fillRect(292, 268, 16, 34);
  }
  function drawGuiltyBubble(cx, cy, sc) {
    if (sc <= 0) return;
    ctx.save(); ctx.translate(cx, cy); ctx.scale(sc, sc);
    ctx.beginPath(); ctx.ellipse(0, 0, 76, 58, 0, 0, Math.PI * 2); ctx.fillStyle = "#f6f7fa"; ctx.fill();
    ctx.lineWidth = 3.5; ctx.strokeStyle = "#111"; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-40, 34); ctx.lineTo(-92, 96); ctx.lineTo(-20, 44); ctx.closePath(); ctx.fillStyle = "#f6f7fa"; ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#111"; ctx.textAlign = "center";
    ctx.font = "bold 34px 'Yu Mincho','Hiragino Mincho ProN',serif"; ctx.fillText("有罪", 0, -2);
    ctx.font = "bold 15px 'Hiragino Kaku Gothic ProN',sans-serif"; ctx.fillText("（ギルティ）", 0, 30);
    ctx.textAlign = "left"; ctx.restore();
  }

  // ---- HUD ----------------------------------------------------------------

  function syncHud() {
    if (hud.mission) hud.mission.textContent = (game.chapterIdx + 1);
    if (hud.score) hud.score.textContent = game.score;
    if (hud.hi) hud.hi.textContent = game.hi;
    if (game.mode === "hunt" && game.traitor) {
      // Repurpose the HP field as the target's state; distance = how close to escaping.
      if (hud.hp) hud.hp.textContent = game.traitor.exposed ? "露出" : "物陰";
      if (hud.hpMax) hud.hpMax.textContent = "標的";
      if (hud.dist) {
        var e = clamp(game.traitor.x / game.scene.escapeX, 0, 1);
        hud.dist.textContent = Math.round(e * 100);
      }
      if (hud.note) hud.note.textContent = "標的HP " + game.traitor.hp + "/" + game.traitor.maxHp;
    } else {
      if (hud.hp) hud.hp.textContent = game.escort ? Math.max(0, game.escort.hp) : "-";
      if (hud.hpMax) hud.hpMax.textContent = game.escort ? game.escort.maxHp : "-";
      if (hud.dist && game.scene && game.escort) {
        var d = clamp((game.escort.x - game.scene.startX) / (game.scene.exitX - game.scene.startX), 0, 1);
        hud.dist.textContent = Math.round(d * 100);
      }
      if (hud.note) hud.note.textContent = "誤射 " + game.misfires + "/3";
    }
  }

  global.__OKB = game;
  // QA hook: jump straight into a chapter's mission (skips its intro cutscene).
  game.debugStart = function (i) { if (i >= 0 && i < STORY.chapters.length) { game.chapterIdx = i; startMission(); } };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})(window);
