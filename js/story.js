/**
 * Story data for OKB — an original spy-noir arc delivered as short briefings
 * between missions. No existing IP; all names and events are invented for this
 * game. `game.js` reads this to drive the STORY overlay and chapter flow.
 *
 * Each chapter names a `scene` key (see scene.js) and carries `brief` lines
 * (shown before the mission) and `outro` lines (shown on success).
 */
(function (global) {
  "use strict";

  var Story = {
    title: "OKB",
    subtitle: "― 標的だけを、確実に ―",

    // Shown once at the very start (after START).
    prologue: [
      "コードネーム “OKB”。",
      "誰も本名を知らない、一挺の狙撃銃。",
      "受ける契約はただひとつ ―― 「有罪」の者だけ。",
      "今夜も、街のどこかで引き金を待つ者がいる。"
    ],

    chapters: [
      {
        id: 1,
        title: "第一章　港の受け渡し",
        scene: "harbor",
        brief: [
          "深夜の埠頭。密輸組織〈カゲロウ〉の受け渡しが行われる。",
          "標的は赤い腕章の男 ―― 取引の“帳簿”を持つ会計士。",
          "港湾労働者を巻き込むな。撃つのは標的だけだ。",
          "画面をタップ／クリックで狙撃。標的に照準を合わせろ。"
        ],
        outro: [
          "会計士は崩れ落ちた。帳簿は風に散る。",
          "だが、これは組織の“末端”に過ぎない。",
          "無線が鳴る ―― 次の契約だ。"
        ]
      },
      {
        id: 2,
        title: "第二章　夜の歓楽街",
        scene: "alley",
        brief: [
          "ネオンの路地裏。〈カゲロウ〉の実行部隊が動く。",
          "標的は複数 ―― 赤い腕章の実行犯たちだ。",
          "人波が多い。市民を撃てば、契約は破談。",
          "標的は足早だ。逃がす前に、確実に。"
        ],
        outro: [
          "実行犯は一人残らず沈黙した。",
          "路地に残ったのは、いつもの静けさだけ。",
          "組織の頭は、あの塔の上にいる。"
        ]
      },
      {
        id: 3,
        title: "終章　塔上の首魁",
        scene: "tower",
        brief: [
          "摩天楼の屋上。〈カゲロウ〉を統べる男 ―― 通称〈鴉(からす)〉。",
          "護衛が周囲を固める。標的は、その中心にいる赤い影。",
          "護衛も市民ではない ―― だが撃つべきは首魁だけだ。",
          "一発で決めろ。二度目のチャンスはない。"
        ],
        outro: [
          "〈鴉〉は最後まで、こちらを見なかった。",
          "有罪の判決は、すでに下されていた。",
          "OKB は銃を畳み、また夜の中へ消える。"
        ]
      }
    ],

    ending: [
      "―― こうして、ひとつの契約が閉じた。",
      "街は何も知らないまま、朝を迎える。",
      "OKB は、次の“有罪”を待っている。",
      "《 OKB ―― 完 》"
    ]
  };

  global.OKB_STORY = Story;
})(window);
