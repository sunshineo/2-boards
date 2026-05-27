import { expect, test, type Page } from "@playwright/test";

test("two players can finish both TicTacToe boards", async ({ browser }) => {
  const playerOneContext = await browser.newContext();
  const playerTwoContext = await browser.newContext();
  const playerOne = await playerOneContext.newPage();
  const playerTwo = await playerTwoContext.newPage();

  await playerOne.goto("/");
  await playerOne.getByRole("button", { name: "Create TicTacToe match" }).click();
  const matchCode = await playerOne.getByTestId("match-code").textContent();
  expect(matchCode).toBeTruthy();

  await playerTwo.goto("/");
  await playerTwo.getByLabel("Match code").fill(matchCode ?? "");
  await playerTwo.getByRole("button", { name: "Join match" }).click();
  await expect(playerTwo.getByText(matchCode ?? "")).toBeVisible();

  await playMove(playerOne, "A", 1);
  await refresh(playerTwo);
  await playMove(playerTwo, "A", 4);
  await refresh(playerOne);
  await playMove(playerOne, "A", 2);
  await refresh(playerTwo);
  await playMove(playerTwo, "A", 5);
  await refresh(playerOne);
  await playMove(playerOne, "A", 3);
  await expect(playerOne.getByRole("region", { name: "Board A" }).getByText("Player 1 won")).toBeVisible();

  await playMove(playerTwo, "B", 1);
  await refresh(playerOne);
  await playMove(playerOne, "B", 4);
  await refresh(playerTwo);
  await playMove(playerTwo, "B", 2);
  await refresh(playerOne);
  await playMove(playerOne, "B", 5);
  await refresh(playerTwo);
  await playMove(playerTwo, "B", 3);

  await expect(playerTwo.getByText("1 - 1")).toBeVisible();
  await expect(playerTwo.getByText("Draw match")).toBeVisible();

  await refresh(playerOne);
  await expect(playerOne.getByText("1 - 1")).toBeVisible();
  await expect(playerOne.getByText("Draw match")).toBeVisible();

  await playerOneContext.close();
  await playerTwoContext.close();
});

async function playMove(page: Page, board: "A" | "B", cellNumber: number) {
  await page.getByRole("button", { name: `Board ${board} cell ${cellNumber}` }).click();
}

async function refresh(page: Page) {
  await page.getByRole("button", { name: "Refresh" }).click();
}
