import { CARDS } from "./cards.js";

export async function resolveSpellEffect(ctx, who, id) {
  const state = ctx.getState();
  const me = state[who];
  const opponentName = who === "player" ? "cpu" : "player";
  const opponent = state[opponentName];
  const actor = who === "player" ? "あなた" : "CPU";
  const logClass = who === "player" ? "you" : "cpu";

  const effects = {
    async spark() {
      ctx.damage(who, opponentName, 1);
      ctx.log(`${actor}の「火花」！ 相手に1ダメージ。`, logClass);
    },

    async heal() {
      const healed = ctx.heal(who, 1);

      if (healed === 0 && me.hp >= 4) {
        ctx.ui.showMaxLife(who);
        ctx.log(`${actor}は「治癒の雫」を使いましたが、ライフは最大です。`, logClass);
      } else {
        ctx.log(`${actor}はライフを${healed}回復。`, logClass);
      }
    },

    async study() {
      ctx.drawCards(who, 2, false);
      ctx.log(`${actor}は「魔力研究」で2枚引きました。`, logClass);
    },

    async cycle() {
      ctx.drawCards(who, 2, false);
      await ctx.discardFromHand(who, 1, "魔力循環");
      ctx.log(`${actor}の「魔力循環」。2枚引いて1枚捨てました。`, logClass);
    },

    async surge() {
      ctx.drawCards(who, 3, false);
      await ctx.discardFromHand(who, 2, "知識の奔流");
      ctx.log(`${actor}の「知識の奔流」。3枚引いて2枚捨てました。`, logClass);
    },

    async steal() {
      if (!opponent.hand.length) {
        ctx.log("相手の手札がなく空振り。");
        return;
      }

      const index = Math.floor(ctx.random() * opponent.hand.length);
      const [cardId] = opponent.hand.splice(index, 1);

      ctx.getDiscard(opponentName).push(cardId);

      ctx.log(
        `${actor}は相手の「${CARDS[cardId].name}」を捨てました。`,
        logClass
      );
    },

    async recall() {
      const pile = ctx.getDiscard(who);

      if (!pile.length) {
        ctx.log(`${actor}の捨て札がなく空振り。`);
        return;
      }

      const index =
        who === "player"
          ? await ctx.ui.chooseCard(
              "記憶の糸",
              "手札に加える捨て札を1枚選んでください。",
              pile
            )
          : ctx.ai.chooseFrom(pile, "discard");

      const [cardId] = pile.splice(index, 1);

      me.hand.push(cardId);

      ctx.log(
        `${actor}は「記憶の糸」で「${CARDS[cardId].name}」を手札に加えました。`,
        logClass
      );
    },

    async foresee() {
      const deck = ctx.getDeck(who);

      if (!deck.length) {
        ctx.log(`${actor}の山札がなく空振り。`);
        return;
      }

      const index =
        who === "player"
          ? await ctx.ui.chooseCard(
              "星読み",
              "手札に加えるカードを1枚選んでください。",
              deck
            )
          : ctx.ai.chooseFrom(deck, "deck");

      const [cardId] = deck.splice(index, 1);

      me.hand.push(cardId);

      ctx.log(
        `${actor}は「星読み」で「${CARDS[cardId].name}」を山札から手札に加えました。`,
        logClass
      );
    },

    async banish() {
      if (!opponent.field.length) {
        ctx.log("相手の場にドラゴンがなく空振り。");
        return;
      }

      let index;

      if (who === "player") {
        index = await ctx.ui.chooseCard(
          "竜払い",
          "捨てるドラゴンを選んでください。",
          opponent.field.map((entry) => entry.id)
        );
      } else {
        index = 0;

        for (let i = 1; i < opponent.field.length; i++) {
          if (
            CARDS[opponent.field[i].id].threat >
            CARDS[opponent.field[index].id].threat
          ) {
            index = i;
          }
        }
      }

      const target = opponent.field[index];

      if (target.id === "phantom" && !target.banishShieldUsed) {
        target.banishShieldUsed = true;

        ctx.log(
          `${opponentName === "player" ? "あなた" : "CPU"}の「幻影竜」が竜払いを1回無効化！`,
          opponentName === "player" ? "you" : "cpu"
        );

        return;
      }

      const [removed] = opponent.field.splice(index, 1);

      ctx.getDiscard(opponentName).push(removed.id);

      ctx.log(
        `${actor}は「竜払い」で「${CARDS[removed.id].name}」を捨てました。`,
        logClass
      );
    },

    async echo() {
      if (state.opening && state.starter === who) {
        ctx.log(
          `${actor}の「連唱」！ ただし先攻1ターン目の1枚制限は増やせません。`,
          logClass
        );

        return;
      }

      if (who === "player") {
        state.playLimit += 2;
      } else {
        state.cpuBonus += 2;
      }

      ctx.log(
        `${actor}の「連唱」！ このターンのカード使用上限が2増えました。`,
        logClass
      );
    },

    async fog() {
      opponent.limitPenalty = (opponent.limitPenalty || 0) + 1;

      ctx.log(
        `${actor}の「封魔の霧」。相手の次ターンの使用上限が1減ります。`,
        logClass
      );
    },

    async ward() {
      const before = me.counters;

      me.counters = Math.min(3, me.counters + 1);

      ctx.log(
        `${actor}の打消が${me.counters - before}回復。`,
        logClass
      );
    },

    async inferno() {
      ctx.damage(who, opponentName, 2);
      ctx.damage(who, who, 1, false);

      ctx.log(
        `${actor}の業火！ 相手2、自分1ダメージ。`,
        logClass
      );
    },

    async revive() {
      const entries = ctx.reviveEntries();

      if (!entries.length) {
        ctx.log("捨て札に復活できるドラゴンがなく空振り。");
        return;
      }

      let pick;

      if (who === "player") {
        pick = await ctx.ui.chooseEntry(
          "竜魂還し",
          "復活させるドラゴンを選んでください。敵の捨て札からも選べます。",
          entries
        );
      } else {
        pick = 0;

        for (let i = 1; i < entries.length; i++) {
          if (
            CARDS[entries[i].id].threat >
            CARDS[entries[pick].id].threat
          ) {
            pick = i;
          }
        }
      }

      const entry = entries[pick];
      const pile = ctx.getDiscard(entry.source);

      const [removedId] = pile.splice(entry.index, 1);

      me.field.push({
        id: removedId,
        banishShieldUsed: false,
      });

      ctx.ui.queueFieldAnimation(who, removedId);

      ctx.log(
        `${actor}は「竜魂還し」で${entry.source === who ? "自分" : "相手"}の捨て札から「${CARDS[removedId].name}」を復活させました。`,
        logClass
      );
    },

    async sacrifice() {
      if (!me.field.length) {
        ctx.log("自分の場に生贄にできるドラゴンがなく空振り。");
        return;
      }

      let index = 0;

      if (who === "player") {
        index = await ctx.ui.chooseCard(
          "竜の残響",
          "捨て札にする自分のドラゴンを選んでください。",
          me.field.map((entry) => entry.id)
        );
      } else {
        let lowest = Infinity;

        me.field.forEach((entry, i) => {
          if (CARDS[entry.id].threat < lowest) {
            lowest = CARDS[entry.id].threat;
            index = i;
          }
        });
      }

      const [removed] = me.field.splice(index, 1);

      ctx.getDiscard(who).push(removed.id);

      ctx.damage(who, opponentName, 3);

      ctx.log(
        `${actor}は「${CARDS[removed.id].name}」を捧げ、「竜の残響」で3ダメージ！`,
        logClass
      );
    },
  };

  const handler = effects[id];

  if (!handler) {
    throw new Error(`未実装のカード効果: ${id}`);
  }

  await handler();
}

