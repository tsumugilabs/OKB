/**
 * Story data for OKB — an original escort-sniper arc told through Ninja
 * Gaiden-style cutscenes (see cutscene.js). No existing IP; all names and
 * events are invented for this game.
 *
 * OKB is a sniper hired to protect an ESCORT — the protagonist of the previous
 * game (an infiltration agent), who now walks each stage autonomously toward
 * the exit while OKB clears the threats. The syndicate 〈カゲロウ〉 wants the
 * agent dead; its head is 〈鴉(からす)〉.
 *
 * Each entry is a `{ panels: [...] }` script consumed by OKB_CUTSCENE.make.
 * A panel is `{ bg, figure?, figureX?, speaker?, text }`.
 */
(function (global) {
  "use strict";

  var Story = {
    title: "OKB",
    subtitle: "― 護衛対象を、狙撃で守れ ―",

    prologue: { panels: [
      { bg: "safehouse", speaker: "通信", text: "「OKB。新しい契約だ。今回は“暗殺”じゃない ―― 護衛だ。」" },
      { bg: "safehouse", figure: "agent", figureX: 300, speaker: "通信",
        text: "「対象は一人。“エージェント”で通る男。機密を持って街を横断する。」" },
      { bg: "scope", speaker: "通信", text: "「お前は屋根の上から“露払い”をしろ。奴を出口まで、無傷で通せ。」" },
      { bg: "scope", speaker: "OKB", text: "「……了解。撃つのは、対象の邪魔をする者だけだ。」" }
    ]},

    chapters: [
      {
        id: 1,
        title: "第一章　港の脱出艇",
        scene: "harbor",
        intro: { panels: [
          { bg: "harbor_night", figure: "agent", figureX: 150, speaker: "エージェント",
            text: "「聞こえてるか、狙撃手。俺は港の脱出艇へ向かう。」" },
          { bg: "harbor_night", figure: "agent", figureX: 150, speaker: "エージェント",
            text: "「敵がどこから来るかは分からん。……頼りにしてるぞ。」" },
          { bg: "scope", speaker: "OKB",
            text: "「歩け。前だけ見ていろ。背後は、俺が撃つ。」" }
        ]},
        outro: { panels: [
          { bg: "harbor_night", figure: "agent", figureX: 360, speaker: "エージェント",
            text: "「……助かった。噂どおりの腕だな。」" },
          { bg: "scope", speaker: "OKB", text: "「まだ半分だ。次は気を抜くな。」" }
        ]}
      },
      {
        id: 2,
        title: "第二章　歓楽街の路地",
        scene: "alley",
        intro: { panels: [
          { bg: "alley_neon", figure: "agent", figureX: 150, speaker: "エージェント",
            text: "「ここからは人目が多い。だが敵も、その中に紛れてる。」" },
          { bg: "alley_neon", speaker: "通信",
            text: "「〈カゲロウ〉の実行部隊だ。中には構わず突っ込んでくる奴もいる。」" },
          { bg: "scope", speaker: "OKB", text: "「近づかれる前に、落とす。」" }
        ]},
        outro: { panels: [
          { bg: "alley_neon", figure: "agent", figureX: 360, speaker: "エージェント",
            text: "「路地を抜けた。……残るは、あの塔だけだ。」" },
          { bg: "scope", speaker: "OKB", text: "「頭を狙う。“鴉”の首を、な。」" }
        ]}
      },
      {
        id: 3,
        title: "終章　塔上の首魁",
        scene: "tower",
        intro: { panels: [
          { bg: "rooftop_dusk", figure: "crow", figureX: 380, speaker: "〈鴉〉",
            text: "「よくぞここまで。だが屋上から先へは、行かせん。」" },
          { bg: "rooftop_dusk", figure: "agent", figureX: 140, speaker: "エージェント",
            text: "「ヘリまで走る。狙撃手 ―― 最後の援護を頼む。」" },
          { bg: "scope", speaker: "OKB", text: "「〈鴉〉。お前が、この夜の“有罪”だ。」" }
        ]},
        outro: { panels: [
          { bg: "rooftop_dusk", figure: "agent", figureX: 360, speaker: "エージェント",
            text: "「ヘリに乗った。……世話になったな、OKB。」" },
          { bg: "scope", speaker: "OKB", text: "「達者でな。次の“有罪”が、また俺を呼ぶ。」" }
        ]}
      }
    ],

    ending: { panels: [
      { bg: "harbor_night", text: "―― 夜明け前。街は何も知らないまま、静けさを取り戻す。" },
      { bg: "scope", speaker: "OKB", text: "「護衛対象、脱出を確認。……契約完了だ。」" },
      { bg: "black", text: "《 OKB ―― 完 》" }
    ]}
  };

  global.OKB_STORY = Story;
})(window);
