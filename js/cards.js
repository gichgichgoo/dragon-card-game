export const CARDS = {
  spark: { name: "火花", icon: "✨", type: "spell", tier: "basic", desc: "相手に1ダメージ。", threat: 4 },
  heal: { name: "治癒の雫", icon: "💧", type: "spell", tier: "basic", desc: "自分のライフを1回復（最大4）。", threat: 2 },
  study: { name: "魔力研究", icon: "🔮", type: "spell", tier: "basic", desc: "カードを2枚引く。", threat: 4 },
  steal: { name: "風さらい", icon: "🌪️", type: "spell", tier: "basic", desc: "相手の手札をランダムに1枚捨てる。", threat: 4 },
  ward: { name: "賢者の結界", icon: "🛡️", type: "spell", tier: "basic", desc: "打消を1つ回復（最大3）。", threat: 4 },
  cycle: { name: "魔力循環", icon: "♻️", type: "spell", tier: "basic", desc: "2枚引き、手札を1枚捨てる。", threat: 4 },

  recall: { name: "記憶の糸", icon: "🧵", type: "spell", tier: "tactical", desc: "自分の捨て札から好きなカード1枚を手札に加える。", threat: 5 },
  foresee: { name: "星読み", icon: "🌟", type: "spell", tier: "tactical", desc: "自分の山札から好きなカード1枚を選び、手札に加える。", threat: 7 },
  echo: { name: "連唱", icon: "🎶", type: "spell", tier: "tactical", desc: "このターンのカード使用上限を2増やす。", threat: 3 },
  banish: { name: "竜払い", icon: "⚔️", type: "spell", tier: "tactical", desc: "相手の場のドラゴン1体を選んで捨てる。", threat: 7 },
  surge: { name: "知識の奔流", icon: "🌊", type: "spell", tier: "tactical", desc: "3枚引き、手札を2枚捨てる。", threat: 5 },
  fog: { name: "封魔の霧", icon: "🌫️", type: "spell", tier: "tactical", desc: "相手の次のターンのカード使用上限を1減らす。", threat: 6 },

  inferno: { name: "業火", icon: "🔥", type: "spell", tier: "powerful", desc: "相手に2ダメージ。ただし自分も1ダメージ。", threat: 8 },
  revive: { name: "竜魂還し", icon: "🌀", type: "spell", tier: "powerful", desc: "どちらかの捨て札からドラゴン1体を選び、自分の場に復活させる。", threat: 9 },
  sacrifice: { name: "竜の残響", icon: "💥", type: "spell", tier: "powerful", desc: "自分の場のドラゴン1体を捨て札にし、相手に3ダメージ。", threat: 9 },

  whelp: { name: "小さな竜", icon: "🐲", type: "dragon", image: "./assets/dragons/whelp.webp", artPosition: "58% 32%", desc: "召喚カードなしで召喚できる。自分のターン開始時に1ダメージ。", threat: 6, freeSummon: true, attack: 1 },
  dragon: { name: "古竜", icon: "🐉", type: "dragon", image: "./assets/dragons/dragon.webp", artPosition: "56% 30%", desc: "自分のターン開始時に4ダメージ。", threat: 10, attack: 4 },
  mirror: { name: "ミラードラゴン", icon: "🪞", type: "dragon", image: "./assets/dragons/mirror.webp", artPosition: "50% 50%", desc: "攻撃1。各相手ターン、最初に受けた相手由来ダメージを同量反射する。", threat: 8, attack: 1 },
  shell: { name: "甲殻竜", icon: "🛡️", type: "dragon", desc: "攻撃1。各相手ターン、最初に受ける相手由来ダメージを1軽減する。", threat: 7, attack: 1 },
  life: { name: "生命竜", icon: "🌿", type: "dragon", desc: "攻撃0。自分のターン開始時、ライフが3以下なら1回復する。", threat: 7, attack: 0 },
  thunder: { name: "雷竜", icon: "⚡", type: "dragon", desc: "召喚時に1ダメージ。以後、自分のターン開始時にも1ダメージ。", threat: 8, attack: 1, onSummonDamage: 1 },
  void: { name: "虚無竜", icon: "🕳️", type: "dragon", desc: "攻撃1。場にいる間、相手はライフを回復できない。", threat: 8, attack: 1 },
  sage: { name: "賢竜", icon: "📚", type: "dragon", desc: "攻撃0。自分のターン開始時に1枚引き、その後手札を1枚捨てる。", threat: 7, attack: 0 },
  berserk: { name: "暴竜", icon: "🔥", type: "dragon", desc: "自分のターン開始時、相手に2ダメージ、自分に1ダメージ。", threat: 9, attack: 2, selfDamage: 1 },
  phantom: { name: "幻影竜", icon: "👻", type: "dragon", desc: "攻撃1。最初に受ける「竜払い」を1回だけ無効化する。", threat: 7, attack: 1, banishShield: true },

  summon: { name: "竜の召喚陣", icon: "⭕", type: "summon", desc: "ドラゴン召喚に使用。召喚が打ち消された場合、このカードは手札に残る。", threat: 4, retainOnCounter: true },
  bloodSummon: { name: "血契の召喚陣", icon: "🩸", type: "summon", desc: "召喚成功時、自分に1ダメージ。打ち消しを1つ回復（最大3）。", threat: 6, summonEffect: "blood" },
  wisdomSummon: { name: "叡智の召喚陣", icon: "🔮", type: "summon", desc: "召喚成功時、1枚引いて1枚捨てる。", threat: 6, summonEffect: "wisdom" },
  starSummon: { name: "星導の召喚陣", icon: "🌌", type: "summon", desc: "召喚成功時、山札のドラゴン1枚を選んで山札の一番上へ置く。", threat: 6, summonEffect: "star" },
  guardSummon: { name: "守護の召喚陣", icon: "🛡️", type: "summon", desc: "召喚したドラゴンは次の自分のターン開始まで「竜払い」の対象にならない。", threat: 7, summonEffect: "guard" },
  lifeSummon: { name: "生命の召喚陣", icon: "🌿", type: "summon", desc: "召喚成功時、自分のライフが2以下なら1回復する。", threat: 5, summonEffect: "life" },
};

export const DRAGON_POOL = ["whelp", "dragon", "mirror", "shell", "life", "thunder", "void", "sage", "berserk", "phantom"];

export const SUMMON_POOL = ["summon", "bloodSummon", "wisdomSummon", "starSummon", "guardSummon", "lifeSummon"];

export const SPELL_POOLS = {
  basic: ["spark", "heal", "study", "steal", "ward", "cycle"],
  tactical: ["recall", "foresee", "echo", "banish", "surge", "fog"],
  powerful: ["inferno", "revive", "sacrifice"],
};

export const BUILD_LIMITS = { dragons: 3, summon: 2, basic: 5, tactical: 4, powerful: 2 };

export function getCard(id) {
  return CARDS[id];
}

export function isDragon(id) {
  return CARDS[id]?.type === "dragon";
}

export function cardTypeLabel(id) {
  const card = CARDS[id];

  if (!card) return "CARD";
  if (card.type === "dragon") return "DRAGON";
  if (card.type === "summon") return "SUMMON";
  if (card.tier === "basic") return "BASIC";
  if (card.tier === "tactical") return "TACTIC";
  if (card.tier === "powerful") return "POWER";

  return "SPELL";
}
