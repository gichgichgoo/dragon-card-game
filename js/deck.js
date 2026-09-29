export function shuffle(array, random = Math.random) {
  const result = [...array];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

export function cloneBuild(build) {
  return {
    dragons: [...(build.dragons || [])],
    summon: { ...(build.summon || {}) },
    basic: { ...(build.basic || {}) },
    tactical: { ...(build.tactical || {}) },
    powerful: { ...(build.powerful || {}) },
  };
}

export function buildDeck(build, random = Math.random) {
  const cards = [];

  for (const dragonId of build.dragons || []) {
    cards.push(dragonId);
  }

  for (const tier of ["summon", "basic", "tactical", "powerful"]) {
    const tierCards = build[tier] || {};

    for (const [id, count] of Object.entries(tierCards)) {
      for (let i = 0; i < count; i++) {
        cards.push(id);
      }
    }
  }

  return shuffle(cards, random);
}

export function createSideState() {
  return {
    hp: 4,
    counters: 2,
    hand: [],
    field: [],
    mirrorKey: "",
    shellKey: "",
    limitPenalty: 0,
  };
}

export function getDeck(state, who) {
  return who === "player"
    ? state.playerDeck
    : state.cpuDeck;
}

export function getDiscard(state, who) {
  return who === "player"
    ? state.playerDiscard
    : state.cpuDiscard;
}

export function drawCard(state, who) {
  const deck = getDeck(state, who);

  if (!deck.length) {
    return null;
  }

  const id = deck.pop();

  state[who].hand.push(id);

  return id;
}

export function drawCards(state, who, count) {
  const drawn = [];

  for (let i = 0; i < count; i++) {
    const id = drawCard(state, who);

    if (id === null) {
      break;
    }

    drawn.push(id);
  }

  return drawn;
}

export function discardCard(state, who, handIndex) {
  const hand = state[who].hand;

  if (
    handIndex < 0 ||
    handIndex >= hand.length
  ) {
    return null;
  }

  const [id] = hand.splice(handIndex, 1);

  getDiscard(state, who).push(id);

  return id;
}

export function moveDiscardToHand(state, who, discardIndex) {
  const pile = getDiscard(state, who);

  if (
    discardIndex < 0 ||
    discardIndex >= pile.length
  ) {
    return null;
  }

  const [id] = pile.splice(discardIndex, 1);

  state[who].hand.push(id);

  return id;
}

export function moveDeckCardToHand(state, who, deckIndex) {
  const deck = getDeck(state, who);

  if (
    deckIndex < 0 ||
    deckIndex >= deck.length
  ) {
    return null;
  }

  const [id] = deck.splice(deckIndex, 1);

  state[who].hand.push(id);

  return id;
}

export function discardFieldCard(state, who, fieldIndex) {
  const field = state[who].field;

  if (
    fieldIndex < 0 ||
    fieldIndex >= field.length
  ) {
    return null;
  }

  const [entry] = field.splice(fieldIndex, 1);

  getDiscard(state, who).push(entry.id);

  return entry;
}

export function addDragonToField(state, who, id) {
  const entry = {
    id,
    banishShieldUsed: false,
  };

  state[who].field.push(entry);

  return entry;
}
