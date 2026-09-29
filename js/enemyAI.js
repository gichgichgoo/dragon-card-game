import { CARDS, isDragon } from "./cards.js?v=20260929-7";

// v2.6の挙動を維持するため、現時点では難易度間で思考係数は共通です。
// 将来ここだけ変えれば、デッキ構成とは独立してAIの賢さを調整できます。
export const AI_PROFILES = {
  easy: {
    counterHigh: 8,
    counterMid: 6,
    counterMidChance: 0.52,
    counterLow: 4,
    counterLowChance: 0.12,
  },

  normal: {
    counterHigh: 8,
    counterMid: 6,
    counterMidChance: 0.52,
    counterLow: 4,
    counterLowChance: 0.12,
  },

  hard: {
    counterHigh: 8,
    counterMid: 6,
    counterMidChance: 0.52,
    counterLow: 4,
    counterLowChance: 0.12,
  },
};

export function createEnemyAI({
  getState,
  canSummon,
  reviveEntries,
  getPlayability,
  random = Math.random,
}) {
  function profile() {
    const state = getState();

    return (
      AI_PROFILES[state?.difficulty] ??
      AI_PROFILES.normal
    );
  }

  function wantedCardScore(
    id,
    context
  ) {
    const state = getState();

    let value =
      CARDS[id]?.threat ?? 0;

    if (isDragon(id)) {
      value += canSummon("cpu", id)
        ? 5
        : -8;

      if (id === "dragon") {
        value += 5;
      }

      if (
        id === "thunder" &&
        state.player.hp <= 1
      ) {
        value += 8;
      }

      if (
        id === "life" &&
        state.cpu.hp <= 2
      ) {
        value += 6;
      }
    }

    if (
      id === "summon" &&
      state.cpu.hand.some(
        (x) =>
          isDragon(x) &&
          !CARDS[x].freeSummon
      )
    ) {
      value += 10;
    }

    if (id === "banish") {
      value += state.player.field.length
        ? 18
        : -5;
    }

    if (id === "heal") {
      value +=
        state.cpu.hp <= 2
          ? 10
          : state.cpu.hp >= 4
            ? -5
            : 0;
    }

    if (id === "inferno") {
      if (
        state.player.hp <= 2 &&
        state.cpu.hp > 1
      ) {
        value += 15;
      }

      if (state.cpu.hp <= 1) {
        value -= 10;
      }
    }

    if (id === "sacrifice") {
      value +=
        state.cpu.field.length
          ? state.player.hp <= 3
            ? 18
            : 6
          : -15;
    }

    if (id === "revive") {
      const entries =
        reviveEntries();

      value += entries.length
        ? Math.max(
            ...entries.map(
              (entry) =>
                CARDS[entry.id].threat
            )
          )
        : -15;
    }

    if (id === "fog") {
      value +=
        state.player.limitPenalty
          ? 2
          : 6;
    }

    if (
      id === "spark" &&
      state.player.hp <= 1
    ) {
      value += 20;
    }

    if (
      id === "ward" &&
      state.cpu.counters === 0
    ) {
      value += 8;
    }

    if (
      id === "study" &&
      state.cpu.hand.length <= 2
    ) {
      value += 6;
    }

    if (
      id === "cycle" &&
      state.cpu.hand.length <= 3
    ) {
      value += 5;
    }

    if (
      id === "surge" &&
      state.cpu.hand.length <= 3
    ) {
      value += 6;
    }

    if (
      id === "foresee" &&
      context === "deck"
    ) {
      value += 5;
    }

    if (
      id === "recall" &&
      context === "deck"
    ) {
      value += 2;
    }

    return value;
  }

  function chooseFrom(
    items,
    context
  ) {
    if (!items.length) {
      return -1;
    }

    let bestIndex = 0;
    let bestValue = -999;

    items.forEach(
      (id, index) => {
        const value =
          wantedCardScore(
            id,
            context
          ) +
          random() * 0.25;

        if (value > bestValue) {
          bestValue = value;
          bestIndex = index;
        }
      }
    );

    return bestIndex;
  }

  function actionScore(id) {
    const state = getState();
    if (getPlayability && !getPlayability("cpu", id).playable) return -100;

    const me = state.cpu;
    const opponent =
      state.player;

    const card = CARDS[id];

    let value =
      card.threat +
      random() * 1.2;

    if (card.type === "summon") {
      return -20;
    }

    if (
      isDragon(id) &&
      !canSummon("cpu", id)
    ) {
      return -20;
    }

    if (
      id === "spark" &&
      opponent.hp <= 1
    ) {
      value = 30;
    }

    if (id === "inferno") {
      if (
        opponent.hp <= 2 &&
        me.hp > 1
      ) {
        value = 35;
      }

      if (me.hp <= 1) {
        value = -10;
      }
    }

    if (id === "sacrifice") {
      if (!me.field.length) {
        return -20;
      }

      value =
        opponent.hp <= 3
          ? 38
          : 12;
    }

    if (id === "revive") {
      const entries =
        reviveEntries();

      if (!entries.length) {
        return -15;
      }

      value =
        12 +
        Math.max(
          ...entries.map(
            (entry) =>
              CARDS[entry.id].threat
          )
        );
    }

    if (id === "fog") {
      value =
        opponent.limitPenalty
          ? 7
          : 11;
    }

    if (isDragon(id)) {
      value += 4;

      if (id === "dragon") {
        value += 8;
      }

      if (
        id === "thunder" &&
        opponent.hp <= 1
      ) {
        value = 30;
      }

      if (
        id === "life" &&
        me.hp <= 2
      ) {
        value += 6;
      }
    }

    if (id === "heal") {
      value =
        me.hp < 4
          ? me.hp <= 2
            ? 10
            : 5
          : -6;
    }

    if (id === "study") {
      value =
        me.hand.length <= 3
          ? 9
          : 4;
    }

    if (id === "cycle") {
      value =
        me.hand.length <= 3
          ? 8
          : 5;
    }

    if (id === "surge") {
      value =
        me.hand.length <= 3
          ? 10
          : 6;
    }

    if (id === "steal") {
      value =
        opponent.hand.length
          ? 7
          : -5;
    }

    if (id === "recall") {
      value =
        state.cpuDiscard.length
          ? 8
          : -5;
    }

    if (id === "banish") {
      const targets = opponent.field.filter((entry) => !entry.summonGuard);
      value =
        !targets.length
          ? -7
          : Math.max(
              ...targets.map(
                (x) =>
                  CARDS[x.id].threat
              )
            ) + 8;
    }

    if (id === "echo") {
      value =
        me.hand.length >= 2
          ? 6
          : -3;
    }

    if (id === "ward") {
      value =
        me.counters < 2
          ? 8
          : me.counters < 3
            ? 4
            : -5;
    }

    if (id === "foresee") {
      value =
        state.cpuDeck.length
          ? 10
          : -5;
    }

    return value;
  }

  function chooseActionIndex({
    opening = false,
  } = {}) {
    const state = getState();

    let bestIndex = -1;
    let bestScore = -999;

    state.cpu.hand.forEach(
      (id, index) => {
        let value =
          actionScore(id);

        if (
          opening &&
          id === "echo"
        ) {
          value = -20;
        }

        if (
          value > bestScore
        ) {
          bestScore = value;
          bestIndex = index;
        }
      }
    );

    return bestScore < 3.3
      ? -1
      : bestIndex;
  }

  function discardScore(id) {
    const state = getState();

    if (CARDS[id]?.type === "summon") {
      const dragons = state.cpu.hand.filter(
        (x) => isDragon(x) && !CARDS[x].freeSummon
      );

      if (!dragons.length) return 1;

      const bestDragon = dragons.reduce(
        (best, current) => CARDS[current].threat > CARDS[best].threat ? current : best,
        dragons[0]
      );

      return 5 + summonCardScore(id, bestDragon);
    }

    if (
      isDragon(id) &&
      !canSummon("cpu", id)
    ) {
      return 1;
    }

    return actionScore(id);
  }

  function summonCardScore(id, dragonId) {
    const state = getState();
    const dragonThreat = CARDS[dragonId]?.threat ?? 0;

    switch (id) {
      case "summon":
        return 6;
      case "bloodSummon":
        if (state.cpu.hp <= 1) return -20;
        return state.cpu.counters < 3 ? 9 : 5;
      case "wisdomSummon":
        return state.cpuDeck.length ? 7 : 3;
      case "starSummon":
        return state.cpuDeck.some((cardId) => isDragon(cardId)) ? 7 : 3;
      case "guardSummon":
        return dragonThreat >= 8 ? 10 : 7;
      case "lifeSummon":
        return state.cpu.hp <= 2 ? 10 : 4;
      default:
        return 4;
    }
  }

  function chooseSummonCardIndex(indices, dragonId) {
    const state = getState();
    if (!indices.length) return -1;

    let bestIndex = indices[0];
    let bestScore = -999;

    indices.forEach((handIndex) => {
      const id = state.cpu.hand[handIndex];
      const value = summonCardScore(id, dragonId) + random() * 0.2;
      if (value > bestScore) {
        bestScore = value;
        bestIndex = handIndex;
      }
    });

    return bestIndex;
  }

  function chooseDiscardIndex() {
    const state = getState();

    let worstIndex = 0;
    let worstScore = Infinity;

    state.cpu.hand.forEach(
      (id, index) => {
        const value =
          discardScore(id);

        if (
          value < worstScore
        ) {
          worstScore = value;
          worstIndex = index;
        }
      }
    );

    return worstIndex;
  }

  function shouldCounter(id) {
    const state = getState();

    if (
      state.cpu.counters <= 0
    ) {
      return false;
    }

    const p = profile();

    let value =
      CARDS[id].threat;

    if (id === "dragon") {
      value = 10;
    }

    if (
      id === "spark" &&
      state.cpu.hp <= 1
    ) {
      value = 10;
    }

    if (
      id === "inferno" &&
      state.cpu.hp <= 2
    ) {
      value = 10;
    }

    if (
      id === "banish" &&
      state.cpu.field.length > 0
    ) {
      value = 10;
    }

    return (
      value >= p.counterHigh ||
      (
        value >= p.counterMid &&
        random() <
          p.counterMidChance
      ) ||
      (
        value >= p.counterLow &&
        random() <
          p.counterLowChance
      )
    );
  }

  function shouldCounterBack(id) {
    const state = getState();

    if (
      state.cpu.counters < 2
    ) {
      return false;
    }

    let value =
      CARDS[id].threat ?? 0;

    if (id === "dragon") {
      value = 12;
    }

    if (
      id === "inferno" &&
      state.player.hp <= 2 &&
      state.cpu.hp > 1
    ) {
      value = 12;
    }

    if (
      id === "spark" &&
      state.player.hp <= 1
    ) {
      value = 12;
    }

    if (
      id === "banish" &&
      state.player.field.length > 0
    ) {
      value = 11;
    }

    if (
      id === "heal" &&
      state.cpu.hp <= 1
    ) {
      value = 9;
    }

    return (
      value >= 10 ||
      (
        value >= 7 &&
        random() < 0.6
      )
    );
  }

  return {
    chooseFrom,
    chooseActionIndex,
    chooseDiscardIndex,
    chooseSummonCardIndex,
    discardScore,
    shouldCounter,
    shouldCounterBack,
  };
}
