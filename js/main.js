import { createUI } from "./ui.js?v=20261005-1";
import { createGame } from "./game.js?v=20261005-1";

const ui = createUI();
const game = createGame(ui);

game.reset();
