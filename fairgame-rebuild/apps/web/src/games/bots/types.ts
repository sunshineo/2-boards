import type { MatchBoardView, MovePayload, SeatAgentDifficulty, SeatAgentKind, SeatId } from "../../types";

export type BotMoveInput<TBoard extends MatchBoardView = MatchBoardView> = {
  readonly board: TBoard;
  readonly seat: SeatId;
};

type BaseWebGameBotCapability<TKind extends SeatAgentKind> = {
  readonly kind: TKind;
  readonly displayName: string;
  readonly difficulties: readonly SeatAgentDifficulty[];
};

export type RandomLegalWebGameBotCapability = BaseWebGameBotCapability<"random-legal"> & {
  chooseMove(input: BotMoveInput): Promise<MovePayload | null>;
};

export type BrowserStockfishWebGameBotCapability = BaseWebGameBotCapability<"browser-stockfish">;

export type WebGameBotCapability = RandomLegalWebGameBotCapability | BrowserStockfishWebGameBotCapability;
