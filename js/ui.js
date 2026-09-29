import { CARDS, DRAGON_POOL, SPELL_POOLS, BUILD_LIMITS, cardTypeLabel, isDragon } from "./cards.js";

const $ = (id) => document.getElementById(id);

export function createUI() {
  const refs = {
    setup: $("setupModal"), setupGrid: $("dragonSetupGrid"), setupCount: $("setupSelectedCount"), setupHint: $("setupHint"), startGame: $("startGameBtn"),
    diffEasy: $("diffEasy"), diffNormal: $("diffNormal"), diffHard: $("diffHard"),
    dragonBuildCount: $("dragonBuildCount"), basicBuildCount: $("basicBuildCount"), tacticalBuildCount: $("tacticalBuildCount"), powerfulBuildCount: $("powerfulBuildCount"),
    basicGrid: $("basicSetupGrid"), tacticalGrid: $("tacticalSetupGrid"), powerfulGrid: $("powerfulSetupGrid"),
    pHearts: $("playerHearts"), cHearts: $("cpuHearts"), pCounters: $("playerCounters"), cCounters: $("cpuCounters"),
    cHandN: $("cpuHandCount"), pDeckN: $("playerDeckCount"), cDeckN: $("cpuDeckCount"), turnNo: $("turnNo"),
    pHand: $("playerHand"), cHand: $("cpuHand"), pField: $("playerField"), cField: $("cpuField"),
    pDiscardBtn: $("playerDiscardBtn"), cDiscardBtn: $("cpuDiscardBtn"), pDiscardCount: $("playerDiscardCount"), cDiscardCount: $("cpuDiscardCount"),
    discard: $("discardModal"), discardTitle: $("discardTitle"), discardGrid: $("discardGrid"),
    log: $("log"), logModal: $("logModal"), banner: $("turnBanner"), play: $("playBtn"), end: $("endBtn"), hint: $("hint"),
    rules: $("rulesModal"), counter: $("counterModal"), select: $("selectModal"), selectTitle: $("selectTitle"), selectDesc: $("selectDesc"), selectCards: $("selectCards"), result: $("resultModal"),
    counterIcon: $("counterIcon"), counterTitle: $("counterTitle"), counterDesc: $("counterDesc"), counterRule: $("counterRule"), counterPass: $("passCounter"), counterUse: $("useCounter"),
    counterFlash: $("counterFlash"), counterFlashMain: $("counterFlashMain"), counterFlashSub: $("counterFlashSub"),
    resultIcon: $("resultIcon"), resultTitle: $("resultTitle"), resultText: $("resultText"),
  };

  let stateProvider = () => null;
  let handlers = {};
  let counterResolver = null;
  let setupSelection = [];
  let setupSpells = { basic: {}, tactical: {}, powerful: {} };
  let setupDifficulty = "normal";
  let pendingDrawAnimations = [];
  let pendingFieldAnimations = [];
  let animationFlushScheduled = false;

  function setStateProvider(provider) { stateProvider = provider; }

  function log(message, className = "sys") {
    const p = document.createElement("p");
    p.className = className;
    p.textContent = message;
    refs.log.prepend(p);
  }

  function cardElement(id, index = -1, zone = "choice", selected = false) {
    const card = CARDS[id];
    const visual = card.type === "dragon" ? "monster" : "spell";
    const el = document.createElement("div");
    el.className = `card ${visual} ${zone === "hand" ? "selectable" : ""} ${selected ? "selected" : ""}`;
    el.innerHTML = `<div class="icon">${card.icon}</div><div class="title">${card.name}</div><div class="type">${cardTypeLabel(id)}</div><div class="desc">${card.desc}</div>`;
    if (zone === "hand") el.onclick = () => handlers.selectCard?.(index);
    return el;
  }

  function renderHearts(state, who) {
    const meter = who === "player" ? refs.pHearts : refs.cHearts;
    const hp = Math.max(0, Math.min(4, state[who].hp));
    meter.setAttribute("aria-label", `${who === "player" ? "\u3042\u306a\u305f" : "CPU"} \u30e9\u30a4\u30d5${hp}`);
    [...meter.querySelectorAll(".heart")].forEach((heart, index) => {
      heart.classList.toggle("on", index < hp);
      heart.classList.toggle("off", index >= hp);
    });
  }

  function showHpDelta(who, delta) {
    if (!delta) return;
    const meter = who === "player" ? refs.pHearts : refs.cHearts;
    meter.classList.remove("hit", "heal");
    void meter.offsetWidth;
    meter.classList.add(delta < 0 ? "hit" : "heal");
    const floating = document.createElement("span");
    floating.className = `lifeFloat ${delta < 0 ? "damage" : "recovery"}`;
    floating.textContent = delta > 0 ? `+${delta}` : `${delta}`;
    meter.appendChild(floating);
    setTimeout(() => floating.remove(), 950);
  }

  function showMaxLife(who) {
    const meter = who === "player" ? refs.pHearts : refs.cHearts;
    const floating = document.createElement("span");
    floating.className = "lifeFloat recovery";
    floating.textContent = "MAX";
    meter.appendChild(floating);
    setTimeout(() => floating.remove(), 950);
  }

  function renderCounters(state, who) {
    const meter = who === "player" ? refs.pCounters : refs.cCounters;
    const count = Math.max(0, Math.min(3, state[who].counters));
    meter.setAttribute("aria-label", `${who === "player" ? "\u3042\u306a\u305f" : "CPU"} \u6253\u3061\u6d88\u3057${count}`);
    [...meter.querySelectorAll(".counterBook")].forEach((book, index) => {
      book.classList.toggle("bookOn", index < count);
      book.classList.toggle("bookOff", index >= count);
    });
  }

  function canSummonFromUi(state, who, id) {
    return isDragon(id) && (CARDS[id].freeSummon || state[who].hand.includes("summon"));
  }

  function render(state) {
    if (!state) return;
    renderHearts(state, "player");
    renderHearts(state, "cpu");
    renderCounters(state, "player");
    renderCounters(state, "cpu");
    refs.cHandN.textContent = state.cpu.hand.length;
    refs.pDeckN.textContent = state.playerDeck.length;
    refs.cDeckN.textContent = state.cpuDeck.length;
    refs.turnNo.textContent = state.turnNo;

    refs.pHand.innerHTML = "";
    state.player.hand.forEach((id, index) => refs.pHand.appendChild(cardElement(id, index, "hand", state.selected === index)));
    if (!state.player.hand.length) refs.pHand.innerHTML = '<div class="empty">\u624b\u672d\u306a\u3057</div>';

    refs.cHand.innerHTML = "";
    state.cpu.hand.forEach(() => {
      const back = document.createElement("div");
      back.className = "cardback";
      back.textContent = "\u2726";
      refs.cHand.appendChild(back);
    });
    if (!state.cpu.hand.length) refs.cHand.innerHTML = '<div class="empty">\u624b\u672d\u306a\u3057</div>';

    for (const [element, field] of [[refs.pField, state.player.field], [refs.cField, state.cpu.field]]) {
      element.innerHTML = "";
      field.forEach((entry) => element.appendChild(cardElement(entry.id, -1, "field")));
      if (!field.length) element.innerHTML = '<div class="empty">\u9b54\u7269\u306a\u3057</div>';
    }

    refs.pDiscardCount.textContent = state.playerDiscard.length;
    refs.cDiscardCount.textContent = state.cpuDiscard.length;
    refs.banner.className = `turn ${state.turn === "player" ? "you" : "cpu"}`;
    refs.banner.textContent = state.over
      ? "\u30b2\u30fc\u30e0\u7d42\u4e86"
      : state.turn === "player"
        ? (state.opening && state.starter === "player"
          ? `\u3042\u306a\u305f\u306e\u30bf\u30fc\u30f3\u3010\u5148\u653b1\u30bf\u30fc\u30f3\u76ee\u3011\uff5c\u4f7f\u7528 ${state.playsUsed}/${state.playLimit}`
          : `\u3042\u306a\u305f\u306e\u30bf\u30fc\u30f3\uff5c\u4f7f\u7528 ${state.playsUsed}/${state.playLimit}`)
        : (state.opening && state.starter === "cpu" ? "CPU\u306e\u30bf\u30fc\u30f3\u3010\u5148\u653b1\u30bf\u30fc\u30f3\u76ee\u3011" : "CPU\u306e\u30bf\u30fc\u30f3");

    const valid = state.selected !== null && state.player.hand[state.selected];
    const selectedId = valid ? state.player.hand[state.selected] : null;
    const badSummon = selectedId === "summon";
    const needsCircle = isDragon(selectedId) && !canSummonFromUi(state, "player", selectedId);
    refs.play.disabled = state.over || state.turn !== "player" || !valid || (!state.discardMode && (badSummon || needsCircle));
    refs.end.disabled = state.over || state.turn !== "player" || state.discardMode;
    refs.play.textContent = state.discardMode ? "\u3053\u306e\u30ab\u30fc\u30c9\u3092\u6368\u3066\u308b" : isDragon(selectedId) ? "\u30c9\u30e9\u30b4\u30f3\u3092\u53ec\u559a" : "\u30ab\u30fc\u30c9\u3092\u4f7f\u3046";
    refs.hint.textContent = state.discardMode
      ? `\u624b\u672d${state.player.hand.length}\u679a\u30025\u679a\u307e\u3067\u6368\u3066\u3066\u304f\u3060\u3055\u3044\u3002`
      : state.turn === "player" && state.playsUsed >= state.playLimit
        ? "\u3053\u306e\u30bf\u30fc\u30f3\u306b\u4f7f\u3048\u308b\u679a\u6570\u3092\u4f7f\u3044\u5207\u308a\u307e\u3057\u305f\u3002"
        : state.turn !== "player"
          ? "CPU\u304c\u884c\u52d5\u4e2d\u2026"
          : selectedId === "summon"
            ? "\u53ec\u559a\u9663\u306f\u76f4\u63a5\u4f7f\u3044\u307e\u305b\u3093\u3002\u53ec\u559a\u3057\u305f\u3044\u30c9\u30e9\u30b4\u30f3\u3092\u30bf\u30c3\u30d7\u3057\u307e\u3059\u3002"
            : needsCircle
              ? "\u3053\u306e\u30c9\u30e9\u30b4\u30f3\u306b\u306f\u300c\u7adc\u306e\u53ec\u559a\u9663\u300d\u304c\u5fc5\u8981\u3067\u3059\u3002"
              : isDragon(selectedId)
                ? (CARDS[selectedId].freeSummon ? "\u53ec\u559a\u9663\u306a\u3057\u3067\u5834\u306b\u51fa\u305b\u307e\u3059\u3002" : "\u53ec\u559a\u9663\u30921\u679a\u6d88\u8cbb\u3057\u3066\u5834\u306b\u51fa\u3057\u307e\u3059\u3002")
                : "\u30ab\u30fc\u30c9\u3092\u30bf\u30c3\u30d7 \u2192\u300c\u30ab\u30fc\u30c9\u3092\u4f7f\u3046\u300d";

    flushBoardAnimations();
  }

  function openDiscard(who) {
    const state = stateProvider();
    const pile = who === "player" ? state.playerDiscard : state.cpuDiscard;
    refs.discardTitle.textContent = `${who === "player" ? "\u3042\u306a\u305f" : "CPU"}\u306e\u6368\u3066\u672d\uff08${pile.length}\u679a\uff09`;
    refs.discardGrid.innerHTML = "";
    if (!pile.length) {
      refs.discardGrid.innerHTML = '<div class="empty">\u6368\u3066\u672d\u306f\u3042\u308a\u307e\u305b\u3093</div>';
    } else {
      [...pile].reverse().forEach((id) => {
        const card = CARDS[id];
        const item = document.createElement("div");
        item.className = "discardItem";
        item.innerHTML = `<div class="diIcon">${card.icon}</div><div><div class="diName">${card.name}</div><div class="diType">${cardTypeLabel(id)}</div></div>`;
        refs.discardGrid.appendChild(item);
      });
    }
    refs.discard.classList.add("show");
  }

  function motionAllowed() {
    return !window.matchMedia || !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function queueDrawAnimation(who, id) { pendingDrawAnimations.push({ who, id }); }
  function queueFieldAnimation(who, id) { pendingFieldAnimations.push({ who, id }); }

  function animateDraw(who) {
    if (!motionAllowed()) return;
    const deckNode = (who === "player" ? refs.pDeckN : refs.cDeckN).closest(".stat");
    const handNode = who === "player" ? refs.pHand : refs.cHand;
    if (!deckNode || !handNode) return;
    const a = deckNode.getBoundingClientRect();
    const b = handNode.getBoundingClientRect();
    const ghost = document.createElement("div");
    ghost.className = "motionCard back";
    ghost.textContent = "\u2726";
    document.body.appendChild(ghost);
    const sx = a.left + a.width / 2 - 24, sy = a.top + a.height / 2 - 34;
    const tx = Math.min(b.right - 55, b.left + b.width * 0.74) - 24, ty = b.top + b.height / 2 - 34;
    ghost.style.left = `${sx}px`; ghost.style.top = `${sy}px`;
    const dx = tx - sx, dy = ty - sy;
    const anim = ghost.animate([
      { transform: "translate(0,0) rotate(-5deg) scale(.88)", opacity: 0.25 },
      { offset: 0.18, transform: "translate(0,0) rotate(-2deg) scale(1)", opacity: 1 },
      { transform: `translate(${dx}px,${dy}px) rotate(8deg) scale(.94)`, opacity: 1 },
    ], { duration: 520, easing: "cubic-bezier(.2,.8,.2,1)", fill: "forwards" });
    anim.onfinish = () => {
      ghost.remove();
      if (who === "player") {
        const cards = refs.pHand.querySelectorAll(".card");
        const target = cards[cards.length - 1];
        if (target) { target.classList.remove("drawLand"); void target.offsetWidth; target.classList.add("drawLand"); }
      } else {
        const backs = refs.cHand.querySelectorAll(".cardback");
        const target = backs[backs.length - 1];
        if (target) target.animate([{ transform: "scale(.84)", filter: "brightness(1.8)" }, { transform: "scale(1)", filter: "none" }], { duration: 420, easing: "ease-out" });
      }
    };
  }

  function animateField(who, id) {
    if (!motionAllowed()) return;
    const handNode = who === "player" ? refs.pHand : refs.cHand;
    const fieldNode = who === "player" ? refs.pField : refs.cField;
    if (!handNode || !fieldNode) return;
    const cards = fieldNode.querySelectorAll(".card");
    const target = cards[cards.length - 1];
    if (!target) return;
    const a = handNode.getBoundingClientRect();
    const b = target.getBoundingClientRect();
    const card = CARDS[id];
    const ghost = document.createElement("div");
    ghost.className = `motionCard face ${card.type === "dragon" ? "dragon" : ""}`;
    ghost.innerHTML = `<div class="mIcon">${card.icon}</div><div class="mName">${card.name}</div><div class="mText">${card.desc}</div>`;
    document.body.appendChild(ghost);
    const sx = a.left + a.width / 2 - 56, sy = a.top + a.height / 2 - 66;
    const tx = b.left + b.width / 2 - 56, ty = b.top + b.height / 2 - 66;
    ghost.style.left = `${sx}px`; ghost.style.top = `${sy}px`;
    const dx = tx - sx, dy = ty - sy;
    const anim = ghost.animate([
      { transform: "translate(0,0) scale(.74) rotate(-5deg)", opacity: 0 },
      { offset: 0.18, transform: "translate(0,-12px) scale(1.06) rotate(0deg)", opacity: 1 },
      { offset: 0.7, transform: `translate(${dx * 0.82}px,${dy * 0.82}px) scale(1.03) rotate(2deg)`, opacity: 1 },
      { transform: `translate(${dx}px,${dy}px) scale(.9) rotate(0deg)`, opacity: 0 },
    ], { duration: 720, easing: "cubic-bezier(.18,.78,.22,1)", fill: "forwards" });
    anim.onfinish = () => {
      ghost.remove();
      target.classList.remove("fieldLand"); void target.offsetWidth; target.classList.add("fieldLand");
    };
  }

  function flushBoardAnimations() {
    if (animationFlushScheduled) return;
    animationFlushScheduled = true;
    requestAnimationFrame(() => {
      animationFlushScheduled = false;
      const draws = pendingDrawAnimations.splice(0);
      const fields = pendingFieldAnimations.splice(0);
      draws.forEach((item, index) => setTimeout(() => animateDraw(item.who), index * 160));
      fields.forEach((item, index) => setTimeout(() => animateField(item.who, item.id), 220 + index * 170));
    });
  }

  function showResult(title, text, icon) {
    const state = stateProvider();
    render(state);
    refs.resultTitle.textContent = title;
    refs.resultText.textContent = text;
    refs.resultIcon.textContent = icon;
    setTimeout(() => refs.result.classList.add("show"), 150);
  }

  function showCounterFlash(kind, sub = "") {
    refs.counterFlash.classList.remove("show", "back", "play", "dragon", "summon");
    void refs.counterFlash.offsetWidth;
    refs.counterFlashMain.textContent = kind === "back" ? "\u6253\u3061\u6d88\u3057\u8fd4\u3057\uff01" : "\u6253\u3061\u6d88\u3057\uff01";
    refs.counterFlashSub.textContent = sub;
    if (kind === "back") refs.counterFlash.classList.add("back");
    refs.counterFlash.classList.add("show");
  }

  function showOpponentPlay(id, isSummon = false) {
    const card = CARDS[id];
    refs.counterFlash.classList.remove("show", "back", "play", "dragon", "summon");
    void refs.counterFlash.offsetWidth;
    refs.counterFlashMain.textContent = `${card.icon} ${card.name}`;
    refs.counterFlashSub.textContent = `${isSummon ? "\u53ec\u559a\uff5c" : "CPU\uff5c"}${card.desc}`;
    refs.counterFlash.classList.add("play");
    if (card.type === "dragon") refs.counterFlash.classList.add("dragon");
    if (card.type === "summon") refs.counterFlash.classList.add("summon");
    refs.counterFlash.classList.add("show");
    return new Promise((resolve) => setTimeout(resolve, 1050));
  }

  function askCounter(id) {
    const state = stateProvider();
    if (state.player.counters <= 0) return Promise.resolve(false);
    const card = CARDS[id];
    refs.counterIcon.textContent = card.icon;
    refs.counterTitle.textContent = `CPU\u304c\u300c${card.name}\u300d\u3092\u4f7f\u7528`;
    refs.counterDesc.textContent = card.desc;
    refs.counterRule.textContent = "\ud83d\udcd8\u30921\u3064\u4f7f\u3046\u3068\u3001\u3053\u306e\u30ab\u30fc\u30c9\u3092\u7121\u52b9\u5316\u3067\u304d\u307e\u3059\u3002";
    refs.counterPass.textContent = "\u901a\u3059";
    refs.counterUse.textContent = "\u6253\u3061\u6d88\u3059";
    refs.counter.classList.add("show");
    return new Promise((resolve) => { counterResolver = resolve; });
  }

  function askCounterBack(id) {
    const state = stateProvider();
    if (state.player.counters < 2) return Promise.resolve(false);
    const card = CARDS[id];
    refs.counterIcon.textContent = "\ud83d\udcd8";
    refs.counterTitle.textContent = "CPU\u304c\u6253\u3061\u6d88\u3057\u307e\u3057\u305f";
    refs.counterDesc.textContent = `\u300c${card.name}\u300d\u3092\u901a\u3059\u305f\u3081\u3001\u6253\u3061\u6d88\u3057\u8fd4\u3057\u3092\u3057\u307e\u3059\u304b\uff1f`;
    refs.counterRule.textContent = "\ud83d\udcd8\u30922\u3064\u4f7f\u3046\u3068CPU\u306e\u6253\u3061\u6d88\u3057\u3092\u7121\u52b9\u5316\u3067\u304d\u307e\u3059\u3002\u3053\u308c\u4ee5\u4e0a\u306e\u6253\u3061\u6d88\u3057\u8fd4\u3057\u306f\u3067\u304d\u307e\u305b\u3093\u3002";
    refs.counterPass.textContent = "\u3042\u304d\u3089\u3081\u308b";
    refs.counterUse.textContent = "2\u3064\u4f7f\u3063\u3066\u8fd4\u3059";
    refs.counter.classList.add("show");
    return new Promise((resolve) => { counterResolver = resolve; });
  }

  function closeCounter(value) {
    refs.counter.classList.remove("show");
    const resolve = counterResolver;
    counterResolver = null;
    resolve?.(value);
  }

  function chooseCard(title, desc, items) {
    return new Promise((resolve) => {
      refs.selectTitle.textContent = title;
      refs.selectDesc.textContent = desc;
      refs.selectCards.innerHTML = "";
      items.forEach((id, index) => {
        const el = cardElement(id);
        el.style.cursor = "pointer";
        el.onclick = () => { refs.select.classList.remove("show"); resolve(index); };
        refs.selectCards.appendChild(el);
      });
      refs.select.classList.add("show");
    });
  }

  function chooseEntry(title, desc, entries) {
    return new Promise((resolve) => {
      refs.selectTitle.textContent = title;
      refs.selectDesc.textContent = desc;
      refs.selectCards.innerHTML = "";
      entries.forEach((entry, index) => {
        const wrap = document.createElement("div");
        wrap.style.minWidth = "0";
        const el = cardElement(entry.id);
        el.style.cursor = "pointer";
        el.onclick = () => { refs.select.classList.remove("show"); resolve(index); };
        wrap.appendChild(el);
        if (entry.label) {
          const label = document.createElement("div");
          label.className = "note";
          label.style.textAlign = "center";
          label.style.marginTop = "3px";
          label.textContent = entry.label;
          wrap.appendChild(label);
        }
        refs.selectCards.appendChild(wrap);
      });
      refs.select.classList.add("show");
    });
  }

  function tierTotal(tier) {
    return Object.values(setupSpells[tier] ?? {}).reduce((sum, count) => sum + count, 0);
  }

  function setupReady() {
    return setupSelection.length === BUILD_LIMITS.dragons
      && tierTotal("basic") === BUILD_LIMITS.basic
      && tierTotal("tactical") === BUILD_LIMITS.tactical
      && tierTotal("powerful") === BUILD_LIMITS.powerful;
  }

  function setupTotal() {
    return 2 + setupSelection.length + tierTotal("basic") + tierTotal("tactical") + tierTotal("powerful");
  }

  function refreshDifficultyButtons() {
    [refs.diffEasy, refs.diffNormal, refs.diffHard].forEach((button) => button.classList.toggle("selected", button.dataset.diff === setupDifficulty));
  }

  function refreshSetup() {
    refs.setupCount.textContent = setupTotal();
    refs.dragonBuildCount.textContent = `${setupSelection.length}/${BUILD_LIMITS.dragons}`;
    refs.basicBuildCount.textContent = `${tierTotal("basic")}/${BUILD_LIMITS.basic}`;
    refs.tacticalBuildCount.textContent = `${tierTotal("tactical")}/${BUILD_LIMITS.tactical}`;
    refs.powerfulBuildCount.textContent = `${tierTotal("powerful")}/${BUILD_LIMITS.powerful}`;
    refs.startGame.disabled = !setupReady();
    refs.setupHint.textContent = setupReady() ? "16\u679a\u5b8c\u6210\u3002\u30b2\u30fc\u30e0\u3092\u958b\u59cb\u3067\u304d\u307e\u3059\u3002" : "\u30c9\u30e9\u30b4\u30f33\u30fb\u57fa\u672c5\u30fb\u6226\u88534\u30fb\u5f37\u529b2\u3092\u9078\u3093\u3067\u304f\u3060\u3055\u3044\u3002";
    document.querySelectorAll(".spellPick").forEach((row) => {
      const tier = row.dataset.tier;
      const id = row.dataset.id;
      const count = setupSpells[tier][id] ?? 0;
      row.classList.toggle("active", count > 0);
      row.querySelector(".spellCount").textContent = count;
      row.querySelector(".spellPlus").disabled = tierTotal(tier) >= BUILD_LIMITS[tier];
      row.querySelector(".spellMinus").disabled = count <= 0;
    });
  }

  function buildSpellSetup(tier, pool, host) {
    host.innerHTML = "";
    pool.forEach((id) => {
      const card = CARDS[id];
      const row = document.createElement("div");
      row.className = "spellPick";
      row.dataset.tier = tier;
      row.dataset.id = id;
      row.innerHTML = `<div class="spellPickInfo"><div class="spellPickTop"><span class="spellPickIcon">${card.icon}</span><span class="spellPickName">${card.name}</span></div><div class="spellPickDesc">${card.desc}</div></div><div class="spellCounter"><button type="button" class="spellMinus">\u2212</button><div class="spellCount">0</div><button type="button" class="spellPlus">\uff0b</button></div>`;
      row.querySelector(".spellMinus").onclick = () => {
        const count = setupSpells[tier][id] ?? 0;
        if (count > 0) setupSpells[tier][id] = count - 1;
        refreshSetup();
      };
      row.querySelector(".spellPlus").onclick = () => {
        if (tierTotal(tier) >= BUILD_LIMITS[tier]) return;
        setupSpells[tier][id] = (setupSpells[tier][id] ?? 0) + 1;
        refreshSetup();
      };
      host.appendChild(row);
    });
  }

  function openSetup() {
    setupSelection = [];
    setupSpells = { basic: {}, tactical: {}, powerful: {} };
    setupDifficulty = "normal";
    refs.setupGrid.innerHTML = "";
    DRAGON_POOL.forEach((id) => {
      const card = CARDS[id];
      const button = document.createElement("button");
      button.type = "button";
      button.className = "dragonPick";
      const cost = card.freeSummon ? "\u53ec\u559a\u9663\u4e0d\u8981" : "\u53ec\u559a\u96631\u679a";
      button.innerHTML = `<div class="dpTop"><span class="dpIcon">${card.icon}</span><span class="dpName">${card.name}</span></div><div class="dpDesc">${card.desc}</div><div class="dpCost">${cost}</div>`;
      button.onclick = () => {
        const current = setupSelection.indexOf(id);
        if (current >= 0) setupSelection.splice(current, 1);
        else if (setupSelection.length < BUILD_LIMITS.dragons) setupSelection.push(id);
        [...refs.setupGrid.children].forEach((el, index) => el.classList.toggle("selected", setupSelection.includes(DRAGON_POOL[index])));
        refreshSetup();
      };
      refs.setupGrid.appendChild(button);
    });
    buildSpellSetup("basic", SPELL_POOLS.basic, refs.basicGrid);
    buildSpellSetup("tactical", SPELL_POOLS.tactical, refs.tacticalGrid);
    buildSpellSetup("powerful", SPELL_POOLS.powerful, refs.powerfulGrid);
    refreshDifficultyButtons();
    refreshSetup();
    refs.setup.classList.add("show");
  }

  function currentBuild() {
    return { dragons: [...setupSelection], basic: { ...setupSpells.basic }, tactical: { ...setupSpells.tactical }, powerful: { ...setupSpells.powerful } };
  }

  function clearForGameStart() {
    refs.setup.classList.remove("show");
    refs.result.classList.remove("show");
    refs.logModal.classList.remove("show");
    refs.discard.classList.remove("show");
    refs.rules.classList.remove("show");
    refs.log.innerHTML = "";
  }

  function bindControls(nextHandlers) {
    handlers = nextHandlers;
    refs.play.onclick = () => handlers.playSelected?.();
    refs.end.onclick = () => handlers.endTurn?.();
    refs.pDiscardBtn.onclick = () => openDiscard("player");
    refs.cDiscardBtn.onclick = () => openDiscard("cpu");
    $("closeDiscard").onclick = () => refs.discard.classList.remove("show");
    $("logBtn").onclick = () => refs.logModal.classList.add("show");
    $("closeLog").onclick = () => refs.logModal.classList.remove("show");
    $("rulesBtn").onclick = () => refs.rules.classList.add("show");
    $("closeRules").onclick = () => refs.rules.classList.remove("show");
    $("restartBtn").onclick = () => handlers.reset?.();
    $("againBtn").onclick = () => handlers.reset?.();
    refs.counterUse.onclick = () => closeCounter(true);
    refs.counterPass.onclick = () => closeCounter(false);
    refs.diffEasy.onclick = () => { setupDifficulty = "easy"; refreshDifficultyButtons(); };
    refs.diffNormal.onclick = () => { setupDifficulty = "normal"; refreshDifficultyButtons(); };
    refs.diffHard.onclick = () => { setupDifficulty = "hard"; refreshDifficultyButtons(); };
    refs.startGame.onclick = () => {
      if (!setupReady()) return;
      handlers.startGame?.(currentBuild(), setupDifficulty);
    };
  }

  return {
    refs, setStateProvider, bindControls, log, render, renderHearts, showHpDelta, showMaxLife,
    openSetup, clearForGameStart, queueDrawAnimation, queueFieldAnimation, showResult,
    showCounterFlash, showOpponentPlay, askCounter, askCounterBack, chooseCard, chooseEntry,
  };
}
