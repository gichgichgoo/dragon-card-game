import { CARDS, isDragon } from "./cards.js";
import { buildDeck, cloneBuild, createSideState, drawCard, drawCards as drawMany, getDeck, getDiscard } from "./deck.js";
import { pickCpuDeck } from "./enemyDecks.js";
import { createEnemyAI } from "./enemyAI.js";
import { createCombatApi } from "./combat.js";
import { resolveSpellEffect, resolveDragonTurnStart } from "./effects.js";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function createGame(ui, { random = Math.random } = {}) {
  let state = null;
  let gameEpoch = 0;
  let cpuTimer = null;
  const getState = () => state;
  const log = (message, className = "sys") => ui.log(message, className);

  function summonIndex(who) {
    return state[who].hand.indexOf("summon");
  }

  function canSummon(who, id) {
    return isDragon(id) && (CARDS[id].freeSummon || summonIndex(who) >= 0);
  }

  function consumeSummon(who, id) {
    if (CARDS[id].freeSummon) return false;

    const index = summonIndex(who);
    if (index < 0) return false;

    state[who].hand.splice(index, 1);
    getDiscard(state, who).push("summon");

    return true;
  }

  function draw(who, announce = true) {
    const id = drawCard(state, who);

    if (id === null) {
      if (announce) {
        log(`${who === "player" ? "あなた" : "CPU"}は山札切れでドローできません。`);
      }
      return null;
    }

    if (announce) {
      log(
        `${who === "player" ? "あなた" : "CPU"}は1枚引きました。`,
        who === "player" ? "you" : "cpu"
      );
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

    state.playerDiscard.forEach((id, index) => {
      if (isDragon(id)) {
        entries.push({
          id,
          source: "player",
          index,
          label: "あなたの捨て札",
        });
      }
    });

    state.cpuDiscard.forEach((id, index) => {
      if (isDragon(id)) {
        entries.push({
          id,
          source: "cpu",
          index,
          label: "CPUの捨て札",
        });
      }
    });

    return entries;
  }

  const ai = createEnemyAI({
    getState,
    canSummon,
    reviveEntries,
    random,
  });

  const combat = createCombatApi({
    getState,
    ui,
    log,
  });

  async function discardFromHand(who, count, title) {
    const side = state[who];
    const pile = getDiscard(state, who);

    for (let n = 0; n < count && side.hand.length; n++) {
      let index;

      if (who === "player") {
        index = await ui.chooseCard(
          title,
          `捨てるカードを選んでください（${n + 1}/${count}）`,
          side.hand
        );
      } else {
        index = ai.chooseDiscardIndex();
      }

      const [cardId] = side.hand.splice(index, 1);
      pile.push(cardId);

      log(
        `${who === "player" ? "あなた" : "CPU"}は「${CARDS[cardId].name}」を捨てました。`,
        who === "player" ? "you" : "cpu"
      );
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

    if (state.player.hp <= 0 && state.cpu.hp <= 0) {
      ui.showResult(
        "相打ち",
        "両者のライフが同時に0になりました。",
        "💥"
      );
    } else if (state.cpu.hp <= 0) {
      ui.showResult(
        "勝利！",
        `${state.turnNo}ターン目でCPUを倒しました。`,
        "🏆"
      );
    } else {
      ui.showResult(
        "敗北…",
        "CPUに先にライフを削り切られました。",
        "☠️"
      );
    }

    return true;
  }

  function finishByDeck() {
    if (
      state.over ||
      state.playerDeck.length > 0 ||
      state.cpuDeck.length > 0
    ) {
      return false;
    }

    state.over = true;

    if (state.player.hp > state.cpu.hp) {
      ui.showResult(
        "勝利！",
        `両者山札切れ。ライフ ${state.player.hp} - ${state.cpu.hp} であなたの勝ちです。`,
        "🏆"
      );
    } else if (state.player.hp < state.cpu.hp) {
      ui.showResult(
        "敗北…",
        `両者山札切れ。ライフ ${state.player.hp} - ${state.cpu.hp} でCPUの勝ちです。`,
        "☠️"
      );
    } else {
      ui.showResult(
        "引き分け",
        `両者山札切れ。ライフ ${state.player.hp} - ${state.cpu.hp} で同点です。`,
        "🤝"
      );
    }

    return true;
  }

  async function startFieldEffects(who) {
    const fieldSnapshot = [...state[who].field];

    for (const card of fieldSnapshot) {
      await resolveDragonTurnStart(
        effectContext,
        who,
        card
      );

      if (checkGameOver()) return;
    }
  }

  async function playCard(who, index) {
    if (state.over) return;

    const hand = state[who].hand;

    if (index < 0 || index >= hand.length) return;

    const id = hand[index];
    const card = CARDS[id];

    let cancelled = false;

    if (id === "summon") {
      if (who === "player") {
        log(
          "「竜の召喚陣」は直接使用しません。召喚したいドラゴンを選んでください。",
          "sys"
        );
      }

      return;
    }

    if (isDragon(id)) {
      if (!canSummon(who, id)) {
        if (who === "player") {
          log(
            `「${card.name}」の召喚には「竜の召喚陣」が必要です。`,
            "sys"
          );
        }

        return;
      }

      if (who === "player") {
        if (ai.shouldCounter(id)) {
          state.cpu.counters--;

          cancelled = true;

          ui.showCounterFlash(
            "counter",
            `CPUが「${card.name}」の召喚を無効化`
          );

          log(
            `【打ち消し】CPUは📘を1つ使い、「${card.name}」の召喚を打ち消しました。`,
            "cpu"
          );

          if (
            state.player.counters >= 2 &&
            await ui.askCounterBack(id)
          ) {
            state.player.counters -= 2;

            cancelled = false;

            ui.showCounterFlash(
              "back",
              `あなたが「${card.name}」の召喚を通した`
            );

            log(
              `【打ち消し返し】あなたは📘を2つ使い、「${card.name}」の召喚を通しました。`,
              "you"
            );
          }
        }
      } else {
        let counter = false;

        if (state.player.counters > 0) {
          counter = await ui.askCounter(id);
        } else {
          await ui.showOpponentPlay(id, true);
        }

        if (
          counter &&
          state.player.counters > 0
        ) {
          state.player.counters--;

          cancelled = true;

          ui.showCounterFlash(
            "counter",
            `あなたが「${card.name}」の召喚を無効化`
          );

          log(
            `【打ち消し】あなたは📘を1つ使い、CPUの「${card.name}」の召喚を打ち消しました。`,
            "you"
          );

          if (ai.shouldCounterBack(id)) {
            state.cpu.counters -= 2;

            cancelled = false;

            ui.showCounterFlash(
              "back",
              `CPUが「${card.name}」の召喚を通した`
            );

            log(
              `【打ち消し返し】CPUは📘を2つ使い、「${card.name}」の召喚を通しました。`,
              "cpu"
            );
          }
        }
      }

      if (!cancelled) {
        hand.splice(index, 1);

        const usedCircle = consumeSummon(
          who,
          id
        );

        state[who].field.push({
          id,
          banishShieldUsed: false,
        });

        ui.queueFieldAnimation(
          who,
          id
        );

        log(
          `${who === "player" ? "あなた" : "CPU"}は${
            usedCircle
              ? "「竜の召喚陣」を消費して"
              : ""
          }「${card.name}」を召喚！`,
          who === "player" ? "you" : "cpu"
        );

        if (card.onSummonDamage) {
          combat.damage(
            who,
            who === "player"
              ? "cpu"
              : "player",
            card.onSummonDamage
          );

          log(
            `「${card.name}」の召喚時効果！ ${card.onSummonDamage}ダメージ。`,
            who === "player"
              ? "you"
              : "cpu"
          );
        }
      } else {
        const usedCircle = consumeSummon(
          who,
          id
        );

        log(
          `${who === "player" ? "あなた" : "CPU"}の召喚は最終的に無効。${
            usedCircle
              ? "召喚陣だけ捨て札へ行き、"
              : ""
          }ドラゴンは手札に残ります。`,
          who === "player"
            ? "you"
            : "cpu"
        );
      }

      if (who === "player") {
        state.playsUsed++;
      }

      checkGameOver();

      ui.render(state);

      return;
    }

    hand.splice(index, 1);

    if (who === "player") {
      if (ai.shouldCounter(id)) {
        state.cpu.counters--;

        cancelled = true;

        ui.showCounterFlash(
          "counter",
          `CPUが「${card.name}」を無効化`
        );

        log(
          `【打ち消し】CPUは📘を1つ使い、「${card.name}」を打ち消しました。`,
          "cpu"
        );

        if (
          state.player.counters >= 2 &&
          await ui.askCounterBack(id)
        ) {
          state.player.counters -= 2;

          cancelled = false;

          ui.showCounterFlash(
            "back",
            `あなたが「${card.name}」を通した`
          );

          log(
            `【打ち消し返し】あなたは📘を2つ使い、「${card.name}」を通しました。`,
            "you"
          );
        }
      }
    } else {
      let counter = false;

      if (state.player.counters > 0) {
        counter = await ui.askCounter(id);
      } else {
        await ui.showOpponentPlay(
          id,
          false
        );
      }

      if (
        counter &&
        state.player.counters > 0
      ) {
        state.player.counters--;

        cancelled = true;

        ui.showCounterFlash(
          "counter",
          `あなたが「${card.name}」を無効化`
        );

        log(
          `【打ち消し】あなたは📘を1つ使い、CPUの「${card.name}」を打ち消しました。`,
          "you"
        );

        if (ai.shouldCounterBack(id)) {
          state.cpu.counters -= 2;

          cancelled = false;

          ui.showCounterFlash(
            "back",
            `CPUが「${card.name}」を通した`
          );

          log(
            `【打ち消し返し】CPUは📘を2つ使い、「${card.name}」を通しました。`,
            "cpu"
          );
        }
      }
    }

    if (!cancelled) {
      await resolveSpellEffect(
        effectContext,
        who,
        id
      );
    }

    if (
      card.type === "spell" ||
      card.type === "summon" ||
      cancelled
    ) {
      getDiscard(
        state,
        who
      ).push(id);
    }

    if (who === "player") {
      state.playsUsed++;
    }

    checkGameOver();

    ui.render(state);
  }

  function discardCpuToLimit() {
    while (state.cpu.hand.length > 5) {
      const index = ai.chooseDiscardIndex();

      const [id] = state.cpu.hand.splice(
        index,
        1
      );

      state.cpuDiscard.push(id);

      log(
        `CPUは手札上限で「${CARDS[id].name}」を捨てました。`,
        "cpu"
      );
    }
  }

  async function cpuTurn() {
    if (!state || state.over) return;

    const epoch = state.epoch;

    cpuTimer = null;

    const openingCpu =
      state.opening &&
      state.starter === "cpu";

    state.turn = "cpu";

    ui.render(state);

    await wait(220);

    if (
      !state ||
      state.epoch !== epoch ||
      state.over
    ) {
      return;
    }

    if (!openingCpu) {
      await startFieldEffects("cpu");

      if (
        !state ||
        state.epoch !== epoch ||
        state.over
      ) {
        return;
      }

      draw("cpu");

      ui.render(state);

      await wait(260);

      if (
        !state ||
        state.epoch !== epoch ||
        state.over
      ) {
        return;
      }
    }

    const penalty = openingCpu
      ? 0
      : state.cpu.limitPenalty || 0;

    if (!openingCpu) {
      state.cpu.limitPenalty = 0;
    }

    let limit = openingCpu
      ? 1
      : Math.max(
          0,
          2 - penalty
        );

    let used = 0;

    state.cpuBonus = 0;

    if (penalty) {
      log(
        `封魔の霧により、CPUの使用上限は${limit}枚です。`,
        "cpu"
      );
    }

    while (
      used < limit &&
      state.cpu.hand.length &&
      !state.over
    ) {
      const index =
        ai.chooseActionIndex({
          opening: openingCpu,
        });

      if (index < 0) break;

      log(
        `CPUは「${CARDS[state.cpu.hand[index]].name}」を使います。`,
        "cpu"
      );

      ui.render(state);

      await wait(180);

      if (
        !state ||
        state.epoch !== epoch ||
        state.over
      ) {
        return;
      }

      await playCard(
        "cpu",
        index
      );

      if (
        !state ||
        state.epoch !== epoch ||
        state.over
      ) {
        return;
      }

      if (state.cpuBonus) {
        if (!openingCpu) {
          limit += state.cpuBonus;
        }

        state.cpuBonus = 0;
      }

      used++;

      await wait(220);

      if (
        !state ||
        state.epoch !== epoch ||
        state.over
      ) {
        return;
      }
    }

    if (state.over) return;

    discardCpuToLimit();

    ui.render(state);

    await wait(200);

    if (
      !state ||
      state.epoch !== epoch ||
      state.over
    ) {
      return;
    }

    log(
      "CPUはターン終了。",
      "cpu"
    );

    if (openingCpu) {
      state.opening = false;
    }

    if (finishByDeck()) {
      return;
    }

    if (state.starter === "player") {
      state.turnNo++;
    }

    await startPlayerTurn();
  }

  async function startPlayerTurn() {
    if (state.over) return;

    state.turn = "player";
    state.playsUsed = 0;

    const penalty =
      state.player.limitPenalty || 0;

    state.player.limitPenalty = 0;

    state.playLimit = Math.max(
      0,
      2 - penalty
    );

    state.selected = null;
    state.first = false;

    if (penalty) {
      log(
        `封魔の霧により、あなたの使用上限は${state.playLimit}枚です。`,
        "you"
      );
    }

    await startFieldEffects(
      "player"
    );

    if (state.over) return;

    draw("player");

    ui.render(state);

    checkGameOver();
  }

  function handoffToCpu(
    delay = 230
  ) {
    const openingPlayer =
      state.opening &&
      state.starter === "player";

    if (openingPlayer) {
      state.opening = false;
    }

    if (state.starter === "cpu") {
      state.turnNo++;
    }

    state.turn = "cpu";
    state.selected = null;

    ui.render(state);

    cpuTimer = setTimeout(
      cpuTurn,
      delay
    );
  }

  function endPlayerTurn() {
    if (
      state.over ||
      state.turn !== "player"
    ) {
      return;
    }

    if (
      state.player.hand.length > 5
    ) {
      state.discardMode = true;
      state.selected = null;

      ui.render(state);

      return;
    }

    if (finishByDeck()) return;

    handoffToCpu(230);
  }

  function discardSelected() {
    if (state.selected === null) {
      return;
    }

    const [id] =
      state.player.hand.splice(
        state.selected,
        1
      );

    state.playerDiscard.push(id);

    log(
      `手札上限で「${CARDS[id].name}」を捨てました。`,
      "you"
    );

    state.selected = null;

    if (
      state.player.hand.length <= 5
    ) {
      state.discardMode = false;

      if (finishByDeck()) {
        return;
      }

      handoffToCpu(200);
    } else {
      ui.render(state);
    }
  }

  function selectCard(index) {
    if (
      !state ||
      state.over ||
      state.turn !== "player"
    ) {
      return;
    }

    state.selected =
      state.selected === index
        ? null
        : index;

    ui.render(state);
  }

  async function playSelected() {
    if (
      !state ||
      state.turn !== "player" ||
      state.selected === null
    ) {
      return;
    }

    if (state.discardMode) {
      discardSelected();
      return;
    }

    if (
      state.playsUsed >=
      state.playLimit
    ) {
      return;
    }

    const index =
      state.selected;

    state.selected = null;

    await playCard(
      "player",
      index
    );

    ui.render(state);
  }

  function startGame(
    build,
    difficulty = "normal"
  ) {
    if (cpuTimer) {
      clearTimeout(cpuTimer);
      cpuTimer = null;
    }

    gameEpoch++;

    const savedBuild =
      cloneBuild(build);

    const cpuChoice =
      pickCpuDeck(
        difficulty,
        random
      );

    const starter =
      random() < 0.5
        ? "player"
        : "cpu";

    state = {
      epoch: gameEpoch,

      difficulty:
        cpuChoice.difficulty,

      cpuDeckName:
        cpuChoice.name,

      build:
        savedBuild,

      cpuBuild:
        cloneBuild(
          cpuChoice.build
        ),

      playerDeck:
        buildDeck(
          savedBuild,
          random
        ),

      cpuDeck:
        buildDeck(
          cpuChoice.build,
          random
        ),

      playerDiscard: [],
      cpuDiscard: [],

      player:
        createSideState(),

      cpu:
        createSideState(),

      starter,
      opening: true,
      turn: starter,

      selected: null,

      playsUsed: 0,

      playLimit:
        starter === "player"
          ? 1
          : 2,

      first:
        starter === "player",

      over: false,
      turnNo: 1,
      cpuBonus: 0,
      discardMode: false,
    };

    for (
      let i = 0;
      i < 5;
      i++
    ) {
      draw(
        "player",
        false
      );

      draw(
        "cpu",
        false
      );
    }

    ui.clearForGameStart();

    log(
      `ゲーム開始。CPUは${cpuChoice.difficulty.toUpperCase()}の専用デッキ「${cpuChoice.name}」で参戦。`
    );

    log(
      `${
        starter === "player"
          ? "あなた"
          : "CPU"
      }が先攻。先攻1ターン目はドローなし・カード1枚まで。`
    );

    log(
      `あなたのドラゴンは ${build.dragons
        .map(
          (id) =>
            CARDS[id].name
        )
        .join("／")}。`
    );

    ui.render(state);

    if (starter === "cpu") {
      cpuTimer =
        setTimeout(
          cpuTurn,
          450
        );
    }
  }

  function reset() {
    if (cpuTimer) {
      clearTimeout(cpuTimer);
      cpuTimer = null;
    }

    gameEpoch++;

    if (state) {
      state.over = true;
    }

    ui.openSetup();
  }

  ui.setStateProvider(
    getState
  );

  ui.bindControls({
    selectCard,
    playSelected,
    endTurn:
      endPlayerTurn,
    reset,
    startGame,
  });

  return {
    getState,
    reset,
    startGame,
    playCard,
    checkGameOver,
    finishByDeck,
  };
}
