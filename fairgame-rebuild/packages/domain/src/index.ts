import type { BoardId, SeatId } from "@fairgame/shared";

export type BootstrapBoardAssignment = {
  boardId: BoardId;
  firstSeat: SeatId;
};

export function createBootstrapBoardAssignments(): BootstrapBoardAssignment[] {
  return [
    { boardId: "A", firstSeat: "seat1" },
    { boardId: "B", firstSeat: "seat2" }
  ];
}
