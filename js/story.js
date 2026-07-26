/**
 * Story data for OKB — an original escort-sniper arc with a betrayal finale,
 * told through Ninja Gaiden-style cutscenes (see cutscene.js). No existing IP;
 * all names and events are invented for this game.
 *
 * OKB is a sniper hired to protect an ESCORT — the protagonist of the previous
 * game (an infiltration agent), who walks Ch.1–3 autonomously to each exit
 * while OKB clears the syndicate 〈カゲロウ〉 and its head 〈鴉(からす)〉. In the
 * finale the agent turns TRAITOR, and OKB must hunt down the man he protected
 * as he flees cover-to-cover across the rooftops.
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
      { bg: "safehouse", speaker: "通信", text: "「OKB。今回は暗殺じゃない ―― 護衛だ。」" },
      { bg: "safehouse", figure: "agent", figureX: 300, speaker: "通信",
        text: "「対象は“エージェント”。組織〈カゲロウ〉の機密を持って街を横断する。」" },
      { bg: "scope", speaker: "通信", text: "「屋根の上から露払いをしろ。奴を出口まで、無傷で通せ。」" },
      { bg: "scope", speaker: "OKB", text: "「……了解。撃つのは、対象の邪魔をする者だけだ。」" }
    ]},

    chapters: [
      {
        id: 1, title: "第一章　港の脱出艇", scene: "harbor",
        intro: { panels: [
          { bg: "harbor_night", figure: "agent", figureX: 150, speaker: "エージェント",
            text: "「聞こえてるか、狙撃手。俺は港の脱出艇へ向かう。頼りにしてるぞ。」" },
          { bg: "scope", speaker: "OKB", text: "「歩け。前だけ見ていろ。背後は、俺が撃つ。」" }
        ]},
        outro: { panels: [
          { bg: "harbor_night", figure: "agent", figureX: 360, speaker: "エージェント",
            text: "「助かった。噂どおりの腕だな。」" },
          { bg: "scope", speaker: "OKB", text: "「まだ半分だ。次は気を抜くな。」" }
        ]}
      },
      {
        id: 2, title: "第二章　歓楽街の路地", scene: "alley",
        intro: { panels: [
          { bg: "alley_neon", figure: "agent", figureX: 150, speaker: "エージェント",
            text: "「人目が多い。だが敵も、その中に紛れてる。突っ込んでくる奴もいるぞ。」" },
          { bg: "scope", speaker: "OKB", text: "「近づかれる前に、落とす。」" }
        ]},
        outro: { panels: [
          { bg: "alley_neon", figure: "agent", figureX: 360, speaker: "エージェント",
            text: "「路地を抜けた。残るは、あの塔 ―― 〈鴉〉の巣だけだ。」" },
          { bg: "scope", speaker: "OKB", text: "「頭を狙う。“鴉”の首を、な。」" }
        ]}
      },
      {
        id: 3, title: "第三章　塔上の首魁", scene: "tower",
        intro: { panels: [
          { bg: "rooftop_dusk", figure: "crow", figureX: 380, speaker: "〈鴉〉",
            text: "「よくぞここまで。だが屋上から先へは、行かせん。」" },
          { bg: "rooftop_dusk", figure: "agent", figureX: 140, speaker: "エージェント",
            text: "「ヘリまで走る。狙撃手 ―― 首魁を頼む。」" },
          { bg: "scope", speaker: "OKB", text: "「〈鴉〉。お前が、この夜の“有罪”だ。」" }
        ]},
        outro: { panels: [
          { bg: "rooftop_dusk", speaker: "OKB", text: "「首魁は落とした。対象は機密を確保 ―― 任務完了、のはずだった。」" },
          { bg: "black", speaker: "通信", text: "「……OKB、待て。妙だ。機密の信号が、まだ動いて ―― ぐっ」" },
          { bg: "black", speaker: "OKB", text: "「通信? ……おい、応答しろ。……切れた。」" }
        ]}
      },
      {
        id: 4, title: "終章　裏切り", scene: "betrayal",
        intro: { panels: [
          { bg: "rooftop_dusk", figure: "traitor", figureX: 300, speaker: "エージェント",
            text: "「悪いな、狙撃手。“護衛対象”は、最初から俺の芝居さ。」" },
          { bg: "rooftop_dusk", figure: "traitor", figureX: 300, speaker: "エージェント",
            text: "「〈鴉〉も、あんたも、機密を奪うための駒だ。通信士には眠ってもらった。」" },
          { bg: "scope", speaker: "通信", text: "「（別回線）…OKB、生きてるか。契約変更だ。標的 ―― さっきまでの護衛対象。」" },
          { bg: "scope", speaker: "OKB",
            text: "「守ってきた背中を、撃つ、か。……いいだろう。今度こそ、有罪だ。」" },
          { bg: "scope", speaker: "OKB",
            text: "「奴は物陰を渡って逃げる。露出した一瞬を捉えろ。逃がせば、終わりだ。」" }
        ]},
        outro: { panels: [
          { bg: "rooftop_dusk", speaker: "OKB", text: "「……逃げ場はない。お前の芝居も、ここまでだ。」" }
        ]}
      }
    ],

    ending: { panels: [
      { bg: "scope", speaker: "OKB", text: "「標的排除。機密は回収 ―― 契約は、果たした。」" },
      { bg: "rooftop_dusk", text: "夜明け前。守るはずだった背中は、もう動かない。" },
      { bg: "black", text: "信じた相手を撃つのも、仕事のうち。OKB はまた、次の“有罪”を待つ。" },
      { bg: "black", text: "《 OKB ―― 完 》" }
    ]}
  };

  global.OKB_STORY = Story;
})(window);