export async function resolveDragonTurnStart(ctx, who, fieldCard) {
  const state = ctx.getState();
  const me = state[who];

  const enemy =
    who === "player"
      ? "cpu"
      : "player";

  const actor =
    who === "player"
      ? "あなた"
      : "CPU";

  const logClass =
    who === "player"
      ? "you"
      : "cpu";

  const id = fieldCard.id;

  if (id === "life") {
    if (me.hp <= 3) {
      const healed = ctx.heal(who, 1);

      ctx.log(
        `${actor}の「生命竜」で${healed}回復。`,
        logClass
      );
    }

    return;
  }

  if (id === "sage") {
    const drawn = ctx.draw(who, false);

    if (drawn !== null) {
      let index;

      if (who === "player") {
        index = await ctx.ui.chooseCard(
          "賢竜",
          "1枚引きました。手札から1枚捨ててください。",
          me.hand
        );
      } else {
        index = ctx.ai.chooseDiscardIndex();
      }

      const [discarded] = me.hand.splice(index, 1);

      ctx.getDiscard(who).push(discarded);

      ctx.log(
        `${actor}の「賢竜」：1枚引き、「${CARDS[discarded].name}」を捨てました。`,
        logClass
      );
    }

    return;
  }

  if (id === "berserk") {
    ctx.damage(who, enemy, 2);
    ctx.damage(who, who, 1, false);

    ctx.log(
      `${actor}の「暴竜」！ 相手2、自分1ダメージ。`,
      logClass
    );

    return;
  }

  const damage = CARDS[id].attack || 0;

  if (damage > 0) {
    ctx.damage(who, enemy, damage);

    ctx.log(
      `${actor}の「${CARDS[id].name}」が攻撃！ ${damage}ダメージ。`,
      logClass
    );
  }
}
