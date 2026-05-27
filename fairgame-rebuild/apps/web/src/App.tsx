import { createBootstrapBoardAssignments } from "@fairgame/domain";
import { projectName } from "@fairgame/shared";

const assignments = createBootstrapBoardAssignments();

export function App() {
  return (
    <main className="app-shell">
      <section className="status-panel" aria-labelledby="app-title">
        <p className="eyebrow">Checkpoint 0</p>
        <h1 id="app-title">{projectName} Rebuild</h1>
        <p className="summary">
          Clean workspace, tracked roadmap, and browser-based testing are ready for
          the fair two-board game implementation.
        </p>
        <div className="assignment-grid" aria-label="Bootstrap board assignments">
          {assignments.map((assignment) => (
            <div className="assignment" key={assignment.boardId}>
              <span className="board-label">Board {assignment.boardId}</span>
              <span className="seat-label">{assignment.firstSeat} starts</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
