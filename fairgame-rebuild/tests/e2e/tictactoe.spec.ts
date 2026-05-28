import { expect, test, type Page } from "@playwright/test";

test("browser history navigates picker, lobby, and match routes", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Games" })).toBeDisabled();

  await page.getByRole("button", { name: "Chess lobby" }).click();
  await expect(page).toHaveURL(/\/games\/chess$/);
  await expect(page.getByRole("heading", { name: "Chess lobby" })).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("button", { name: "Chess lobby" })).toBeVisible();

  await page.goForward();
  await expect(page).toHaveURL(/\/games\/chess$/);
  await expect(page.getByRole("heading", { name: "Chess lobby" })).toBeVisible();

  await page.getByRole("button", { name: "Games" }).click();
  await page.getByRole("button", { name: "TicTacToe lobby" }).click();
  await page.getByRole("button", { name: "Create TicTacToe match" }).click();
  await expect(page.getByTestId("match-code")).toHaveAttribute("data-match-id", /.+/);
  const matchId = await page.getByTestId("match-code").getAttribute("data-match-id");
  await expect(page).toHaveURL(/\/matches\/.+$/);

  await page.goBack();
  await expect(page).toHaveURL(/\/games\/tictactoe$/);
  await expect(page.getByRole("heading", { name: "TicTacToe lobby" })).toBeVisible();
  await expect(page.getByTestId("match-code")).toBeHidden();

  await page.goForward();
  await expect(page).toHaveURL(new RegExp(`/matches/${matchId ?? ""}$`));
  await expect(page.getByTestId("match-code")).toHaveAttribute("data-match-id", matchId ?? "");
});

test("two players can finish both TicTacToe boards", async ({ browser }) => {
  const playerOneContext = await browser.newContext();
  const playerTwoContext = await browser.newContext();
  const spectatorContext = await browser.newContext();
  const playerOne = await playerOneContext.newPage();
  const playerTwo = await playerTwoContext.newPage();
  const spectator = await spectatorContext.newPage();

  await playerOne.goto("/");
  await playerOne.getByRole("button", { name: "TicTacToe lobby" }).click();
  await playerOne.getByRole("button", { name: "Create TicTacToe match" }).click();
  const matchCode = await playerOne.getByTestId("match-code").getAttribute("data-match-id");
  expect(matchCode).toBeTruthy();
  await expect(playerOne.locator(".match-summary").getByText("Player 1", { exact: true })).toBeVisible();

  await playerOne.reload();
  await expect(playerOne.locator(".match-summary").getByText("Player 1", { exact: true })).toBeVisible();
  await expect(playerOne.getByRole("region", { name: "Board A" })).toBeVisible();

  await playerTwo.goto("/");
  await playerTwo.getByRole("button", { name: "TicTacToe lobby" }).click();
  await playerTwo.locator(`[data-match-id="${matchCode ?? ""}"]`).click();
  await expect(playerTwo.getByTestId("match-code")).toHaveAttribute("data-match-id", matchCode ?? "");
  await expect(playerTwo.locator(".match-summary").getByText("Player 2", { exact: true })).toBeVisible();

  await playerTwo.reload();
  await expect(playerTwo.locator(".match-summary").getByText("Player 2", { exact: true })).toBeVisible();

  await spectator.goto(`/matches/${matchCode ?? ""}`);
  await expect(spectator.getByText("Spectator")).toBeVisible();
  await expect(spectator.getByRole("button", { name: "Board A cell 1" })).toBeDisabled();

  await playMove(playerOne, "A", 1);
  await expect(playerTwo.getByRole("button", { name: "Board A cell 4" })).toBeEnabled();
  await expect(spectator.getByRole("button", { name: "Board A cell 1" })).toHaveText("X");
  await playMove(playerTwo, "A", 4);
  await expect(playerOne.getByRole("button", { name: "Board A cell 2" })).toBeEnabled();
  await playMove(playerOne, "A", 2);
  await expect(playerTwo.getByRole("button", { name: "Board A cell 5" })).toBeEnabled();
  await playMove(playerTwo, "A", 5);
  await expect(playerOne.getByRole("button", { name: "Board A cell 3" })).toBeEnabled();
  await playMove(playerOne, "A", 3);
  await expect(playerOne.getByRole("region", { name: "Board A" }).getByText("Player 1 won")).toBeVisible();

  await playMove(playerTwo, "B", 1);
  await expect(playerOne.getByRole("button", { name: "Board B cell 4" })).toBeEnabled();
  await playMove(playerOne, "B", 4);
  await expect(playerTwo.getByRole("button", { name: "Board B cell 2" })).toBeEnabled();
  await playMove(playerTwo, "B", 2);
  await expect(playerOne.getByRole("button", { name: "Board B cell 5" })).toBeEnabled();
  await playMove(playerOne, "B", 5);
  await expect(playerTwo.getByRole("button", { name: "Board B cell 3" })).toBeEnabled();
  await playMove(playerTwo, "B", 3);

  await expect(playerTwo.getByText("1 - 1")).toBeVisible();
  await expect(playerTwo.getByText("Draw match")).toBeVisible();

  await expect(playerOne.getByText("1 - 1")).toBeVisible();
  await expect(playerOne.getByText("Draw match")).toBeVisible();
  await expect(spectator.getByText("Draw match")).toBeVisible();

  await playerOneContext.close();
  await playerTwoContext.close();
  await spectatorContext.close();
});

