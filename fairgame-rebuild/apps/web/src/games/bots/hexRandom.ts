import type { HexBoardView, MovePayload } from "../../types";
import { chooseRandom, type RandomSource } from "./random";
import type { BotMoveInput } from "./types";

export function chooseHexRandomMove(input: BotMoveInput<HexBoardView>, random?: RandomSource): MovePayload | null {
  const cell = chooseRandom(input.board.playableCells, random);
  return cell === null ? null : { cell };
}
