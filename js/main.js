import { createUI } from "./ui.js";
import { createGame } from "./game.js";

const ui = createUI();
const game = createGame(ui);

game.reset();
