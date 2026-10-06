import { createUI } from "./ui.js?v=20261006-6";
import { createGame } from "./game.js?v=20261006-6";

const ui = createUI();
const game = createGame(ui);

game.reset();
