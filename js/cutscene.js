/**
 * Cutscene system for OKB — the between-stage storytelling, styled after the
 * Famicom "Ninja Gaiden" cinematics: a full-screen vector scene with a framed
 * dialogue box and typewriter text that advances panel by panel on tap.
 *
 * A script is `{ panels: [ { bg, figure?, figureX?, speaker?, text } ] }`.
 * `bg` and `figure` are keys into the BG / FIGURE art tables below. The game
 * holds one controller (from `make`) at a time, forwarding update/draw and
 * taps/Enter to advance. Everything is original vector art (no images).
 */
(function (global) {
  "use strict";

  var W = 512, H = 480;
  var px = (global.Entities && global.Entities.px) || function (ctx, x, y, w, h, c) {
    ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, w, h);
  };

  // ---- Background art -----------------------------------------------------

  function grad(ctx, stops) {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    for (var i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  function stars(ctx, n, y1) {
    ctx.fillStyle = "rgba(220,228,245,0.7)";
    for (var i = 0; i < n; i++) ctx.fillRect(i * 97 % W, 6 + (i * 53 % y1), 1, 1);
  }
  function farSkyline(ctx, baseY, color) {
    ctx.fillStyle = color;
    var bx = [-10, 50, 110, 170, 240, 310, 380, 450, 512];
    var bh = [130, 190, 110, 170, 120, 180, 130, 160];
    for (var c = 0; c < bx.length - 1; c++) ctx.fillRect(bx[c], baseY - bh[c], (bx[c + 1] - bx[c]) - 5, bh[c] + 40);
  }

  var BG = {
    black: function (ctx) { ctx.fillStyle = "#04060a"; ctx.fillRect(0, 0, W, H); },
    safehouse: function (ctx) {
      grad(ctx, [[0, "#14110c"], [1, "#0a0806"]]);
      // A dim room: a window with slat light and a hanging bulb glow.
      ctx.fillStyle = "#20242c"; ctx.fillRect(300, 60, 150, 120);
      ctx.fillStyle = "rgba(120,150,210,0.15)";
      for (var i = 0; i < 6; i++) ctx.fillRect(300, 66 + i * 20, 150, 8);
      var g = ctx.createRadialGradient(180, 90, 8, 180, 90, 130);
      g.addColorStop(0, "rgba(255,210,130,0.28)"); g.addColorStop(1, "rgba(255,210,130,0)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, 320);
      ctx.fillStyle = "#0c0a08"; ctx.fillRect(0, 300, W, H - 300);
    },
    harbor_night: function (ctx) {
      grad(ctx, [[0, "#0a1020"], [0.6, "#0e1830"], [1, "#0b111f"]]);
      stars(ctx, 90, 200);
      farSkyline(ctx, 320, "#111a2e");
      ctx.fillStyle = "#0d1a30"; ctx.fillRect(0, 330, W, 40);
      ctx.fillStyle = "#20242c"; ctx.fillRect(0, 370, W, H - 370);
    },
    alley_neon: function (ctx) {
      grad(ctx, [[0, "#160a1e"], [1, "#0c0713"]]);
      ctx.fillStyle = "#1a1424"; ctx.fillRect(0, 40, W, 330);
      for (var wy = 60; wy < 350; wy += 24)
        for (var wx = 14; wx < W; wx += 28)
          if ((wx + wy) % 3 === 0) { ctx.fillStyle = "rgba(255,196,120,0.5)"; ctx.fillRect(wx, wy, 10, 12); }
      ctx.save(); ctx.shadowColor = "#ff3b7b"; ctx.shadowBlur = 16;
      ctx.strokeStyle = "#ff3b7b"; ctx.lineWidth = 3; ctx.strokeRect(60, 100, 130, 40); ctx.restore();
      ctx.fillStyle = "#141019"; ctx.fillRect(0, 372, W, H - 372);
    },
    rooftop_dusk: function (ctx) {
      grad(ctx, [[0, "#241633"], [0.5, "#3a2140"], [1, "#160e1f"]]);
      var s = ctx.createRadialGradient(W * 0.7, 140, 10, W * 0.7, 140, 200);
      s.addColorStop(0, "rgba(255,150,90,0.45)"); s.addColorStop(1, "rgba(255,150,90,0)");
      ctx.fillStyle = s; ctx.fillRect(0, 0, W, 340);
      farSkyline(ctx, 350, "#1c1330");
      ctx.fillStyle = "#2a2130"; ctx.fillRect(0, 372, W, H - 372);
    },
    scope: function (ctx) {
      // OKB's point of view — a dark field with a faint reticle, for narration.
      ctx.fillStyle = "#05080d"; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "rgba(90,160,255,0.25)"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(W / 2, 200, 150, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(W / 2 - 170, 200); ctx.lineTo(W / 2 + 170, 200);
      ctx.moveTo(W / 2, 30); ctx.lineTo(W / 2, 370);
      ctx.stroke();
      ctx.fillStyle = "rgba(90,160,255,0.5)"; ctx.fillRect(W / 2 - 1, 199, 2, 2);
    }
  };

  // ---- Figures (standing characters, drawn in-scene) ----------------------

  var FIGURE = {
    // The escort — the previous game's protagonist: fedora + trench coat.
    agent: function (ctx, cx) {
      var y = 200, s = 3.4;
      ctx.save(); ctx.translate(cx, y); ctx.scale(s, s);
      px(ctx, -8, 40, 16, 6, "#20252e");            // shadow base
      px(ctx, -7, 12, 14, 30, "#2f4a6b");           // trench coat
      px(ctx, -9, 40, 18, 5, "#2f4a6b");
      px(ctx, -10, 14, 4, 20, "#28405c"); px(ctx, 6, 14, 4, 20, "#28405c"); // arms
      px(ctx, -5, 0, 10, 12, "#e7c8a0");            // face
      px(ctx, -8, -3, 16, 4, "#1c2129");            // hat brim
      px(ctx, -5, -8, 10, 6, "#232a34");            // hat crown
      px(ctx, -4, 4, 3, 2, "#20252e");              // eye shadow
      ctx.restore();
    },
    // OKB — the sniper, seen from behind/side with the long rifle.
    okb: function (ctx, cx) {
      var y = 200, s = 3.4;
      ctx.save(); ctx.translate(cx, y); ctx.scale(s, s);
      px(ctx, -8, 40, 16, 6, "#15181f");
      px(ctx, -7, 12, 14, 30, "#20242c");           // dark coat
      px(ctx, -5, 0, 10, 12, "#e7ebf1");            // pale face (profile)
      px(ctx, -6, -6, 12, 8, "#eef1f6");            // swept light hair
      px(ctx, 5, 6, 26, 3, "#0e1116");              // long rifle barrel
      px(ctx, 12, 3, 8, 4, "#12151b");              // scope
      px(ctx, -1, 8, 8, 4, "#161a22");              // stock/grip
      ctx.restore();
    },
    // The boss 〈鴉〉(Crow) — a tall silhouette with an orange glare.
    crow: function (ctx, cx) {
      var y = 196, s = 3.7;
      ctx.save(); ctx.translate(cx, y); ctx.scale(s, s);
      px(ctx, -9, 44, 18, 6, "#0c0a12");
      px(ctx, -8, 10, 16, 36, "#1a1520");           // long black coat
      px(ctx, -11, 12, 4, 24, "#141019"); px(ctx, 7, 12, 4, 24, "#141019");
      px(ctx, -5, -2, 10, 12, "#c9b79a");           // face
      px(ctx, -6, -7, 12, 6, "#0c0a12");            // hair
      px(ctx, -4, 2, 3, 2, "#ff9a2a"); px(ctx, 1, 2, 3, 2, "#ff9a2a"); // orange glare eyes
      ctx.restore();
    }
  };

  // ---- Controller ---------------------------------------------------------

  function wrap(ctx, text, maxW) {
    // Japanese has no spaces, so wrap per character by measured width.
    var lines = [], line = "";
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (ch === "\n") { lines.push(line); line = ""; continue; }
      if (ctx.measureText(line + ch).width > maxW && line) { lines.push(line); line = ""; }
      line += ch;
    }
    if (line) lines.push(line);
    return lines;
  }

  function make(script, opts) {
    opts = opts || {};
    return {
      script: script,
      idx: 0,
      char: 0,
      finished: false,
      blink: 0,

      panel: function () { return this.script.panels[this.idx]; },
      typing: function () { return this.char < this.panel().text.length; },

      update: function () {
        this.blink++;
        var p = this.panel();
        if (this.char < p.text.length) {
          this.char += 0.55;
          if (Math.floor(this.char) !== Math.floor(this.char - 0.55) && global.Sound)
            global.Sound.play("text");
        }
      },

      /** Skip to full line, or advance to the next panel / finish. */
      advance: function () {
        if (this.finished) return;
        var p = this.panel();
        if (global.Sound) global.Sound.play("ui");
        if (this.char < p.text.length) { this.char = p.text.length; return; }
        if (this.idx < this.script.panels.length - 1) { this.idx++; this.char = 0; }
        else { this.finished = true; }
      },

      draw: function (ctx) {
        var p = this.panel();
        (BG[p.bg] || BG.black)(ctx);
        if (p.figure && FIGURE[p.figure]) FIGURE[p.figure](ctx, p.figureX != null ? p.figureX : W / 2);

        // Letterbox to feel cinematic.
        ctx.fillStyle = "rgba(3,4,8,0.55)";
        ctx.fillRect(0, 0, W, 26); ctx.fillRect(0, H - 26, W, 26);

        // Dialogue box.
        var bx = 16, by = 344, bw = W - 32, bh = 112;
        ctx.fillStyle = "rgba(6,9,16,0.92)";
        roundRect(ctx, bx, by, bw, bh, 8); ctx.fill();
        ctx.strokeStyle = "#2a3852"; ctx.lineWidth = 2;
        roundRect(ctx, bx, by, bw, bh, 8); ctx.stroke();

        // Speaker name tab.
        if (p.speaker) {
          ctx.font = "bold 13px 'Courier New', monospace";
          var tw = ctx.measureText(p.speaker).width + 20;
          ctx.fillStyle = "#2a3852"; roundRect(ctx, bx + 12, by - 14, tw, 22, 5); ctx.fill();
          ctx.fillStyle = "#ffd166"; ctx.textAlign = "left";
          ctx.fillText(p.speaker, bx + 22, by + 1);
        }

        // Typewriter text.
        ctx.fillStyle = "#e6ecf5";
        ctx.font = "15px 'Hiragino Kaku Gothic ProN','Yu Gothic',sans-serif";
        ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
        var shown = p.text.slice(0, Math.floor(this.char));
        var lines = wrap(ctx, shown, bw - 36);
        for (var i = 0; i < lines.length; i++) ctx.fillText(lines[i], bx + 18, by + 30 + i * 24);

        // Blinking advance arrow when the line is fully shown.
        if (!this.typing() && (this.blink >> 4) % 2 === 0) {
          ctx.fillStyle = "#8aa0c0"; ctx.textAlign = "right";
          ctx.fillText("▼", bx + bw - 14, by + bh - 12);
        }
        ctx.textAlign = "left";
      }
    };
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  global.OKB_CUTSCENE = { make: make, BG: BG, FIGURE: FIGURE, W: W, H: H };
})(window);
