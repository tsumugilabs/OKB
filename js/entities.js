/**
 * Game actors for OKB and shared helpers.
 *
 * OKB is an escort-sniper game: the player never moves a character on the
 * ground. An ESCORT (the previous game's protagonist, now protected) walks
 * autonomously to the exit; ENEMIES appear to stop them; the player is the
 * sniper overhead. In the finale the escort turns TRAITOR and becomes a hunt
 * target that darts cover-to-cover.
 *
 * Carried over from the Elevator Action engine: AABB `overlaps`/point-hit and
 * the `px` pixel-sprite primitive. All world coordinates (the camera scrolls).
 */
(function (global) {
  "use strict";

  function overlaps(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x &&
           a.y < b.y + b.h && a.y + a.h > b.y;
  }
  function pointIn(px, py, r, pad) {
    pad = pad || 0;
    return px >= r.x - pad && px <= r.x + r.w + pad &&
           py >= r.y - pad && py <= r.y + r.h + pad;
  }
  function px(ctx, x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(x | 0, y | 0, w, h); }

  // ---- Escort: the previous game's protagonist ---------------------------

  var ESC_W = 16, ESC_H = 36;

  function Escort(opts) {
    this.w = ESC_W; this.h = ESC_H;
    this.speed = opts.speed != null ? opts.speed : 0.5;
    this.x = opts.x;
    this.baseY = opts.y - this.h;
    this.y = this.baseY;
    this.dir = 1; this.walk = 0;
    this.maxHp = opts.hp || 5; this.hp = this.maxHp;
    this.hurtFlash = 0; this.stunned = 0; this.arrived = false;
  }
  Escort.prototype.update = function (exitX) {
    if (this.hurtFlash > 0) this.hurtFlash--;
    if (this.stunned > 0) this.stunned--;
    else { this.x += this.speed; this.walk += this.speed + 0.15; }
    this.y = this.baseY + Math.sin(this.walk * 0.9) * 1.0;
    if (this.x + this.w / 2 >= exitX) this.arrived = true;
  };
  Escort.prototype.hurt = function () { this.hp--; this.hurtFlash = 26; this.stunned = 20; };
  // Friendly fire: a visual mark only — the run-wide misfire count lives in game.
  Escort.prototype.mark = function () { this.hurtFlash = 22; };
  Escort.prototype.rect = function () { return { x: this.x, y: this.y, w: this.w, h: this.h }; };
  Escort.prototype.hit = function (px, py) { return pointIn(px, py, this.rect(), 4); };
  Escort.prototype.draw = function (ctx) { drawAgent(ctx, this.x, this.y, this.hurtFlash > 0 && (this.hurtFlash >> 2) % 2 === 0, false); };

  // A shared fedora-and-trench sprite. `traitor` recolours it as hostile.
  function drawAgent(ctx, x, y, flash, traitor, walk) {
    var coat = flash ? "#ffffff" : (traitor ? "#3a2a2f" : "#2f4a6b");
    var skin = flash ? "#ffffff" : "#e7c8a0";
    var stride = Math.sin((walk || 0)) * 2.2;
    px(ctx, x + 3, y + 28, 4, 8 - Math.max(0, stride), "#20252e");
    px(ctx, x + 9, y + 28, 4, 8 - Math.max(0, -stride), "#20252e");
    px(ctx, x + 2, y + 13, 12, 16, coat);
    px(ctx, x + 1, y + 26, 14, 4, coat);
    px(ctx, x, y + 14, 3, 11, coat);
    px(ctx, x + 13, y + 14, 3, 11, coat);
    px(ctx, x + 4, y + 3, 8, 9, skin);
    px(ctx, x + 2, y + 1, 12, 3, flash ? "#ffffff" : "#1c2129");
    px(ctx, x + 4, y - 2, 8, 4, flash ? "#ffffff" : "#232a34");
    if (traitor) { px(ctx, x, y + 15, 3, 4, "#d23b3b"); px(ctx, x + 4, y, 8, 1, "#d23b3b"); } // red band = now a target
  }

  // ---- Enemy: gunner (ranged, proximity-activated) or rusher (melee) -----

  var EN_W = 16, EN_H = 32;
  var EMERGE = 16, GUN_AIM = 78, BOSS_AIM = 150;

  function Enemy(opts) {
    this.w = EN_W; this.h = EN_H;
    this.type = opts.type || "gunner";
    this.boss = !!opts.boss;
    this.x = opts.x; this.baseY = opts.y - this.h; this.y = this.baseY;
    this.dir = opts.dir || -1;
    this.speed = opts.speed != null ? opts.speed : 0.95;
    this.range = opts.range || 260;      // gunner activation distance (nearer = fewer active at once)
    this.timer = 0; this.aimT = 0;
    this.dead = false; this.gone = false;
    this.phase = "emerge";
    this.charge = 0;
    this.aimTime = this.boss ? BOSS_AIM : GUN_AIM;
    this.run = 0;
  }
  Enemy.prototype.aiming = function () { return this.type === "gunner" && this.phase === "aim"; };

  /** Advance; returns "fire" (gunner shot), "contact" (rusher hit), or null. */
  Enemy.prototype.update = function (target) {
    this.timer++;
    var tc = target.x + target.w / 2, cc = this.x + this.w / 2;
    if (this.type === "gunner") {
      if (this.timer < EMERGE) { this.phase = "emerge"; this.y = this.baseY + (EMERGE - this.timer); return null; }
      this.y = this.baseY;
      this.dir = tc < cc ? -1 : 1;
      if (Math.abs(tc - cc) > this.range) { this.phase = "wait"; return null; } // idle until target nears
      this.aimT++;
      this.phase = "aim";
      this.charge = this.aimT / this.aimTime;
      if (this.aimT >= this.aimTime) { this.aimT = 0; this.charge = 0; this.phase = "fire"; return "fire"; }
      return null;
    }
    // Rusher.
    if (this.timer < EMERGE) { this.phase = "emerge"; return null; }
    this.phase = "run"; this.run += this.speed;
    this.dir = tc < cc ? -1 : 1;
    this.x += this.dir * this.speed;
    if (Math.abs((this.x + this.w / 2) - tc) < 12) { this.dead = true; return "contact"; }
    return null;
  };
  Enemy.prototype.rect = function () { return { x: this.x, y: this.y, w: this.w, h: this.h }; };
  Enemy.prototype.hit = function (px, py) { return !this.dead && pointIn(px, py, this.rect(), 5); };

  Enemy.prototype.draw = function (ctx) {
    var x = this.x, y = this.y;
    var accent = this.boss ? "#ff9a2a" : "#d23b3b";
    var coat = this.boss ? "#1a1520" : "#242832";
    if (this.type === "rusher") {
      var lean = this.dir * 2, s = Math.sin(this.run * 0.6) * 3;
      px(ctx, x + 3, y + 26, 4, 6 - Math.max(0, s), "#15181f");
      px(ctx, x + 9, y + 26, 4, 6 - Math.max(0, -s), "#15181f");
      px(ctx, x + 2 + lean, y + 12, 12, 15, coat);
      px(ctx, x + 4 + lean, y + 2, 8, 9, "#e7c8a0");
      px(ctx, x + 4 + lean, y + 1, 8, 3, accent);
      px(ctx, x + (this.dir > 0 ? 13 : -1) + lean, y + 13, 4, 3, coat);
    } else {
      px(ctx, x + 3, y + 26, 4, 6, "#15181f");
      px(ctx, x + 9, y + 26, 4, 6, "#15181f");
      px(ctx, x + 2, y + 12, 12, 15, coat);
      px(ctx, x + 4, y + 2, 8, 9, "#e7c8a0");
      px(ctx, x + 4, y + 1, 8, 3, accent);
      var gx = this.dir > 0 ? x + 14 : x - 8;
      px(ctx, gx, y + 14, 10, 2, "#0e1116");
      if (this.phase === "aim") {
        var hot = this.charge > 0.7;
        ctx.save();
        ctx.globalAlpha = 0.5 + this.charge * 0.5;
        ctx.fillStyle = hot ? "#ff3030" : "#ffd166";
        ctx.font = "bold 16px 'Courier New', monospace"; ctx.textAlign = "center";
        ctx.fillText("!", x + this.w / 2, y - 4);
        ctx.restore(); ctx.textAlign = "left";
      }
    }
    if (this.boss) {
      ctx.save(); ctx.globalAlpha = 0.5; ctx.strokeStyle = accent; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(x + this.w / 2, y + this.h - 1, 12, 3.5, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  };

  // ---- Traitor: the hunt target — hides cover-to-cover -------------------

  var TR_W = 16, TR_H = 36;

  function hidePos(c) { return c - TR_W / 2; }     // tucked behind the pillar
  function peekPos(c) { return c - 38; }           // stepped out to the left, exposed

  /**
   * opts: { covers[], y, escapeX, hp, dashSpeed, peekT, hideT }
   * The finale target. Super fast by default (you can barely land one hit) and
   * takes `hp` shots to down — but prior friendly fire on the escort (who is
   * this same person) lowers hp AND slows the dash, so wounds carry over.
   */
  function Traitor(opts) {
    this.w = TR_W; this.h = TR_H;
    this.covers = opts.covers.slice();
    this.escapeX = opts.escapeX;
    this.idx = 0;
    this.baseY = opts.y - this.h; this.y = this.baseY;
    this.x = hidePos(this.covers[0]);
    this.state = "hide"; this.timer = 0;
    this.exposed = false; this.dead = false; this.escaped = false;
    this.walk = 0; this.dashTargetX = 0;
    this.maxHp = opts.hp || 3; this.hp = this.maxHp;
    this.dashSpeed = opts.dashSpeed != null ? opts.dashSpeed : 4.6;
    this.peekT = opts.peekT != null ? opts.peekT : 30;
    this.hideT = opts.hideT != null ? opts.hideT : 60;
    this.stagger = 0; this.hitFlash = 0;
  }

  Traitor.prototype._startDash = function () {
    var next = this.idx + 1 <= this.covers.length - 1 ? this.covers[this.idx + 1] : null;
    this.dashTargetX = next != null ? hidePos(next) : this.escapeX + 40;
    this.state = "dash"; this.timer = 0;
  };

  /** A non-lethal hit briefly staggers the traitor (stays exposed a moment). */
  Traitor.prototype.stumble = function () { this.stagger = 16; this.hitFlash = 12; };

  /** Returns "escaped" once the traitor slips past the escape point. */
  Traitor.prototype.update = function () {
    if (this.hitFlash > 0) this.hitFlash--;
    if (this.stagger > 0) { this.stagger--; this.exposed = true; return null; } // frozen but hittable
    this.timer++;
    if (this.state === "hide") {
      this.exposed = false;
      this.x = hidePos(this.covers[this.idx]);
      if (this.timer >= this.hideT) { this.state = "peek"; this.timer = 0; }
    } else if (this.state === "peek") {
      this.exposed = true;
      this.x = peekPos(this.covers[this.idx]);
      this.y = this.baseY + Math.sin(this.timer * 0.18) * 0.8;   // small nervous sway
      if (this.timer >= this.peekT) this._startDash();
    } else if (this.state === "dash") {
      this.exposed = true;
      this.walk += this.dashSpeed;
      this.x += this.dashSpeed;
      this.y = this.baseY + Math.abs(Math.sin(this.walk * 0.4)) * -2;  // running bob
      if (this.x >= this.dashTargetX) {
        if (this.idx + 1 <= this.covers.length - 1) { this.idx++; this.state = "hide"; this.timer = 0; }
        else { this.escaped = true; }
      }
    }
    if (this.escaped) return "escaped";
    return null;
  };

  Traitor.prototype.rect = function () { return { x: this.x, y: this.y, w: this.w, h: this.h }; };
  Traitor.prototype.hit = function (px, py) { return this.exposed && !this.dead && pointIn(px, py, this.rect(), 5); };
  Traitor.prototype.draw = function (ctx) {
    var flash = this.hitFlash > 0 && (this.hitFlash >> 1) % 2 === 0;
    drawAgent(ctx, this.x, this.y, flash, true, this.state === "dash" ? this.walk : 0);
    if (this.exposed) {   // hostile ring + remaining-HP pips so an exposed target reads at a glance
      ctx.save(); ctx.globalAlpha = 0.6; ctx.strokeStyle = "#ff5a5a"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(this.x + this.w / 2, this.y + this.h - 1, 11, 3, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      var cx = this.x + this.w / 2;
      for (var i = 0; i < this.maxHp; i++) {
        ctx.fillStyle = i < this.hp ? "#ff5a5a" : "rgba(120,120,130,0.4)";
        ctx.fillRect(cx - this.maxHp * 3 + i * 6, this.y - 10, 4, 4);
      }
    }
  };

  global.Entities = {
    Escort: Escort, Enemy: Enemy, Traitor: Traitor,
    overlaps: overlaps, pointIn: pointIn, px: px, drawAgent: drawAgent,
    ESC_W: ESC_W, ESC_H: ESC_H, EN_W: EN_W, EN_H: EN_H
  };
})(window);
