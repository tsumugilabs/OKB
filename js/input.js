/**
 * Input handling for OKB.
 *
 * The pointer only AIMS and toggles the scope — it never fires (tapping to
 * shoot nudged the aim off target). Firing and reloading are dedicated
 * controls: on-screen SHOT / RELOAD buttons and keys (Space/F = shot, R =
 * reload). This module reports:
 *   - the live reticle position (Input.aim), which persists after release,
 *   - SCOPE gestures via Input.takeGesture() → {kind:"in"|"out"|"toggle"}
 *     (pinch on touch, double-click on mouse),
 *   - edge-detected actions Input.pressed("shot"|"reload"|"start") from keys
 *     and bound buttons.
 */
(function (global) {
  "use strict";

  // Keyboard: advancing menus/cutscenes vs. the trigger/reload.
  var KEY_MAP = {
    Enter: "start", KeyZ: "start",
    Space: "shot", KeyF: "shot",
    KeyR: "reload"
  };
  var down = {}, last = {}, pending = {};   // pending = latched press edges

  function fireAction(action) { pending[action] = (pending[action] || 0) + 1; }  // one press
  function setAction(action, v) {
    if (!action) return;
    if (v && !down[action]) fireAction(action);   // latch on the up->down edge
    down[action] = v;
  }
  function onKey(e, isDown) {
    var action = KEY_MAP[e.code];
    if (!action) return;
    e.preventDefault();
    setAction(action, isDown);
  }
  window.addEventListener("keydown", function (e) { onKey(e, true); });
  window.addEventListener("keyup", function (e) { onKey(e, false); });
  window.addEventListener("blur", function () { down = {}; });

  // ---- Pointer / gestures (aim + scope toggle only) ----------------------

  var aim = { x: 256, y: 240, inside: false };
  var gestureQ = [];
  var pointers = {};
  var pinch = { active: false, start: 0, fired: false };
  var lastTap = { t: 0, x: 0, y: 0 };

  function count(o) { var n = 0; for (var k in o) if (o.hasOwnProperty(k)) n++; return n; }
  function twoPts() {
    var a = null, b = null;
    for (var k in pointers) { if (!pointers.hasOwnProperty(k)) continue; if (!a) a = pointers[k]; else if (!b) b = pointers[k]; }
    return [a, b];
  }
  function twoDist() { var t = twoPts(); return (t[0] && t[1]) ? Math.hypot(t[0].x - t[1].x, t[0].y - t[1].y) : 0; }
  function twoMid() { var t = twoPts(); return (t[0] && t[1]) ? { x: (t[0].x + t[1].x) / 2, y: (t[0].y + t[1].y) / 2 } : null; }

  var Input = {
    held: function (a) { return !!down[a]; },
    pressed: function (a) { return !!down[a] && !last[a]; },
    /** True once per press; latched so taps shorter than a frame aren't lost. */
    consume: function (a) { if (pending[a] > 0) { pending[a] = 0; return true; } return false; },
    endFrame: function () {
      for (var k in down) last[k] = down[k];
      for (var j in last) if (!(j in down)) last[j] = false;
    },
    reset: function () { down = {}; last = {}; pending = {}; gestureQ.length = 0; pointers = {}; pinch.active = false; },

    aim: function () { return aim; },
    setAim: function (x, y) { aim.x = x; aim.y = y; aim.inside = true; },
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
          if (d - pinch.start > 40) { var m = twoMid() || p; gestureQ.push({ kind: "in", x: m.x, y: m.y }); pinch.fired = true; }
          else if (pinch.start - d > 40) { gestureQ.push({ kind: "out" }); pinch.fired = true; }
        }
      });
      function endPointer(e) {
        var pt = pointers[e.pointerId];
        var wasPinch = pinch.active;
        delete pointers[e.pointerId];
        if (wasPinch) { if (count(pointers) < 2) pinch.active = false; return; }
        if (!pt) return;
        var now = Date.now(), p = toCanvas(e);
        if (now - pt.downT > 1500) return;
        // Double-click / double-tap toggles the scope. A single tap does NOT
        // fire (the reticle just stays where it was) — firing is the SHOT key/button.
        if (now - lastTap.t < 350 && Math.hypot(p.x - lastTap.x, p.y - lastTap.y) < 30) {
          gestureQ.push({ kind: "toggle", x: p.x, y: p.y });
          lastTap.t = 0;
        } else {
          lastTap = { t: now, x: p.x, y: p.y };
        }
      }
      canvas.addEventListener("pointerup", endPointer);
      canvas.addEventListener("pointercancel", function (e) { delete pointers[e.pointerId]; if (count(pointers) < 2) pinch.active = false; });
      canvas.addEventListener("pointerleave", function () { /* keep last aim; only mouse-out clears */ aim.inside = ("ontouchstart" in window) ? aim.inside : false; });
      canvas.addEventListener("contextmenu", function (e) { e.preventDefault(); });
    },

    /** Wire on-screen buttons (id -> action) into the same edge-detected state. */
    bindButtons: function (map) {
      Object.keys(map).forEach(function (id) {
        var el = document.getElementById(id);
        if (!el) return;
        var action = map[id];
        var press = function (e) { e.preventDefault(); setAction(action, true); el.classList.add("pressed"); };
        var release = function (e) { if (e) e.preventDefault(); setAction(action, false); el.classList.remove("pressed"); };
        el.addEventListener("pointerdown", press);
        el.addEventListener("pointerup", release);
        el.addEventListener("pointercancel", release);
        el.addEventListener("pointerleave", release);
        el.addEventListener("contextmenu", function (e) { e.preventDefault(); });
      });
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
