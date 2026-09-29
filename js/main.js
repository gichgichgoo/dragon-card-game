import { createUI } from "./ui.js?v=20260929-11";
import { createGame } from "./game.js?v=20260929-11";

const ui = createUI();
const game = createGame(ui);

game.reset();
