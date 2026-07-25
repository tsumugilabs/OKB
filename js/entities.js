/**
 * Game actors for OKB and shared helpers.
 *
 * OKB is an escort-sniper game: the player never moves a character on the
 * ground. Instead an ESCORT (the protagonist of the previous game, now under
 * OKB's protection) walks autonomously toward the exit, and ENEMIES appear to
 * stop them. The player is the sniper overhead who taps enemies to remove them
 * before they can harm the escort.
 *
 * Carried over from the Elevator Action engine: the AABB `overlaps`/point-hit
 * helpers and the `px` pixel-sprite primitive. The platformer physics
 * (moveAndCollide, gravity, elevators) are dropped.
 */
(function (global) {
  "use strict";

  // ---- AABB / hit-test helpers -------------------------------------------

  function overlaps(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x &&
           a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function pointIn(px, py, r, pad) {
    pad = pad || 0;
    return px >= r.x - pad && px <= r.x + r.w + pad &&
           py >= r.y - pad && py <= r.y + r.h + pad;
  }

  function px(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x | 0, y | 0, w, h);
  }

  // ---- Escort: the previous game's protagonist, walking to the exit -------

  var ESC_W = 16, ESC_H = 36;

  function Escort(opts) {
    this.w = ESC_W;
    this.h = ESC_H;
    this.speed = opts.speed != null ? opts.speed : 0.5;
    this.x = opts.x;
    this.baseY = opts.y - this.h;      // feet rest on ground line `y`
    this.y = this.baseY;
    this.dir = 1;
    this.walk = 0;
    this.maxHp = opts.hp || 5;
    this.hp = this.maxHp;
    this.hurtFlash = 0;
    this.stunned = 0;                  // brief pause after being hit
    this.arrived = false;
  }

  Escort.prototype.update = function (exitX) {
    if (this.hurtFlash > 0) this.hurtFlash--;
    if (this.stunned > 0) { this.stunned--; }
    else { this.x += this.speed; this.walk += this.speed + 0.15; }
    this.y = this.baseY + Math.sin(this.walk * 0.9) * 1.0;
    if (this.x + this.w / 2 >= exitX) this.arrived = true;
  };

  Escort.prototype.hurt = function () {
    this.hp--;
    this.hurtFlash = 26;
    this.stunned = 20;
  };

  Escort.prototype.rect = function () {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  };

  Escort.prototype.draw = function (ctx) {
    var x = this.x, y = this.y;
    var flash = this.hurtFlash > 0 && (this.hurtFlash >> 2) % 2 === 0;
    var coat = flash ? "#ffffff" : "#2f4a6b";   // trench coat (spy blue)
    var skin = flash ? "#ffffff" : "#e7c8a0";
    var stride = Math.sin(this.walk) * 2.4;
    // Legs.
    px(ctx, x + 3, y + 28, 4, 8 - Math.max(0, stride), "#20252e");
    px(ctx, x + 9, y + 28, 4, 8 - Math.max(0, -stride), "#20252e");
    // Trench coat.
    px(ctx, x + 2, y + 13, 12, 16, coat);
    px(ctx, x + 1, y + 26, 14, 4, coat);        // coat skirt
    // Arms.
    px(ctx, x, y + 14, 3, 11, coat);
    px(ctx, x + 13, y + 14, 3, 11, coat);
    // Head + fedora (the previous protagonist's silhouette).
    px(ctx, x + 4, y + 3, 8, 9, skin);
    px(ctx, x + 2, y + 1, 12, 3, flash ? "#ffffff" : "#1c2129"); // hat brim
    px(ctx, x + 4, y - 2, 8, 4, flash ? "#ffffff" : "#232a34");   // hat crown
    // A faint blue protectee marker ring at the feet.
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.strokeStyle = "#5aa0ff"; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(x + this.w / 2, y + this.h - 1, 11, 3, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  };

  // ---- Enemy: gunner (ranged) or rusher (melee) ---------------------------

  var EN_W = 16, EN_H = 32;
  // Phase budgets (frames @60fps).
  var EMERGE = 16;
  var GUN_AIM = 78;          // telegraph before a gunner fires
  var BOSS_AIM = 150;        // the boss winds up longer (dramatic)

  function Enemy(opts) {
    this.w = EN_W;
    this.h = EN_H;
    this.type = opts.type || "gunner";
    this.boss = !!opts.boss;
    this.x = opts.x;
    this.baseY = opts.y - this.h;
    this.y = this.baseY;
    this.dir = opts.dir || -1;         // facing
    this.speed = opts.speed != null ? opts.speed : 0.95; // rushers
    this.timer = 0;
    this.dead = false;
    this.gone = false;                 // left the field harmlessly
    this.phase = "emerge";
    this.charge = 0;                   // 0..1 telegraph progress (gunner)
    this.aimTime = this.boss ? BOSS_AIM : GUN_AIM;
    this.run = 0;                      // rusher animation
  }

  Enemy.prototype.aiming = function () {
    return this.type === "gunner" && this.phase === "aim";
  };

  /** Advance; returns an event: "fire" (gunner shot), "contact" (rusher hit), or null. */
  Enemy.prototype.update = function (escort) {
    this.timer++;
    if (this.type === "gunner") {
      if (this.timer < EMERGE) { this.phase = "emerge"; this.y = this.baseY + (EMERGE - this.timer); return null; }
      this.y = this.baseY;
      var at = this.timer - EMERGE;
      if (at < this.aimTime) {
        this.phase = "aim";
        this.charge = at / this.aimTime;
        return null;
      }
      // Fire, then wind up again for the next shot.
      this.phase = "fire";
      this.timer = EMERGE;
      this.charge = 0;
      return "fire";
    }
    // Rusher: emerge, then run toward the escort's centre.
    if (this.timer < EMERGE) { this.phase = "emerge"; return null; }
    this.phase = "run";
    this.run += this.speed;
    var tx = escort.x + escort.w / 2;
    var cx = this.x + this.w / 2;
    this.dir = tx < cx ? -1 : 1;
    this.x += this.dir * this.speed;
    if (Math.abs((this.x + this.w / 2) - tx) < 12) { this.dead = true; return "contact"; }
    return null;
  };

  Enemy.prototype.rect = function () { return { x: this.x, y: this.y, w: this.w, h: this.h }; };
  Enemy.prototype.hit = function (px, py) { return !this.dead && pointIn(px, py, this.rect(), 5); };

  Enemy.prototype.draw = function (ctx) {
    var x = this.x, y = this.y;
    var accent = this.boss ? "#ff9a2a" : "#d23b3b";
    var coat = this.boss ? "#1a1520" : "#242832";
    if (this.type === "rusher") {
      // Lean forward in the run direction.
      var lean = this.dir * 2;
      var s = Math.sin(this.run * 0.6) * 3;
      px(ctx, x + 3, y + 26, 4, 6 - Math.max(0, s), "#15181f");
      px(ctx, x + 9, y + 26, 4, 6 - Math.max(0, -s), "#15181f");
      px(ctx, x + 2 + lean, y + 12, 12, 15, coat);
      px(ctx, x + 4 + lean, y + 2, 8, 9, "#e7c8a0");
      px(ctx, x + 4 + lean, y + 1, 8, 3, accent);          // red band
      // outstretched arm (menace).
      px(ctx, x + (this.dir > 0 ? 13 : -1) + lean, y + 13, 4, 3, coat);
    } else {
      // Gunner: standing, rifle raised while aiming.
      px(ctx, x + 3, y + 26, 4, 6, "#15181f");
      px(ctx, x + 9, y + 26, 4, 6, "#15181f");
      px(ctx, x + 2, y + 12, 12, 15, coat);
      px(ctx, x + 4, y + 2, 8, 9, "#e7c8a0");
      px(ctx, x + 4, y + 1, 8, 3, accent);                 // red cap band
      // Rifle, pointed toward the escort side (dir).
      var gx = this.dir > 0 ? x + 14 : x - 8;
      px(ctx, gx, y + 14, 10, 2, "#0e1116");
      // Telegraph: an intensifying warning as the shot charges.
      if (this.phase === "aim") {
        var hot = this.charge > 0.7;
        ctx.save();
        ctx.globalAlpha = 0.5 + this.charge * 0.5;
        ctx.fillStyle = hot ? "#ff3030" : "#ffd166";
        ctx.font = "bold 16px 'Courier New', monospace";
        ctx.textAlign = "center";
        ctx.fillText("!", x + this.w / 2, y - 4);
        ctx.restore();
        ctx.textAlign = "left";
      }
    }
    if (this.boss) {
      // A subtle crown-ring so the boss reads as the finisher target.
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = accent; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(x + this.w / 2, y + this.h - 1, 12, 3.5, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  };

  global.Entities = {
    Escort: Escort,
    Enemy: Enemy,
    overlaps: overlaps,
    pointIn: pointIn,
    px: px,
    ESC_W: ESC_W, ESC_H: ESC_H,
    EN_W: EN_W, EN_H: EN_H
  };
})(window);
