import { createUI } from "./ui.js?v=20261006-3";
import { createGame } from "./game.js?v=20261006-2";

const ui = createUI();
const game = createGame(ui);

game.reset();
