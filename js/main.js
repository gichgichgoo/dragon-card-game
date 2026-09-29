import { createUI } from "./ui.js?v=20260929-6";
import { createGame } from "./game.js?v=20260929-6";

const ui = createUI();
const game = createGame(ui);

game.reset();
