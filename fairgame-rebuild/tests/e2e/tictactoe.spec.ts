import { expect, test, type Page } from "@playwright/test";

test("two players can finish both TicTacToe boards", async ({ browser }) => {
  const playerOneContext = await browser.newContext();
  const playerTwoContext = await browser.newContext();
  const spectatorContext = await browser.newContext();
  const playerOne = await playerOneContext.newPage();
  const playerTwo = await playerTwoContext.newPage();
  const spectator = await spectatorContext.newPage();

  await playerOne.goto("/");
  await playerOne.getByRole("button", { name: "Create TicTacToe match" }).click();
  const matchCode = await playerOne.getByTestId("match-code").textContent();
  expect(matchCode).toBeTruthy();
  await expect(playerOne.getByText("Player 1", { exact: true })).toBeVisible();

  await playerOne.reload();
  await expect(playerOne.getByText("Player 1", { exact: true })).toBeVisible();
  await expect(playerOne.getByRole("region", { name: "Board A" })).toBeVisible();

  await playerTwo.goto("/");
  await playerTwo.getByLabel("Match code").fill(matchCode ?? "");
  await playerTwo.getByRole("button", { name: "Join match" }).click();
  await expect(playerTwo.getByTestId("match-code")).toHaveText(matchCode ?? "");
  await expect(playerTwo.getByText("Player 2", { exact: true })).toBeVisible();

  await playerTwo.reload();
  await expect(playerTwo.getByText("Player 2", { exact: true })).toBeVisible();

  await spectator.goto(`/?match=${matchCode ?? ""}`);
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
  await playerOne.getByRole("radio", { name: "Connect Four" }).check();
  await playerOne.getByRole("button", { name: "Create Connect Four match" }).click();
  const matchCode = await playerOne.getByTestId("match-code").textContent();
  expect(matchCode).toBeTruthy();
  await expect(playerOne.getByRole("button", { name: "Board A column 1" })).toBeEnabled();
  await expect(playerOne.getByRole("button", { name: "Board B column 1" })).toBeDisabled();

  await playerTwo.goto("/");
  await playerTwo.getByLabel("Match code").fill(matchCode ?? "");
  await playerTwo.getByRole("button", { name: "Join match" }).click();
  await expect(playerTwo.getByTestId("match-code")).toHaveText(matchCode ?? "");
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

async function playMove(page: Page, board: "A" | "B", cellNumber: number) {
  await page.getByRole("button", { name: `Board ${board} cell ${cellNumber}` }).click();
}

async function playColumn(page: Page, board: "A" | "B", columnNumber: number) {
  await page.getByRole("button", { name: `Board ${board} column ${columnNumber}` }).click();
}
