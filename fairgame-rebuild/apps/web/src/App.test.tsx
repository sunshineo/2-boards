import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "./App";

describe("App", () => {
  it("renders the bootstrap status and two board assignments", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "FairGame Rebuild" })).toBeInTheDocument();
    expect(screen.getByText("Board A")).toBeInTheDocument();
    expect(screen.getByText("seat1 starts")).toBeInTheDocument();
    expect(screen.getByText("Board B")).toBeInTheDocument();
    expect(screen.getByText("seat2 starts")).toBeInTheDocument();
  });
});
