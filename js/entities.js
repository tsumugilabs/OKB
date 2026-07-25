/**
 * Game actors for OKB and shared helpers.
 *
 * The only actor here is `Mark` — a person walking across the scene. Some marks
 * are the contract's TARGET (to be eliminated), the rest are CIVILIANS (must be
 * spared). The AABB `overlaps`/point-hit helpers are carried over from the
 * Elevator Action engine (js/entities.js); the platformer physics
 * (moveAndCollide, gravity) are dropped since OKB marks walk a flat path.
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

  /** Filled-rectangle pixel-sprite primitive (matches the original's `px`). */
  function px(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x | 0, y | 0, w, h);
  }

  // ---- Mark (a walking person) -------------------------------------------

  var MARK_W = 16;
  var MARK_H = 34;

  /**
   * opts: { x, y, dir (-1|1), speed, type ("target"|"civ"), palette }
   * `y` is the ground line the mark's feet stand on.
   */
  function Mark(opts) {
    this.w = MARK_W;
    this.h = MARK_H;
    this.type = opts.type || "civ";
    this.dir = opts.dir || 1;
    this.speed = opts.speed != null ? opts.speed : 0.6;
    this.x = opts.x;
    this.baseY = opts.y - this.h;          // top-left y so feet rest on `y`
    this.y = this.baseY;
    this.vx = this.dir * this.speed;
    this.walk = Math.random() * 10;
    this.dead = false;
    this.escaped = false;
    this.pal = opts.palette || (this.type === "target"
      ? { coat: "#20242e", skin: "#e7c8a0", accent: "#d23b3b" }
      : { coat: "#5a6472", skin: "#e7c8a0", accent: "#8a93a2" });
  }

  Mark.prototype.update = function () {
    this.x += this.vx;
    this.walk += Math.abs(this.vx) + 0.15;
    // Gentle walking bob.
    this.y = this.baseY + Math.sin(this.walk * 0.9) * 1.2;
  };

  /** Tappable body box (slightly padded), in world/canvas space. */
  Mark.prototype.rect = function () {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  };

  /** Head box — where the OKB shot lands. */
  Mark.prototype.headRect = function () {
    return { x: this.x + 3, y: this.y + 2, w: this.w - 6, h: 9 };
  };

  Mark.prototype.hit = function (px, py) {
    return pointIn(px, py, this.rect(), 4);
  };

  Mark.prototype.draw = function (ctx) {
    var x = this.x, y = this.y, p = this.pal;
    var stride = Math.sin(this.walk) * 2.4;       // leg swing
    var faceLeft = this.dir < 0;

    // Legs (alternating stride).
    px(ctx, x + 3, y + 26, 4, 8 - Math.max(0, stride), "#1b1e26");
    px(ctx, x + 9, y + 26, 4, 8 - Math.max(0, -stride), "#1b1e26");
    // Coat / torso.
    px(ctx, x + 2, y + 12, 12, 15, p.coat);
    // Arms.
    px(ctx, x, y + 13, 3, 11, p.coat);
    px(ctx, x + 13, y + 13, 3, 11, p.coat);
    // Head.
    px(ctx, x + 4, y + 1, 8, 9, p.skin);
    // Hair / hat band.
    px(ctx, x + 4, y, 8, 3, "#2a2f3a");
    // Facing hint (a small nose pixel).
    px(ctx, faceLeft ? x + 3 : x + 11, y + 5, 1, 2, "#c8a988");

    if (this.type === "target") {
      // Red armband + red hat band so the mark reads as "the contract".
      px(ctx, x + (faceLeft ? 0 : 13), y + 15, 3, 4, p.accent);
      px(ctx, x + 4, y, 8, 1, p.accent);
      // Faint target glow ring at the feet.
      ctx.save();
      ctx.globalAlpha = 0.35 + Math.sin(this.walk * 0.5) * 0.12;
      ctx.strokeStyle = p.accent;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(x + this.w / 2, y + this.h - 1, 10, 3, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    } else {
      // A small bag/briefcase so civilians read as ordinary passers-by.
      px(ctx, x + (faceLeft ? -2 : 15), y + 18, 3, 6, "#7a5a34");
    }
  };

  global.Entities = {
    Mark: Mark,
    overlaps: overlaps,
    pointIn: pointIn,
    px: px,
    MARK_W: MARK_W,
    MARK_H: MARK_H
  };
})(window);
