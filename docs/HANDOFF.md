# 引き継ぎメモ（OKB）

このリポジトリ OKB は、`tsumugilabs/elevator-action` の `docs/HANDOFF.md` と
エンジン（input/entities/level/game/audio）を土台に立ち上げた**別ゲーム**。
狙撃演出を主役にしたストーリー型スナイパー。設計方針は `docs/DESIGN.md` を参照。

- 参照元: https://github.com/tsumugilabs/elevator-action
- 参照元の完成コミット: `63f3a6c`（Elevator Action ブラウザ版）

## 技術スタックと方針（前作から継承）

- **素の JavaScript + HTML5 Canvas**。ビルド不要、`index.html` を開けば動く。
- JS は **ES5 風の IIFE**（`(function (global) { ... })(window)`）で `window` に公開
  （`Sound` / `Input` / `Entities` / `OKB_SCENE` / `OKB_STORY`、本体は `window.__OKB`）。
- 音は**音声ファイルを持たず** Web Audio API でその場合成（`js/audio.js`）。
- モバイル対応：ポインタ（タッチ）で照準＆タップ射撃。coarse-pointer 判定あり。

## ファイル構成（役割）

```
index.html      … エントリ（HUD・オーバーレイ・<script>読み込み順）
css/style.css   … スタイル（オーバーレイ / ストーリー / 結果画面）
js/audio.js     … 合成SFX・BGM（Sound.play(name) / BGM制御）※前作から移植・再スコア
js/input.js     … ポインタ照準（Input.aim/takeFire）＋キーボード（advance）
js/entities.js  … 標的 Mark と AABB ヒットテスト（overlaps / pointIn）
js/scene.js     … ミッションのシーン背景＋標的スポーン表（前作 level.js の置換）
js/story.js     … 章立てストーリーデータ
js/game.js      … メインループ / 状態機械 / 狙撃コア / GUILTY演出（前作から移植）
```

読み込み順は **audio → input → entities → scene → story → game**（依存順）。

## 前作からそのまま流用した仕組み

- **状態機械 + 1本の `tick()`**：`STATE = { MENU, STORY, PLAY, RESULT, OVER, ENDING }`。
  狙撃演出中（`game.snipe`）はゲーム時間を止める（前作 OKB 13 と同じ作法）。
- **AABB**：`overlaps` / `pointIn`（`js/entities.js`）をタップ判定に転用。
- **入力抽象**：アクション名で参照。前作の十字キー→本作はポインタ照準＋タップ。
- **合成オーディオ**：`Sound.play("snipe")` 等。BGM は音符配列なので採譜で差し替え可。
- **OKB 狙撃演出**：`drawGuiltyCut` 一式（雲/ハッチング/塔/銃/スナイパー顔/吹き出し）を
  **画像不使用の純ベクター**のまま移植。演出フェーズは `SNIPE = {zoom,aim,guilty,fire,after}`。

## 置き換えた部分

- `level.js`（ビル・エレベーター・階段・重力）→ `scene.js`（1画面シーン＋スポーン表）。
- 平面アクションの `Player/Enemy/Bullet/moveAndCollide` は不使用。
- BGM を A-minor 疾走調 → D-minor の静かなスパイ調に再スコア。

## デプロイ／ビルド運用（前作と同手順）

1. `node --check js/*.js` で全JSの構文チェック。
2. Playwright で表示確認（headless Chromium）:
   - `executablePath: '/opt/pw-browsers/chromium'`、`python3 -m http.server <port>` で配信。
3. **単一HTML（Artifact）ビルド**：CSS と全JSを読み込み順にインラインして1ファイル化。
   - CSP により外部リソース不可。画像を使うなら data URI 埋め込み。
   - 現状は画像不使用の純ベクターなので埋め込みは無し。
4. Git：開発ブランチ → PR。
5. **GitHub Pages**（deploy from branch、`.nojekyll` あり）。

## 注意・作法

- **IP/著作権**：出自の確認できない既製の絵は公開物へ埋め込まない。自前ベクター描画で対応。
- 単一HTML版は**CSPで外部通信不可**。フォント/画像/スクリプトは全てインライン化。
- レスポンシブ：`@media (max-width:400px)` で HUD/見出しを調整済み。

## 次にやると良いこと（`docs/DESIGN.md` の伸びしろ）

- 標的の識別ギミック（変装・入れ替わり・人質）、弾数/風/偏差などの制約、リザルト強化。
- シーン・章はデータ追加だけで増やせる（`scene.js` / `story.js`）。
