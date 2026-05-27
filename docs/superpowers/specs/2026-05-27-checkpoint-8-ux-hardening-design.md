# Checkpoint 8 UX Hardening Design

## Goal

Make the existing three-game product easier to play repeatedly without changing the
fair-match rules.

## Scope

This checkpoint adds:

- stronger active-board and active-player affordances;
- player names stored with the match before accounts exist;
- copy invite link;
- rematch from a completed match;
- local recent-match history in the browser;
- layout refinements for dense boards on desktop and mobile.

## Architecture

Player names are generic match metadata in `MatchService`, persisted in snapshots and
projected through `MatchView`. They do not affect seat identity or authorization.

Copy invite and local history are browser-only convenience features. Recent history is
stored in `localStorage` with match id, game label, and last result text.

Rematch creates a fresh match of the same game type as Player 1 and navigates to its
new match URL. It does not carry over game state.

## Testing

Server tests verify create/join names are preserved. Web tests verify player-name inputs,
copy invite, recent history rendering, and rematch controls. Existing E2E flows continue
to cover create, join, play, finish, reconnect, spectator, and chess smoke behavior.

## Self-Review

- No changes to core game rules or scoring.
- Metadata remains generic and compatible with future accounts.
- Browser-only history is intentionally local and not canonical.
