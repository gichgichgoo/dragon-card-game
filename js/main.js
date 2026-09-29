import { createUI } from "./ui.js?v=20260929-5";
import { createGame } from "./game.js?v=20260929-5";

const ui = createUI();
const game = createGame(ui);

game.reset();
