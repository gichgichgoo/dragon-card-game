import { createUI } from "./ui.js?v=20260929-7";
import { createGame } from "./game.js?v=20260929-7";

const ui = createUI();
const game = createGame(ui);

game.reset();
