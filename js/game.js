import { CARDS, isDragon } from "./cards.js?v=20261005-1";
import { buildDeck, cloneBuild, createSideState, drawCard, drawCards as drawMany, getDeck, getDiscard } from "./deck.js?v=20260929-7";
import { pickCpuDeck } from "./enemyDecks.js?v=20260929-7";
import { createEnemyAI } from "./enemyAI.js?v=20260929-7";
import { createCombatApi } from "./combat.js";
import { resolveSpellEffect, resolveDragonTurnStart, resolveSummonCardEffect } from "./effects.js?v=20260929-7";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function createGame(ui, { random = Math.random } = {}) {
  let state = null;
  let gameEpoch = 0;
  let cpuTimer = null;
  const getState = () => state;
  const log = (message, className = "sys") => ui.log(message, className);

  function summonCardIndices(who) {
    return state[who].hand
      .map((id, index) => ({ id, index }))
      .filter((entry) => CARDS[entry.id]?.type === "summon");
  }

  function canSummon(who, id) {
    return isDragon(id) && (CARDS[id].freeSummon || summonCardIndices(who).length > 0);
  }

  async function chooseSummonPayment(who, dragonId) {
    if (CARDS[dragonId].freeSummon) return null;

    const options = summonCardIndices(who);
    if (!options.length) return null;
    if (options.length === 1) return options[0];

    if (who === "player") {
      const pick = await ui.chooseCard(
        "召喚方法",
        `「${CARDS[dragonId].name}」に使う召喚カードを選んでください。`,
        options.map((entry) => entry.id)
      );
      return options[pick];
    }

    const handIndex = ai.chooseSummonCardIndex(options.map((entry) => entry.index), dragonId);
    return options.find((entry) => entry.index === handIndex) ?? options[0];
  }

  function removeHandIndices(who, indices) {
    [...indices].sort((a, b) => b - a).forEach((index) => state[who].hand.splice(index, 1));
  }

  function expireSummonGuard(who) {
    let expired = 0;
    state[who].field.forEach((entry) => {
      if (entry.summonGuard) {
        delete entry.summonGuard;
        expired++;
      }
    });
    if (expired) {
      log(
        `${who === "player" ? "あなた" : "CPU"}の守護の召喚陣による保護が終了しました。`,
        who === "player" ? "you" : "cpu"
      );
    }
  }

  function draw(who, announce = true) {
    const id = drawCard(state, who);
    if (id === null) {
      if (announce) log(`${who === "player" ? "\u3042\u306a\u305f" : "CPU"}\u306f\u5c71\u672d\u5207\u308c\u3067\u30c9\u30ed\u30fc\u3067\u304d\u307e\u305b\u3093\u3002`);
      return null;
    }
    if (announce) {
      log(`${who === "player" ? "\u3042\u306a\u305f" : "CPU"}\u306f1\u679a\u5f15\u304d\u307e\u3057\u305f\u3002`, who === "player" ? "you" : "cpu");
      ui.queueDrawAnimation(who, id);
    }
    return id;
  }

  function drawCards(who, count, announce = false) {
    const drawn = [];
    for (let i = 0; i < count; i++) {
      const id = draw(who, announce);
      if (id === null) break;
      drawn.push(id);
    }
    return drawn;
  }

  function reviveEntries() {
    const entries = [];
    state.playerDiscard.forEach((id, index) => { if (isDragon(id)) entries.push({ id, source: "player", index, label: "\u3042\u306a\u305f\u306e\u6368\u3066\u672d" }); });
    state.cpuDiscard.forEach((id, index) => { if (isDragon(id)) entries.push({ id, source: "cpu", index, label: "CPU\u306e\u6368\u3066\u672d" }); });
    return entries;
  }

  function getPlayability(who, id) {
    if (!state || !CARDS[id]) return { playable: false, reason: "このカードは使用できません。" };

    const me = state[who];
    const opponentName = who === "player" ? "cpu" : "player";
    const opponent = state[opponentName];
    const deck = getDeck(state, who);
    const discard = getDiscard(state, who);

    if (CARDS[id].type === "summon") {
      return { playable: false, reason: "召喚カードは直接使いません。召喚したいドラゴンを選ぶときに使用します。" };
    }

    if (isDragon(id) && !canSummon(who, id)) {
      return { playable: false, reason: "このドラゴンの召喚には召喚カードが必要です。" };
    }

    switch (id) {
      case "echo":
        if (state.opening && state.starter === who) {
          return { playable: false, reason: "先攻1ターン目は「連唱」を使用できません。" };
        }
        break;
      case "sacrifice":
        if (!me.field.length) return { playable: false, reason: "自分の場に生贄にできるドラゴンがいません。" };
        break;
      case "banish":
        if (!opponent.field.some((entry) => !entry.summonGuard)) return { playable: false, reason: "相手の場に「竜払い」の対象となるドラゴンがいません。" };
        break;
      case "revive":
        if (!reviveEntries().length) return { playable: false, reason: "どちらの捨て札にも復活できるドラゴンがいません。" };
        break;
      case "recall":
        if (!discard.length) return { playable: false, reason: "自分の捨て札がありません。" };
        break;
      case "foresee":
        if (!deck.length) return { playable: false, reason: "自分の山札がありません。" };
        break;
      case "steal":
        if (!opponent.hand.length) return { playable: false, reason: "相手の手札がありません。" };
        break;
      case "heal":
        if (me.hp >= 4) return { playable: false, reason: "ライフはすでに最大です。" };
        if (opponent.field.some((entry) => entry.id === "void")) {
          return { playable: false, reason: "相手の「虚無竜」により回復できません。" };
        }
        break;
      case "ward":
        if (me.counters >= 3) return { playable: false, reason: "打ち消しはすでに最大です。" };
        break;
      case "study":
        if (!deck.length) return { playable: false, reason: "山札がないためカードを引けません。" };
        break;
      case "cycle":
        if (!deck.length) return { playable: false, reason: "山札がないため「魔力循環」を使用できません。" };
        break;
      case "surge":
        if (!deck.length) return { playable: false, reason: "山札がないため「知識の奔流」を使用できません。" };
        break;
    }

    return { playable: true, reason: "" };
  }

  const ai = createEnemyAI({ getState, canSummon, reviveEntries, getPlayability, random });
  const combat = createCombatApi({ getState, ui, log });

  async function discardFromHand(who, count, title) {
    const side = state[who];
    const pile = getDiscard(state, who);
    for (let n = 0; n < count && side.hand.length; n++) {
      let index;
      if (who === "player") index = await ui.chooseCard(title, `\u6368\u3066\u308b\u30ab\u30fc\u30c9\u3092\u9078\u3093\u3067\u304f\u3060\u3055\u3044\uff08${n + 1}/${count}\uff09`, side.hand);
      else index = ai.chooseDiscardIndex();
      const [cardId] = side.hand.splice(index, 1);
      pile.push(cardId);
      log(`${who === "player" ? "\u3042\u306a\u305f" : "CPU"}\u306f\u300c${CARDS[cardId].name}\u300d\u3092\u6368\u3066\u307e\u3057\u305f\u3002`, who === "player" ? "you" : "cpu");
    }
  }

  const effectContext = {
    getState,
    ui,
    ai,
    random,
    log,
    draw,
    drawCards,
    discardFromHand,
    reviveEntries,
    getDeck: (who) => getDeck(state, who),
    getDiscard: (who) => getDiscard(state, who),
    damage: combat.damage,
    heal: combat.heal,
  };

  function checkGameOver() {
    if (state.player.hp > 0 && state.cpu.hp > 0) return false;
    state.over = true;
    if (state.player.hp <= 0 && state.cpu.hp <= 0) ui.showResult("\u76f8\u6253\u3061", "\u4e21\u8005\u306e\u30e9\u30a4\u30d5\u304c\u540c\u6642\u306b0\u306b\u306a\u308a\u307e\u3057\u305f\u3002", "\ud83d\udca5");
    else if (state.cpu.hp <= 0) ui.showResult("\u52dd\u5229\uff01", `${state.turnNo}\u30bf\u30fc\u30f3\u76ee\u3067CPU\u3092\u5012\u3057\u307e\u3057\u305f\u3002`, "\ud83c\udfc6");
    else ui.showResult("\u6557\u5317\u2026", "CPU\u306b\u5148\u306b\u30e9\u30a4\u30d5\u3092\u524a\u308a\u5207\u3089\u308c\u307e\u3057\u305f\u3002", "\u2620\ufe0f");
    return true;
  }

  function finishByDeck() {
    if (state.over || state.playerDeck.length > 0 || state.cpuDeck.length > 0) return false;
    state.over = true;
    if (state.player.hp > state.cpu.hp) ui.showResult("\u52dd\u5229\uff01", `\u4e21\u8005\u5c71\u672d\u5207\u308c\u3002\u30e9\u30a4\u30d5 ${state.player.hp} - ${state.cpu.hp} \u3067\u3042\u306a\u305f\u306e\u52dd\u3061\u3067\u3059\u3002`, "\ud83c\udfc6");
    else if (state.player.hp < state.cpu.hp) ui.showResult("\u6557\u5317\u2026", `\u4e21\u8005\u5c71\u672d\u5207\u308c\u3002\u30e9\u30a4\u30d5 ${state.player.hp} - ${state.cpu.hp} \u3067CPU\u306e\u52dd\u3061\u3067\u3059\u3002`, "\u2620\ufe0f");
    else ui.showResult("\u5f15\u304d\u5206\u3051", `\u4e21\u8005\u5c71\u672d\u5207\u308c\u3002\u30e9\u30a4\u30d5 ${state.player.hp} - ${state.cpu.hp} \u3067\u540c\u70b9\u3067\u3059\u3002`, "\ud83e\udd1d");
    return true;
  }

  async function startFieldEffects(who) {
    const fieldSnapshot = [...state[who].field];
    for (const card of fieldSnapshot) {
      await resolveDragonTurnStart(effectContext, who, card);
      if (checkGameOver()) return;
    }
  }

  async function playCard(who, index) {
    if (state.over) return;
    const hand = state[who].hand;
    if (index < 0 || index >= hand.length) return;
    const id = hand[index];
    const card = CARDS[id];
    const availability = getPlayability(who, id);
    if (!availability.playable) {
      if (who === "player") log(availability.reason, "sys");
      return false;
    }
    let cancelled = false;

    if (isDragon(id)) {
      if (!canSummon(who, id)) {
        if (who === "player") log(`\u300c${card.name}\u300d\u306e\u53ec\u559a\u306b\u306f\u300c\u7adc\u306e\u53ec\u559a\u9663\u300d\u304c\u5fc5\u8981\u3067\u3059\u3002`, "sys");
        return;
      }

      const summonPayment = await chooseSummonPayment(who, id);
      if (!card.freeSummon && !summonPayment) {
        if (who === "player") log("召喚に使えるカードがありません。", "sys");
        return false;
      }

      if (who === "player") {
        if (ai.shouldCounter(id)) {
          state.cpu.counters--;
          cancelled = true;
          ui.showCounterFlash("counter", `CPU\u304c\u300c${card.name}\u300d\u306e\u53ec\u559a\u3092\u7121\u52b9\u5316`);
          log(`\u3010\u6253\u3061\u6d88\u3057\u3011CPU\u306f\ud83d\udcd8\u30921\u3064\u4f7f\u3044\u3001\u300c${card.name}\u300d\u306e\u53ec\u559a\u3092\u6253\u3061\u6d88\u3057\u307e\u3057\u305f\u3002`, "cpu");
          if (state.player.counters >= 2 && await ui.askCounterBack(id)) {
            state.player.counters -= 2;
            cancelled = false;
            ui.showCounterFlash("back", `\u3042\u306a\u305f\u304c\u300c${card.name}\u300d\u306e\u53ec\u559a\u3092\u901a\u3057\u305f`);
            await wait(650);
            log(`\u3010\u6253\u3061\u6d88\u3057\u8fd4\u3057\u3011\u3042\u306a\u305f\u306f\ud83d\udcd8\u30922\u3064\u4f7f\u3044\u3001\u300c${card.name}\u300d\u306e\u53ec\u559a\u3092\u901a\u3057\u307e\u3057\u305f\u3002`, "you");
          }
        }
      } else {
        let counter = false;
        if (state.player.counters > 0) counter = await ui.askCounter(id, summonPayment?.id ?? null);
        else await ui.showOpponentPlay(id, true, summonPayment?.id ?? null);
        if (counter && state.player.counters > 0) {
          state.player.counters--;
          cancelled = true;
          ui.showCounterFlash("counter", `\u3042\u306a\u305f\u304c\u300c${card.name}\u300d\u306e\u53ec\u559a\u3092\u7121\u52b9\u5316`);
          log(`\u3010\u6253\u3061\u6d88\u3057\u3011\u3042\u306a\u305f\u306f\ud83d\udcd8\u30921\u3064\u4f7f\u3044\u3001CPU\u306e\u300c${card.name}\u300d\u306e\u53ec\u559a\u3092\u6253\u3061\u6d88\u3057\u307e\u3057\u305f\u3002`, "you");
          if (ai.shouldCounterBack(id)) {
            state.cpu.counters -= 2;
            cancelled = false;
            ui.showCounterFlash("back", `CPU\u304c\u300c${card.name}\u300d\u306e\u53ec\u559a\u3092\u901a\u3057\u305f`);
            await wait(650);
            log(`\u3010\u6253\u3061\u6d88\u3057\u8fd4\u3057\u3011CPU\u306f\ud83d\udcd8\u30922\u3064\u4f7f\u3044\u3001\u300c${card.name}\u300d\u306e\u53ec\u559a\u3092\u901a\u3057\u307e\u3057\u305f\u3002`, "cpu");
          }
        }
      }

      if (!cancelled) {
        const usedSummonId = summonPayment?.id ?? null;
        const removeIndices = [index];
        if (summonPayment) removeIndices.push(summonPayment.index);
        removeHandIndices(who, removeIndices);

        if (usedSummonId) getDiscard(state, who).push(usedSummonId);

        const fieldEntry = { id, banishShieldUsed: false };
        state[who].field.push(fieldEntry);
        ui.queueFieldAnimation(who, id);

        log(
          `${who === "player" ? "あなた" : "CPU"}は${usedSummonId ? `「${CARDS[usedSummonId].name}」で` : ""}「${card.name}」を召喚！`,
          who === "player" ? "you" : "cpu"
        );

        if (usedSummonId) {
          await resolveSummonCardEffect(effectContext, who, usedSummonId, fieldEntry);
        }

        if (card.onSummonDamage) {
          combat.damage(who, who === "player" ? "cpu" : "player", card.onSummonDamage);
          log(
            `「${card.name}」の召喚時効果！ ${card.onSummonDamage}ダメージ。`,
            who === "player" ? "you" : "cpu"
          );
        }
      } else {
        if (summonPayment && !CARDS[summonPayment.id].retainOnCounter) {
          state[who].hand.splice(summonPayment.index, 1);
          getDiscard(state, who).push(summonPayment.id);
          log(
            `${who === "player" ? "あなた" : "CPU"}の召喚は無効。「${CARDS[summonPayment.id].name}」は捨て札へ。ドラゴンは手札に残ります。`,
            who === "player" ? "you" : "cpu"
          );
        } else if (summonPayment) {
          log(
            `${who === "player" ? "あなた" : "CPU"}の召喚は無効。「${CARDS[summonPayment.id].name}」とドラゴンは手札に残ります。`,
            who === "player" ? "you" : "cpu"
          );
        } else {
          log(
            `${who === "player" ? "あなた" : "CPU"}の召喚は無効。ドラゴンは手札に残ります。`,
            who === "player" ? "you" : "cpu"
          );
        }
      }

      if (who === "player") state.playsUsed++;
      checkGameOver();
      ui.render(state);
      return;
    }

    hand.splice(index, 1);

    if (who === "player") {
      if (ai.shouldCounter(id)) {
        state.cpu.counters--;
        cancelled = true;
        ui.showCounterFlash("counter", `CPU\u304c\u300c${card.name}\u300d\u3092\u7121\u52b9\u5316`);
        log(`\u3010\u6253\u3061\u6d88\u3057\u3011CPU\u306f\ud83d\udcd8\u30921\u3064\u4f7f\u3044\u3001\u300c${card.name}\u300d\u3092\u6253\u3061\u6d88\u3057\u307e\u3057\u305f\u3002`, "cpu");
        if (state.player.counters >= 2 && await ui.askCounterBack(id)) {
          state.player.counters -= 2;
          cancelled = false;
          ui.showCounterFlash("back", `\u3042\u306a\u305f\u304c\u300c${card.name}\u300d\u3092\u901a\u3057\u305f`);
          await wait(650);
            log(`\u3010\u6253\u3061\u6d88\u3057\u8fd4\u3057\u3011\u3042\u306a\u305f\u306f\ud83d\udcd8\u30922\u3064\u4f7f\u3044\u3001\u300c${card.name}\u300d\u3092\u901a\u3057\u307e\u3057\u305f\u3002`, "you");
        }
      }
    } else {
      let counter = false;
      if (state.player.counters > 0) counter = await ui.askCounter(id);
      else await ui.showOpponentPlay(id, false);
      if (counter && state.player.counters > 0) {
        state.player.counters--;
        cancelled = true;
        ui.showCounterFlash("counter", `\u3042\u306a\u305f\u304c\u300c${card.name}\u300d\u3092\u7121\u52b9\u5316`);
        log(`\u3010\u6253\u3061\u6d88\u3057\u3011\u3042\u306a\u305f\u306f\ud83d\udcd8\u30921\u3064\u4f7f\u3044\u3001CPU\u306e\u300c${card.name}\u300d\u3092\u6253\u3061\u6d88\u3057\u307e\u3057\u305f\u3002`, "you");
        if (ai.shouldCounterBack(id)) {
          state.cpu.counters -= 2;
          cancelled = false;
          ui.showCounterFlash("back", `CPU\u304c\u300c${card.name}\u300d\u3092\u901a\u3057\u305f`);
          await wait(650);
            log(`\u3010\u6253\u3061\u6d88\u3057\u8fd4\u3057\u3011CPU\u306f\ud83d\udcd8\u30922\u3064\u4f7f\u3044\u3001\u300c${card.name}\u300d\u3092\u901a\u3057\u307e\u3057\u305f\u3002`, "cpu");
        }
      }
    }

    if (!cancelled) await resolveSpellEffect(effectContext, who, id);
    if (card.type === "spell" || card.type === "summon" || cancelled) getDiscard(state, who).push(id);
    if (who === "player") state.playsUsed++;
    checkGameOver();
    ui.render(state);
  }

  function discardCpuToLimit() {
    while (state.cpu.hand.length > 5) {
      const index = ai.chooseDiscardIndex();
      const [id] = state.cpu.hand.splice(index, 1);
      state.cpuDiscard.push(id);
      log(`CPU\u306f\u624b\u672d\u4e0a\u9650\u3067\u300c${CARDS[id].name}\u300d\u3092\u6368\u3066\u307e\u3057\u305f\u3002`, "cpu");
    }
  }

  async function cpuTurn() {
    if (!state || state.over) return;
    const epoch = state.epoch;
    cpuTimer = null;
    const openingCpu = state.opening && state.starter === "cpu";
    state.turn = "cpu";
    expireSummonGuard("cpu");

    const penalty = openingCpu ? 0 : (state.cpu.limitPenalty || 0);
    if (!openingCpu) state.cpu.limitPenalty = 0;
    let limit = openingCpu ? 1 : Math.max(0, 2 - penalty);
    let used = 0;
    state.cpuBonus = 0;
    state.cpuPlayLimit = limit;
    state.cpuPlaysUsed = used;

    ui.render(state);
    await wait(220);
    if (!state || state.epoch !== epoch || state.over) return;

    if (!openingCpu) {
      await startFieldEffects("cpu");
      if (!state || state.epoch !== epoch || state.over) return;
      draw("cpu");
      ui.render(state);
      await wait(260);
      if (!state || state.epoch !== epoch || state.over) return;
    }

    await ui.showTurnStart("cpu", limit, openingCpu);
    if (!state || state.epoch !== epoch || state.over) return;

    if (penalty) log(`\u5c01\u9b54\u306e\u9727\u306b\u3088\u308a\u3001CPU\u306e\u4f7f\u7528\u4e0a\u9650\u306f${limit}\u679a\u3067\u3059\u3002`, "cpu");

    while (used < limit && state.cpu.hand.length && !state.over) {
      const index = ai.chooseActionIndex({ opening: openingCpu });
      if (index < 0) break;
      log(`CPU\u306f\u300c${CARDS[state.cpu.hand[index]].name}\u300d\u3092\u4f7f\u3044\u307e\u3059\u3002`, "cpu");
      ui.render(state);
      await wait(180);
      if (!state || state.epoch !== epoch || state.over) return;
      await playCard("cpu", index);
      if (!state || state.epoch !== epoch || state.over) return;
      if (state.cpuBonus) {
        if (!openingCpu) limit += state.cpuBonus;
        state.cpuBonus = 0;
      }
      used++;
      state.cpuPlayLimit = limit;
      state.cpuPlaysUsed = used;
      ui.render(state);
      await wait(220);
      if (!state || state.epoch !== epoch || state.over) return;
    }

    if (state.over) return;
    discardCpuToLimit();
    ui.render(state);
    await wait(200);
    if (!state || state.epoch !== epoch || state.over) return;
    log("CPU\u306f\u30bf\u30fc\u30f3\u7d42\u4e86\u3002", "cpu");

    if (openingCpu) state.opening = false;
    if (finishByDeck()) return;
    if (state.starter === "player") state.turnNo++;
    await startPlayerTurn();
  }

  async function startPlayerTurn() {
    if (state.over) return;
    state.turn = "player";
    expireSummonGuard("player");
    state.playsUsed = 0;
    state.cpuPlayLimit = 0;
    state.cpuPlaysUsed = 0;
    const penalty = state.player.limitPenalty || 0;
    state.player.limitPenalty = 0;
    state.playLimit = Math.max(0, 2 - penalty);
    state.selected = null;
    state.first = false;
    if (penalty) log(`\u5c01\u9b54\u306e\u9727\u306b\u3088\u308a\u3001\u3042\u306a\u305f\u306e\u4f7f\u7528\u4e0a\u9650\u306f${state.playLimit}\u679a\u3067\u3059\u3002`, "you");
    await startFieldEffects("player");
    if (state.over) return;
    draw("player");
    ui.render(state);
    checkGameOver();
    if (state.over) return;
    await ui.showTurnStart("player", state.playLimit, false);
  }

  function handoffToCpu(delay = 230) {
    const openingPlayer = state.opening && state.starter === "player";
    if (openingPlayer) state.opening = false;
    if (state.starter === "cpu") state.turnNo++;
    state.turn = "cpu";
    state.selected = null;
    state.cpuPlaysUsed = 0;
    state.cpuPlayLimit = Math.max(0, 2 - (state.cpu.limitPenalty || 0));
    ui.render(state);
    cpuTimer = setTimeout(cpuTurn, delay);
  }

  function endPlayerTurn() {
    if (state.over || state.turn !== "player") return;
    if (state.player.hand.length > 5) {
      state.discardMode = true;
      state.selected = null;
      ui.render(state);
      return;
    }
    if (finishByDeck()) return;
    handoffToCpu(230);
  }

  function discardSelected() {
    if (state.selected === null) return;
    const [id] = state.player.hand.splice(state.selected, 1);
    state.playerDiscard.push(id);
    log(`\u624b\u672d\u4e0a\u9650\u3067\u300c${CARDS[id].name}\u300d\u3092\u6368\u3066\u307e\u3057\u305f\u3002`, "you");
    state.selected = null;
    if (state.player.hand.length <= 5) {
      state.discardMode = false;
      if (finishByDeck()) return;
      handoffToCpu(200);
    } else {
      ui.render(state);
    }
  }

  function selectCard(index) {
    if (!state || state.over || state.turn !== "player") return;
    state.selected = state.selected === index ? null : index;
    ui.render(state);
  }

  async function playSelected() {
    if (!state || state.turn !== "player" || state.selected === null) return;
    if (state.discardMode) {
      discardSelected();
      return;
    }
    if (state.playsUsed >= state.playLimit) return;
    const index = state.selected;
    const id = state.player.hand[index];
    const availability = getPlayability("player", id);
    if (!availability.playable) {
      log(availability.reason, "sys");
      ui.render(state);
      return;
    }
    state.selected = null;
    await playCard("player", index);
    ui.render(state);
  }

  async function startGame(build, difficulty = "normal") {
    if (cpuTimer) { clearTimeout(cpuTimer); cpuTimer = null; }
    gameEpoch++;
    const epoch = gameEpoch;
    const savedBuild = cloneBuild(build);
    const cpuChoice = pickCpuDeck(difficulty, random);

    await ui.showOpponentDragons(cpuChoice.build.dragons);
    if (gameEpoch !== epoch) return;

    const starter = random() < 0.5 ? "player" : "cpu";
    state = {
      epoch: gameEpoch,
      difficulty: cpuChoice.difficulty,
      cpuDeckName: cpuChoice.name,
      build: savedBuild,
      cpuBuild: cloneBuild(cpuChoice.build),
      playerDeck: buildDeck(savedBuild, random),
      cpuDeck: buildDeck(cpuChoice.build, random),
      playerDiscard: [], cpuDiscard: [],
      player: createSideState(), cpu: createSideState(),
      starter, opening: true, turn: starter,
      selected: null, playsUsed: 0, playLimit: starter === "player" ? 1 : 2,
      cpuPlayLimit: starter === "cpu" ? 1 : 0, cpuPlaysUsed: 0,
      first: starter === "player", over: false, turnNo: 1, cpuBonus: 0, discardMode: false,
    };

    for (let i = 0; i < 5; i++) { draw("player", false); draw("cpu", false); }
    ui.clearForGameStart();
    log(`ゲーム開始。CPUは${cpuChoice.difficulty.toUpperCase()}の専用デッキで参戦。`);
    log(`${starter === "player" ? "\u3042\u306a\u305f" : "CPU"}\u304c\u5148\u653b\u3002\u5148\u653b1\u30bf\u30fc\u30f3\u76ee\u306f\u30c9\u30ed\u30fc\u306a\u3057\u30fb\u30ab\u30fc\u30c91\u679a\u307e\u3067\u3002`);
    log(`\u3042\u306a\u305f\u306e\u30c9\u30e9\u30b4\u30f3\u306f ${build.dragons.map((id) => CARDS[id].name).join("\uff0f")}\u3002`);
    ui.render(state);
    if (starter === "player") {
      ui.showTurnStart("player", 1, true);
    } else {
      cpuTimer = setTimeout(cpuTurn, 450);
    }
  }

  function reset() {
    if (cpuTimer) { clearTimeout(cpuTimer); cpuTimer = null; }
    gameEpoch++;
    if (state) state.over = true;
    ui.openSetup();
  }

  ui.setStateProvider(getState);
  ui.bindControls({ selectCard, playSelected, endTurn: endPlayerTurn, reset, startGame, getPlayability });

  return { getState, reset, startGame, playCard, checkGameOver, finishByDeck, getPlayability };
}
