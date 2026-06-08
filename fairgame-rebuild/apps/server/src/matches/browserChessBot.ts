export {
  getBrowserChessBotDisplayName,
  getSeatAgentControlCookieName as getBotControlCookieName,
  parseBrowserChessBotDifficulty,
  parseSeatAgentControlCookie as parseBotControlCookie,
  createBrowserStockfishSeatAgent as createBrowserChessBot
} from "./seatAgents.js";
export type {
  SeatAgentControlClaim as BotControlClaim,
  AutomatedSeat as BrowserChessBot,
  SeatAgentDifficulty as BrowserChessBotDifficulty
} from "./seatAgents.js";
