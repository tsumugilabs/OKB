/**
 * Build the single-file, self-contained release of the FULL OKB campaign
 * (all 3 chapters). Same idea as build-teststage.js, but inlines the real
 * scene.js + story.js instead of the single-stage override.
 *
 * No external resources (Web Audio synthesized, vector art only), so it runs
 * offline / under a strict CSP — publishable as an Artifact or opened directly.
 *
 *   node tools/build-single.js   ->   writes ./okb.html and ./okb.artifact.html
 */
"use strict";
var fs = require("fs");
var path = require("path");

var root = path.join(__dirname, "..");
function read(p) { return fs.readFileSync(path.join(root, p), "utf8"); }

var css = read("css/style.css");
var js = [
  "js/audio.js",
  "js/input.js",
  "js/entities.js",
  "js/scene.js",
  "js/cutscene.js",
  "js/story.js",
  "js/game.js"
].map(read).join("\n");

var favicon = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Crect width='16' height='16' fill='%230b0d14'/%3E%3Ccircle cx='8' cy='8' r='6' fill='none' stroke='%23ff4040' stroke-width='1'/%3E%3Cline x1='8' y1='1' x2='8' y2='15' stroke='%23ff4040' stroke-width='1'/%3E%3Cline x1='1' y1='8' x2='15' y2='8' stroke='%23ff4040' stroke-width='1'/%3E%3C/svg%3E";

var body =
'  <div id="game-wrapper">\n' +
'    <header id="hud">\n' +
'      <span class="hud-item">CH <b id="hud-mission">1</b>/4</span>\n' +
'      <span class="hud-item">SCORE <b id="hud-score">0</b></span>\n' +
'      <span class="hud-item">HI <b id="hud-hi">0</b></span>\n' +
'      <span class="hud-item">護衛HP <b id="hud-hp">-</b>/<b id="hud-hp-max">-</b></span>\n' +
'      <span class="hud-item">進行 <b id="hud-dist">0</b>%</span>\n' +
'      <span class="hud-item"><b id="hud-note">誤射 0/3</b></span>\n' +
'      <button id="sound-toggle" type="button" title="サウンド ON/OFF (M)">🔊</button>\n' +
'    </header>\n' +
'    <div id="stage">\n' +
'      <canvas id="game" width="512" height="480"></canvas>\n' +
'      <div id="overlay" class="overlay menu"><h1>OKB</h1><p class="subtitle">護衛スナイパー</p><p class="lede">読み込み中…</p></div>\n' +
'    </div>\n' +
'    <p id="hint">ダブルクリック／ピンチインでスコープ → 照準を合わせてクリック／タップで狙撃 ／ M: サウンド</p>\n' +
'  </div>\n';

var styleTag = '<style>\n' + css + '\n</style>\n';
var scriptTag = '<script>\n' + js + '\n</' + 'script>\n';

// (1) Full standalone document.
var html =
'<!DOCTYPE html>\n<html lang="ja">\n<head>\n' +
'  <meta charset="UTF-8" />\n' +
'  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />\n' +
'  <title>OKB — 護衛スナイパー（全3章）</title>\n' +
'  <link rel="icon" href="' + favicon + '" />\n' +
'  ' + styleTag +
'</head>\n<body>\n' + body + scriptTag + '</body>\n</html>\n';
fs.writeFileSync(path.join(root, "okb.html"), html);
console.log("wrote okb.html (" + html.length + " bytes)");

// (2) Body-only fragment for publishing as an Artifact.
var fragment = styleTag + body + scriptTag;
fs.writeFileSync(path.join(root, "okb.artifact.html"), fragment);
console.log("wrote okb.artifact.html (" + fragment.length + " bytes)");
