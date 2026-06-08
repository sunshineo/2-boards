import type { MatchBoardView, MovePayload, SeatAgentDifficulty, SeatAgentKind, SeatId } from "../../types";

export type BotMoveInput<TBoard extends MatchBoardView = MatchBoardView> = {
  readonly board: TBoard;
  readonly seat: SeatId;
};

export type WebGameBotCapability = {
  readonly kind: SeatAgentKind;
  readonly displayName: string;
  readonly difficulties: readonly SeatAgentDifficulty[];
  chooseMove(input: BotMoveInput): Promise<MovePayload | null>;
};
