/**
 * Input handling for OKB.
 *
 * OKB is aimed with a pointer, and — as of the "scoped sniper" model — shots
 * only land while looking through the scope. So this module reports:
 *   - the live reticle position (Input.aim),
 *   - FIRE taps (single click / single-finger tap-or-drag release), and
 *   - SCOPE gestures: pinch-in / pinch-out (touch) and double-click (mouse),
 *     surfaced via Input.takeGesture() as {kind:"in"|"out"|"toggle"}.
 *
 * Keyboard edge-detection (`pressed`) is kept for advancing menus/cutscenes.
 */
(function (global) {
  "use strict";

  var KEY_MAP = { Enter: "start", Space: "start", KeyZ: "start" };
  var down = {}, last = {};

  function onKey(e, isDown) {
    var action = KEY_MAP[e.code];
    if (!action) return;
    e.preventDefault();
    down[action] = isDown;
  }
  window.addEventListener("keydown", function (e) { onKey(e, true); });
  window.addEventListener("keyup", function (e) { onKey(e, false); });
  window.addEventListener("blur", function () { down = {}; });

  // ---- Pointer / gestures -------------------------------------------------

  var aim = { x: 256, y: 240, inside: false };
  var fireQ = [];      // {x,y} canvas-space fire taps
  var gestureQ = [];   // {kind:"in"|"out"|"toggle"}
  var pointers = {};   // active pointers by id
  var pinch = { active: false, start: 0, fired: false };
  var lastTap = { t: 0, x: 0, y: 0 };

  function count(o) { var n = 0; for (var k in o) if (o.hasOwnProperty(k)) n++; return n; }
  function twoDist() {
    var a = null, b = null;
    for (var k in pointers) { if (!pointers.hasOwnProperty(k)) continue; if (!a) a = pointers[k]; else if (!b) b = pointers[k]; }
    if (!a || !b) return 0;
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  var Input = {
    held: function (a) { return !!down[a]; },
    pressed: function (a) { return !!down[a] && !last[a]; },
    endFrame: function () {
      for (var k in down) last[k] = down[k];
      for (var j in last) if (!(j in down)) last[j] = false;
    },
    reset: function () { down = {}; last = {}; fireQ.length = 0; gestureQ.length = 0; pointers = {}; pinch.active = false; },

    aim: function () { return aim; },
    takeFire: function () { return fireQ.length ? fireQ.shift() : null; },
    takeGesture: function () { return gestureQ.length ? gestureQ.shift() : null; },

    bindPointer: function (canvas) {
      function toCanvas(e) {
        var r = canvas.getBoundingClientRect();
        return { x: (e.clientX - r.left) * (canvas.width / r.width), y: (e.clientY - r.top) * (canvas.height / r.height) };
      }
      canvas.addEventListener("pointerdown", function (e) {
        e.preventDefault();
        var p = toCanvas(e);
        pointers[e.pointerId] = { x: p.x, y: p.y, downX: p.x, downY: p.y, downT: Date.now() };
        aim.x = p.x; aim.y = p.y; aim.inside = true;
        if (count(pointers) >= 2) { pinch.active = true; pinch.fired = false; pinch.start = twoDist(); }
      });
      canvas.addEventListener("pointermove", function (e) {
        var p = toCanvas(e);
        if (pointers[e.pointerId]) { pointers[e.pointerId].x = p.x; pointers[e.pointerId].y = p.y; }
        if (count(pointers) < 2) { aim.x = p.x; aim.y = p.y; aim.inside = true; }
        if (pinch.active && count(pointers) >= 2 && !pinch.fired) {
          var d = twoDist();
          if (d - pinch.start > 40) { gestureQ.push({ kind: "in" }); pinch.fired = true; }
          else if (pinch.start - d > 40) { gestureQ.push({ kind: "out" }); pinch.fired = true; }
        }
      });
      function endPointer(e) {
        var pt = pointers[e.pointerId];
        var wasPinch = pinch.active;
        delete pointers[e.pointerId];
        if (wasPinch) { if (count(pointers) < 2) pinch.active = false; return; } // pinch fingers never fire
        if (!pt) return;
        var now = Date.now(), p = toCanvas(e);
        if (now - pt.downT > 1500) return;   // stale / long hold — ignore
        // Double-click / double-tap toggles the scope; a single tap fires.
        if (now - lastTap.t < 350 && Math.hypot(p.x - lastTap.x, p.y - lastTap.y) < 30) {
          gestureQ.push({ kind: "toggle" });
          lastTap.t = 0;
        } else {
          fireQ.push({ x: p.x, y: p.y });
          lastTap = { t: now, x: p.x, y: p.y };
        }
      }
      canvas.addEventListener("pointerup", endPointer);
      canvas.addEventListener("pointercancel", function (e) { delete pointers[e.pointerId]; if (count(pointers) < 2) pinch.active = false; });
      canvas.addEventListener("contextmenu", function (e) { e.preventDefault(); });
    }
  };

  global.Input = Input;

  function init() {
    var touch = ("ontouchstart" in window) || (window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
    if (touch && document.body) document.body.classList.add("touch");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})(window);
