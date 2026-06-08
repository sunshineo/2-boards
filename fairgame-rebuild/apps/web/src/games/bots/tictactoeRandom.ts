import type { MovePayload, TicTacToeBoardView } from "../../types";
import { canRandomBotAct, chooseRandom, type RandomSource } from "./random";
import type { BotMoveInput } from "./types";

export function chooseTicTacToeRandomMove(
  input: BotMoveInput<TicTacToeBoardView>,
  random?: RandomSource
): MovePayload | null {
  if (!canRandomBotAct(input.board, input.seat)) return null;
  const cells = input.board.cells
    .map((cell, index) => (cell === null ? index : null))
    .filter((cell): cell is number => cell !== null);
  const cell = chooseRandom(cells, random);
  return cell === null ? null : { cell };
}
