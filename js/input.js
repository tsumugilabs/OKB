/**
 * Input handling for OKB.
 *
 * Unlike the platformer this engine came from, OKB is aimed with a pointer:
 * the player moves a reticle over the scene and taps/clicks to fire. So this
 * module tracks (a) a small set of keyboard actions for menus/story, and
 * (b) the live pointer position over the game canvas plus a one-shot "fire"
 * edge, which the game reads each frame.
 *
 * Keyboard edge-detection (`pressed`) is kept from the original engine so
 * single-fire actions like "advance"/"start" don't auto-repeat.
 */
(function (global) {
  "use strict";

  var KEY_MAP = {
    Enter: "start",
    Space: "start",
    KeyZ: "start"
  };

  var down = {};   // currently held
  var last = {};   // held state at the end of the previous frame

  function onKey(e, isDown) {
    var action = KEY_MAP[e.code];
    if (!action) return;
    e.preventDefault();
    down[action] = isDown;
  }

  window.addEventListener("keydown", function (e) { onKey(e, true); });
  window.addEventListener("keyup", function (e) { onKey(e, false); });
  window.addEventListener("blur", function () { down = {}; });

  // ---- Pointer aiming -----------------------------------------------------

  // Reticle position in canvas pixels, and a fire edge consumed by the game.
  var aim = { x: 256, y: 240, inside: false };
  var fireQueue = [];   // canvas-space {x,y} taps waiting to be handled

  var Input = {
    /** True while `action` is held. */
    held: function (action) { return !!down[action]; },

    /** True only on the frame `action` transitions from up to down. */
    pressed: function (action) { return !!down[action] && !last[action]; },

    /** Snapshot held-state; call once at the end of every frame. */
    endFrame: function () {
      for (var k in down) last[k] = down[k];
      for (var j in last) if (!(j in down)) last[j] = false;
    },

    reset: function () { down = {}; last = {}; fireQueue.length = 0; },

    /** Current reticle position (canvas pixels) and whether it's over the canvas. */
    aim: function () { return aim; },

    /** Pull the next queued tap (canvas-space {x,y}) or null. */
    takeFire: function () { return fireQueue.length ? fireQueue.shift() : null; },

    /**
     * Bind pointer events on the game canvas so both mouse and touch drive the
     * reticle and produce fire taps. Pointer Events unify the two.
     */
    bindPointer: function (canvas) {
      function toCanvas(e) {
        var rect = canvas.getBoundingClientRect();
        return {
          x: (e.clientX - rect.left) * (canvas.width / rect.width),
          y: (e.clientY - rect.top) * (canvas.height / rect.height)
        };
      }
      canvas.addEventListener("pointermove", function (e) {
        var p = toCanvas(e);
        aim.x = p.x; aim.y = p.y; aim.inside = true;
      });
      canvas.addEventListener("pointerleave", function () { aim.inside = false; });
      canvas.addEventListener("pointerdown", function (e) {
        e.preventDefault();
        var p = toCanvas(e);
        aim.x = p.x; aim.y = p.y; aim.inside = true;
        fireQueue.push(p);
      });
      canvas.addEventListener("contextmenu", function (e) { e.preventDefault(); });
    }
  };

  global.Input = Input;

  // Flag coarse-pointer (touch) devices so the layout can adapt.
  function init() {
    var touch = ("ontouchstart" in window) ||
      (window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
    if (touch && document.body) document.body.classList.add("touch");
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(window);
