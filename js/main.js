import { createUI } from "./ui.js?v=20260929-8";
import { createGame } from "./game.js?v=20260929-8";

const ui = createUI();
const game = createGame(ui);

game.reset();
