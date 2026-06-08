import type { ReactElement } from "react";

import type { GameType } from "../types";
import { chooseBreakthroughRandomMove } from "./bots/breakthroughRandom";
import { chessStockfishBotCapability } from "./bots/chessStockfish";
import { chooseConnectFourRandomMove } from "./bots/connectFourRandom";
import { chooseDotsBoxesRandomMove } from "./bots/dotsBoxesRandom";
import { chooseGomokuRandomMove } from "./bots/gomokuRandom";
import { chooseHexRandomMove } from "./bots/hexRandom";
import { chooseMancalaRandomMove } from "./bots/mancalaRandom";
import { chooseOrderChaosRandomMove } from "./bots/orderChaosRandom";
import { chooseReversiRandomMove } from "./bots/reversiRandom";
import { chooseTicTacToeRandomMove } from "./bots/tictactoeRandom";
import type { RandomLegalWebGameBotCapability, WebGameBotCapability } from "./bots/types";
import { BoardRenderer, type BoardRendererProps } from "./renderers";

export type WebGamePlugin = {
  readonly gameType: GameType;
  readonly imageAlt: string;
  readonly imageSrc: string;
  readonly label: string;
  readonly timeRange: {
    readonly min: number;
    readonly max: number;
  };
  readonly bot?: WebGameBotCapability;
  renderBoard(props: BoardRendererProps): ReactElement;
};

function renderBoard(props: BoardRendererProps) {
  return <BoardRenderer {...props} />;
}

function randomBotCapability(
  displayName: string,
  chooseMove: RandomLegalWebGameBotCapability["chooseMove"]
): RandomLegalWebGameBotCapability {
  return {
    kind: "random-legal",
    displayName,
    difficulties: ["normal"],
    chooseMove
  };
}

export const webGamePlugins: readonly WebGamePlugin[] = [
  {
    gameType: "chess",
    imageAlt: "Chess preview",
    imageSrc: "/game-thumbnails/chess.png",
    label: "Chess",
    timeRange: { min: 3, max: 60 },
    bot: chessStockfishBotCapability,
    renderBoard
  },
  {
    gameType: "tictactoe",
    imageAlt: "TicTacToe preview",
    imageSrc: "/game-thumbnails/tictactoe.png",
    label: "TicTacToe",
    timeRange: { min: 1, max: 10 },
    bot: randomBotCapability("TicTacToe Bot", async (input) => {
      if (input.board.kind !== "tictactoe") return null;
      return chooseTicTacToeRandomMove({ board: input.board, seat: input.seat });
    }),
    renderBoard
  },
  {
    gameType: "connect4",
    imageAlt: "Connect Four preview",
    imageSrc: "/game-thumbnails/connect-four.png",
    label: "Connect Four",
    timeRange: { min: 2, max: 20 },
    bot: randomBotCapability("Connect Four Bot", async (input) => {
      if (input.board.kind !== "connect4") return null;
      return chooseConnectFourRandomMove({ board: input.board, seat: input.seat });
    }),
    renderBoard
  },
  {
    gameType: "gomoku",
    imageAlt: "Gomoku preview",
    imageSrc: "/game-thumbnails/gomoku.png",
    label: "Gomoku",
    timeRange: { min: 3, max: 30 },
    bot: randomBotCapability("Gomoku Bot", async (input) => {
      if (input.board.kind !== "gomoku") return null;
      return chooseGomokuRandomMove({ board: input.board, seat: input.seat });
    }),
    renderBoard
  },
  {
    gameType: "hex",
    imageAlt: "Hex preview",
    imageSrc: "/game-thumbnails/hex.png",
    label: "Hex",
    timeRange: { min: 3, max: 30 },
    bot: randomBotCapability("Hex Bot", async (input) => {
      if (input.board.kind !== "hex") return null;
      return chooseHexRandomMove({ board: input.board, seat: input.seat });
    }),
    renderBoard
  },
  {
    gameType: "reversi",
    imageAlt: "Reversi preview",
    imageSrc: "/game-thumbnails/reversi.png",
    label: "Reversi",
    timeRange: { min: 2, max: 20 },
    bot: randomBotCapability("Reversi Bot", async (input) => {
      if (input.board.kind !== "reversi") return null;
      return chooseReversiRandomMove({ board: input.board, seat: input.seat });
    }),
    renderBoard
  },
  {
    gameType: "breakthrough",
    imageAlt: "Breakthrough preview",
    imageSrc: "/game-thumbnails/breakthrough.png",
    label: "Breakthrough",
    timeRange: { min: 3, max: 30 },
    bot: randomBotCapability("Breakthrough Bot", async (input) => {
      if (input.board.kind !== "breakthrough") return null;
      return chooseBreakthroughRandomMove({ board: input.board, seat: input.seat });
    }),
    renderBoard
  },
  {
    gameType: "mancala",
    imageAlt: "Mancala preview",
    imageSrc: "/game-thumbnails/mancala.png",
    label: "Mancala",
    timeRange: { min: 2, max: 20 },
    bot: randomBotCapability("Mancala Bot", async (input) => {
      if (input.board.kind !== "mancala") return null;
      return chooseMancalaRandomMove({ board: input.board, seat: input.seat });
    }),
    renderBoard
  },
  {
    gameType: "dots-boxes",
    imageAlt: "Dots and Boxes preview",
    imageSrc: "/game-thumbnails/dots-boxes.png",
    label: "Dots and Boxes",
    timeRange: { min: 3, max: 30 },
    bot: randomBotCapability("Dots and Boxes Bot", async (input) => {
      if (input.board.kind !== "dots-boxes") return null;
      return chooseDotsBoxesRandomMove({ board: input.board, seat: input.seat });
    }),
    renderBoard
  },
  {
    gameType: "order-chaos",
    imageAlt: "Order and Chaos preview",
    imageSrc: "/game-thumbnails/order-chaos.png",
    label: "Order and Chaos",
    timeRange: { min: 3, max: 30 },
    bot: randomBotCapability("Order and Chaos Bot", async (input) => {
      if (input.board.kind !== "order-chaos") return null;
      return chooseOrderChaosRandomMove({ board: input.board, seat: input.seat });
    }),
    renderBoard
  }
];

export const gameOptions = webGamePlugins.map(({ gameType, imageAlt, imageSrc, label }) => ({
  gameType,
  imageAlt,
  imageSrc,
  label
}));

export const gameTimeRanges = Object.fromEntries(
  webGamePlugins.map((plugin) => [plugin.gameType, plugin.timeRange])
) as Record<GameType, WebGamePlugin["timeRange"]>;

export function getWebGamePlugin(gameType: GameType): WebGamePlugin;
export function getWebGamePlugin(gameType: string): WebGamePlugin | null;
export function getWebGamePlugin(gameType: string): WebGamePlugin | null {
  return webGamePlugins.find((plugin) => plugin.gameType === gameType) ?? null;
}

export function getGameLabel(gameType: GameType) {
  return getWebGamePlugin(gameType)?.label ?? "Game";
}

export function isGameType(candidate: string | null | undefined): candidate is GameType {
  return webGamePlugins.some((plugin) => plugin.gameType === candidate);
}

export function renderGameBoard(props: BoardRendererProps) {
  return getWebGamePlugin(props.board.kind)?.renderBoard(props) ?? <BoardRenderer {...props} />;
}
