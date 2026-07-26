/**
 * Build the single-file, self-contained TEST BUILD of OKB.
 *
 * Concatenates the real engine (css + audio/input/entities/cutscene + game.js)
 * and injects the single-stage override (test/okb-teststage.js) in place of the
 * full scene.js/story.js. The result, teststage.html, has no external resources
 * (Web Audio synthesized, vector art only), so it runs offline and satisfies a
 * strict CSP — i.e. it can be published as an Artifact or opened directly.
 *
 *   node tools/build-teststage.js   ->   writes ./teststage.html
 */
"use strict";
var fs = require("fs");
var path = require("path");

var root = path.join(__dirname, "..");
function read(p) { return fs.readFileSync(path.join(root, p), "utf8"); }

var css = read("css/style.css");
// Engine load order, with the single-stage data replacing scene.js + story.js.
var js = [
  "js/audio.js",
  "js/input.js",
  "js/entities.js",
  "js/cutscene.js",
  "test/okb-teststage.js",
  "js/game.js"
].map(read).join("\n");

var favicon = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Crect width='16' height='16' fill='%230b0d14'/%3E%3Ccircle cx='8' cy='8' r='6' fill='none' stroke='%23ff4040' stroke-width='1'/%3E%3Cline x1='8' y1='1' x2='8' y2='15' stroke='%23ff4040' stroke-width='1'/%3E%3Cline x1='1' y1='8' x2='15' y2='8' stroke='%23ff4040' stroke-width='1'/%3E%3C/svg%3E";

// Shared page body: HUD + canvas + overlay + hint.
var body =
'  <div id="game-wrapper">\n' +
'    <header id="hud">\n' +
'      <span class="hud-item">CH <b id="hud-mission">1</b>/1</span>\n' +
'      <span class="hud-item">SCORE <b id="hud-score">0</b></span>\n' +
'      <span class="hud-item">HI <b id="hud-hi">0</b></span>\n' +
'      <span class="hud-item">護衛HP <b id="hud-hp">-</b>/<b id="hud-hp-max">-</b></span>\n' +
'      <span class="hud-item">進行 <b id="hud-dist">0</b>%</span>\n' +
'      <button id="sound-toggle" type="button" title="サウンド ON/OFF (M)">🔊</button>\n' +
'    </header>\n' +
'    <div id="stage">\n' +
'      <canvas id="game" width="512" height="480"></canvas>\n' +
'      <div id="overlay" class="overlay menu"><h1>OKB</h1><p class="subtitle">テストステージ</p><p class="lede">読み込み中…</p></div>\n' +
'    </div>\n' +
'    <p id="hint">画面をタップ／クリックで敵を狙撃（1発ごとにリロード） ／ 護衛対象を守れ ／ M: サウンド</p>\n' +
'  </div>\n';

var styleTag = '<style>\n' + css + '\n</style>\n';
var scriptTag = '<script>\n' + js + '\n</' + 'script>\n';

// (1) Full standalone document — open directly in a browser.
var html =
'<!DOCTYPE html>\n<html lang="ja">\n<head>\n' +
'  <meta charset="UTF-8" />\n' +
'  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />\n' +
'  <title>OKB — 護衛スナイパー（テストステージ）</title>\n' +
'  <link rel="icon" href="' + favicon + '" />\n' +
'  ' + styleTag +
'</head>\n<body>\n' + body + scriptTag + '</body>\n</html>\n';
fs.writeFileSync(path.join(root, "teststage.html"), html);
console.log("wrote teststage.html (" + html.length + " bytes)");

// (2) Body-only fragment — for publishing as an Artifact (the host supplies
//     the <!doctype>/<head>/<body> skeleton, so no outer tags here).
var fragment = styleTag + body + scriptTag;
fs.writeFileSync(path.join(root, "teststage.artifact.html"), fragment);
console.log("wrote teststage.artifact.html (" + fragment.length + " bytes)");