test("two players can finish both Connect Four boards", async ({ browser }) => {
  const playerOneContext = await browser.newContext();
  const playerTwoContext = await browser.newContext();
  const playerOne = await playerOneContext.newPage();
  const playerTwo = await playerTwoContext.newPage();

  await playerOne.goto("/");
  await playerOne.getByRole("button", { name: "Connect Four lobby" }).click();
  await playerOne.getByRole("button", { name: "Create Connect Four match" }).click();
  const matchCode = await playerOne.getByTestId("match-code").getAttribute("data-match-id");
  expect(matchCode).toBeTruthy();
  await expect(playerOne.getByRole("button", { name: "Board A column 1" })).toBeEnabled();
  await expect(playerOne.getByRole("button", { name: "Board B column 1" })).toBeDisabled();

  await playerTwo.goto("/");
  await playerTwo.getByRole("button", { name: "Connect Four lobby" }).click();
  await playerTwo.locator(`[data-match-id="${matchCode ?? ""}"]`).click();
  await expect(playerTwo.getByTestId("match-code")).toHaveAttribute("data-match-id", matchCode ?? "");
  await expect(playerTwo.getByRole("button", { name: "Board B column 1" })).toBeEnabled();

  await playColumn(playerOne, "A", 1);
  await expect(playerTwo.getByRole("button", { name: "Board A column 2" })).toBeEnabled();
  await playColumn(playerTwo, "A", 2);
  await playColumn(playerOne, "A", 1);
  await playColumn(playerTwo, "A", 2);
  await playColumn(playerOne, "A", 1);
  await playColumn(playerTwo, "A", 2);
  await playColumn(playerOne, "A", 1);
  await expect(playerOne.getByRole("region", { name: "Board A" }).getByText("Player 1 won")).toBeVisible();

  await playColumn(playerTwo, "B", 1);
  await expect(playerOne.getByRole("button", { name: "Board B column 2" })).toBeEnabled();
  await playColumn(playerOne, "B", 2);
  await playColumn(playerTwo, "B", 1);
  await playColumn(playerOne, "B", 2);
  await playColumn(playerTwo, "B", 1);
  await playColumn(playerOne, "B", 2);
  await playColumn(playerTwo, "B", 1);

  await expect(playerOne.getByText("1 - 1")).toBeVisible();
  await expect(playerOne.getByText("Draw match")).toBeVisible();
  await expect(playerTwo.getByText("1 - 1")).toBeVisible();
  await expect(playerTwo.getByText("Draw match")).toBeVisible();

  await playerOneContext.close();
  await playerTwoContext.close();
});

test("player can make an opening Chess move", async ({ browser }) => {
  const playerOneContext = await browser.newContext();
  const playerTwoContext = await browser.newContext();
  const playerOne = await playerOneContext.newPage();
  const playerTwo = await playerTwoContext.newPage();

  await playerOne.goto("/");
  await playerOne.getByRole("button", { name: "Chess lobby" }).click();
  await playerOne.getByRole("button", { name: "Create Chess match" }).click();
  const matchCode = await playerOne.getByTestId("match-code").getAttribute("data-match-id");
  expect(matchCode).toBeTruthy();

  await playerTwo.goto("/");
  await playerTwo.getByRole("button", { name: "Chess lobby" }).click();
  await playerTwo.locator(`[data-match-id="${matchCode ?? ""}"]`).click();
  await expect(playerTwo.getByTestId("match-code")).toHaveAttribute("data-match-id", matchCode ?? "");
  await expect(playerOne.getByRole("button", { name: "Board A square e2 white pawn" })).toBeEnabled();
  await expect(playerOne.getByRole("button", { name: "Board B square e2 white pawn" })).toBeDisabled();
  await playChessMove(playerOne, "A", "e2", "e4");

  await expect(playerOne.getByRole("button", { name: "Board A square e4 white pawn" })).toBeVisible();
  await expect(playerOne.getByRole("region", { name: "Board A move history" }).getByText("e4")).toBeVisible();

  await playerOneContext.close();
  await playerTwoContext.close();
});

async function playMove(page: Page, board: "A" | "B", cellNumber: number) {
  await page.getByRole("button", { name: `Board ${board} cell ${cellNumber}` }).click();
}

async function playColumn(page: Page, board: "A" | "B", columnNumber: number) {
  await page.getByRole("button", { name: `Board ${board} column ${columnNumber}` }).click();
}

async function playChessMove(page: Page, board: "A" | "B", from: string, to: string) {
  await page.getByRole("button", { name: new RegExp(`Board ${board} square ${from} `) }).click();
  await page.getByRole("button", { name: new RegExp(`Board ${board} square ${to} `) }).click();
}
