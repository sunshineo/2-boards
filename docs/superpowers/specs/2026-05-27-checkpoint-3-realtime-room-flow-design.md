# Checkpoint 3 Real-Time Room Flow Design

## Goal

Make TicTacToe rooms behave like multiplayer rooms instead of manual-refresh REST pages:
players should receive live state updates, invite URLs should load the match, browser
refresh should preserve the player's seat, and non-players should have a read-only
spectator view.

## Scope

This checkpoint includes:

- Socket.IO match-room subscriptions;
- broadcasting match updates after joins and moves;
- HTTP-only seat-claim cookies for create/join refresh continuity;
- `GET /api/matches/:id/session` to restore a seat or return spectator mode;
- invite URL support using `?match=<id>`;
- read-only spectator UI;
- Playwright coverage for reconnect/refresh and spectator updates.

This checkpoint does not include durable persistence, accounts, clocks, or production
auth. Seat claims remain in memory and are reset when the server restarts.

## Seat Claims

Create/join responses set a secure random seat claim in an HTTP-only cookie. The cookie
value proves browser ownership of a match seat, but it is not an account identity.

The server stores claims in memory:

```ts
seatClaims = {
  seat1: "<random secret>",
  seat2: "<random secret>"
}
```

On refresh, the browser loads `/?match=<id>`. The web app calls
`GET /api/matches/:id/session` with credentials. The server reads the cookie:

- valid seat claim: return `{ seat, match }`;
- no valid claim: return `{ seat: null, match }` for spectator mode.

## Real-Time Updates

Socket clients emit `watch-match` with a match id. The server joins the socket to a
room named by match id and immediately emits the current view. After join or move, the
match service broadcasts the latest match view to all sockets watching that match.

The web app keeps its current seat locally and only replaces the match view when a
`match:update` event arrives.

## UI Behavior

- The match code remains visible.
- The invite URL is visible and copyable manually.
- Player views show "Player 1" or "Player 2".
- Spectator views show "Spectator".
- Spectators can see boards and live updates but cannot click cells.
- Player pages can be reloaded and restore their seat from the cookie.

## Verification

E2E should cover:

- Player 1 creates a match and reloads, still Player 1.
- Player 2 joins by invite/code and reloads, still Player 2.
- Moves update the other player without manual refresh.
- A third browser opens the match URL as a spectator.
- The spectator sees board updates but cannot move.
