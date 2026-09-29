export function hasDragon(state, who, id) {
  return state[who].field.some((card) => card.id === id);
}

export function changeHp(state, who, delta) {
  const before = state[who].hp;

  state[who].hp = Math.max(
    0,
    Math.min(4, before + delta)
  );

  return state[who].hp - before;
}

export function createCombatApi({
  getState,
  ui,
  log,
}) {
  function turnKey() {
    const state = getState();

    return `${state.turn}:${state.turnNo}`;
  }

  function damage(
    attacker,
    target,
    amount,
    allowReflect = true
  ) {
    const state = getState();

    if (amount <= 0) {
      return 0;
    }

    let actual = amount;

    const key = turnKey();
    const defender = state[target];

    if (
      attacker !== target &&
      hasDragon(
        state,
        target,
        "shell"
      ) &&
      defender.shellKey !== key
    ) {
      defender.shellKey = key;

      actual = Math.max(
        0,
        actual - 1
      );

      log(
        `${
          target === "player"
            ? "あなた"
            : "CPU"
        }の「甲殻竜」が最初のダメージを1軽減。`,
        target === "player"
          ? "you"
          : "cpu"
      );
    }

    if (actual <= 0) {
      return 0;
    }

    const dealt =
      -changeHp(
        state,
        target,
        -actual
      );

    ui.renderHearts(
      state,
      target
    );

    ui.showHpDelta(
      target,
      -dealt
    );

    if (
      attacker !== target &&
      allowReflect &&
      dealt > 0 &&
      hasDragon(
        state,
        target,
        "mirror"
      ) &&
      defender.mirrorKey !== key
    ) {
      defender.mirrorKey = key;

      log(
        `${
          target === "player"
            ? "あなた"
            : "CPU"
        }の「ミラードラゴン」が${dealt}ダメージを反射！`,
        target === "player"
          ? "you"
          : "cpu"
      );

      damage(
        target,
        attacker,
        dealt,
        false
      );
    }

    return dealt;
  }

  function heal(who, amount) {
    const state = getState();

    const enemy =
      who === "player"
        ? "cpu"
        : "player";

    if (
      hasDragon(
        state,
        enemy,
        "void"
      )
    ) {
      log(
        `${
          enemy === "player"
            ? "あなた"
            : "CPU"
        }の「虚無竜」により回復できません。`,
        enemy === "player"
          ? "you"
          : "cpu"
      );

      return 0;
    }

    const healed = Math.max(
      0,
      changeHp(
        state,
        who,
        amount
      )
    );

    ui.renderHearts(
      state,
      who
    );

    if (healed > 0) {
      ui.showHpDelta(
        who,
        healed
      );
    }

    return healed;
  }

  return {
    damage,
    heal,

    hasDragon: (
      who,
      id
    ) =>
      hasDragon(
        getState(),
        who,
        id
      ),
  };
}
