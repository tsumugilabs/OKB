# OKB 構成案（設計方針）

前作 `tsumugilabs/elevator-action` の `docs/HANDOFF.md` とエンジンを土台に、
**狙撃を主役にした護衛シューティング**として OKB を立ち上げる設計メモ。

## 1. コンセプト確定

| 項目 | 内容 |
| --- | --- |
| 仮タイトル | **OKB** |
| ジャンル | ストーリー型・護衛スナイパー |
| プレイヤー | 屋上の**スナイパー**（地上キャラは操作しない） |
| 護衛対象 | **前作の主人公**（潜入エージェント）。**自律的に**出口へ歩く |
| 主役の動詞 | 妨害に来る**敵をタップ狙撃**して護衛を守る |
| 演出方針 | 狙撃演出は残す／**GUILTY 劇画カットは基本省略**、**ボス限定**で発動 |
| 物語提示 | ステージ前後に**忍者龍剣伝ライク**の劇中劇（グラフィック＋テキスト） |
| 技術 | 素の JS + HTML5 Canvas、ビルド不要、Web Audio 合成音、モバイル対応 |

**転換点**：前々案（現れた標的を撃つ判断ゲーム）から、ユーザー指定により
**「護衛対象を狙撃で守る」**へ中心ループを作り替えた。前作主人公を護衛対象に
据えることで、two-game のナラティブが繋がる。

## 2. 中心ループ

```
CUTSCENE(章導入) → PLAY(護衛) → CUTSCENE(章締め) → 次章 … → ENDING
PLAY: 護衛対象が自律歩行で EXIT へ ／ 敵が妨害に出現 ／ プレイヤーがタップ狙撃
      → 敵に撃たれる/接触されると護衛HP減 ／ EXIT 到達で護衛成功 ／ HP0で失敗
```

### 緊張の設計（決め打ち・調整容易）
- **ボルトアクションのリロード**：1発ごとにクールダウン（既定 42f≒0.7s）。
  連打で全処理させず、**脅威の優先順位付け**を迫る。空撃ちも1発分消費。
- **通常キルは時間を止めない**：護衛ゲームなので他の脅威が動き続ける。
  タップ即キル＋ヒット演出のみ。**ボスだけ**世界を止めてギルティ演出。
- **敵2種**：`gunner`（予兆「!」→発砲＝護衛HP-1、以後再照準を反復）／
  `rusher`（護衛へ突進、接触で護衛HP-1）。

## 3. 状態機械（前作の `tick()` を踏襲）

```
STATE = { MENU, CUTSCENE, PLAY, RESULT, OVER, ENDING }
game.finisher   // ボスのGUILTY中だけ PLAY を凍結（前作 OKB 13 と同じ作法）
```

## 4. 再利用 / 改修 / 置換

| 前作モジュール | OKB | 区分 |
| --- | --- | --- |
| `game.js` 状態機械・`tick` | `game.js` | 再利用（着せ替え） |
| `game.js` OKB13 演出・`drawGuiltyCut` 一式 | `game.js` | **移植（ボス限定で温存）** |
| `audio.js` `Sound` | `audio.js` | 再利用＋SFX追加・再スコア |
| `input.js` `Input` | `input.js` | 改修（ポインタ照準＋タップ） |
| `entities.js` `overlaps`/AABB | `entities.js` | 再利用（敵タップ判定） |
| `entities.js` `Player/Enemy/moveAndCollide` | `entities.js` | 置換（`Escort`＋`Enemy`、重力なし） |
| `level.js` ビル・エレベーター | `scene.js` | **置換**（護衛ルート＋スポーン表） |
| ― | `cutscene.js` | 新規（劇中劇） |
| ― | `story.js` | 新規（台本データ） |

## 5. データ駆動の拡張点

- **シーン**（`scene.js`）：`{ name, ground, startX, exitX, exit, escortSpeed,
  escortHp, drawBg, spawns[] }`。`spawns` は
  `{ t, x|side, type("gunner"|"rusher"), dir, speed?, boss? }`。
- **劇中劇**（`cutscene.js` + `story.js`）：パネル配列
  `{ bg, figure?, figureX?, speaker?, text }`。背景・立ち絵はベクター描画キー。
- **章**（`story.js`）：`prologue / chapters[{intro,scene,outro}] / ending`。
  → シーン・章・台本は**データ追加だけで拡張**できる。

## 6. 伸びしろ（今後）

- **横スクロール化**：現状は1画面完結。護衛ルートを長くしてカメラ追従。
- **敵バリエーション**：人質を取る敵・盾持ち・護衛対象への偽装（誤射誘発）。
- **難易度**：`escortSpeed / escortHp / リロード長 / spawn密度`をパラメータ化し、
  前作の「周・面で難易度を返す純関数」思想を踏襲。
- **演出**：命中率ランク、章末リザルト、被弾時の画面効果。

## 7. デプロイ運用（前作 HANDOFF を踏襲）

1. `node --check js/*.js` で全 JS 構文チェック。
2. Playwright（headless Chromium）＋ `python3 -m http.server` で表示・通し確認。
3. 単一HTML（Artifact）化：CSS/JS を読み込み順にインライン（CSP対策・画像は data URI）。
   演出は**画像不使用の純ベクター**なので埋め込み不要。
4. Git：開発ブランチ → PR。GitHub Pages（`.nojekyll` あり）。

## 8. 作法（IP/著作権）

- 出自不明の既製画像は公開物へ埋め込まない。キャラ・背景・演出は**自前ベクター**で用意。
- 物語・固有名詞（エージェント／〈カゲロウ〉／〈鴉〉等）は本作のオリジナル。
  「忍者龍剣伝ライク」は**演出形式（劇中劇の作り）**の参照であり、素材の流用ではない。
