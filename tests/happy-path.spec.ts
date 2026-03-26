import { test, expect } from "@playwright/test";

test("happy path: create session, add player/game, auto-generate round", async ({
  page,
}) => {
  await page.goto("/sessions/new");

  const sessionName = `Session ${Date.now()}`;
  await page.getByLabel("Nom").fill(sessionName);
  await page.getByLabel("Date").fill("2030-01-15");
  await page.getByRole("button", { name: "Creer la session" }).click();

  await expect(page.getByRole("heading", { name: sessionName })).toBeVisible();

  await page.getByRole("tab", { name: "Players" }).click();
  await page.getByLabel("Nom du joueur").fill("Alice");
  await page.getByRole("button", { name: "Ajouter" }).first().click();
  await expect(page.getByText("Alice")).toBeVisible();

  await page.getByRole("tab", { name: "Games" }).click();
  await page.getByLabel("Nom").fill("Skyjo");
  await page.getByLabel("Duree (min)").fill("20");
  await page.getByLabel("Joueurs min").fill("2");
  await page.getByLabel("Joueurs max").fill("6");
  await page.getByRole("button", { name: "Ajouter le jeu" }).click();
  await expect(page.getByText("Skyjo")).toBeVisible();

  await page.getByRole("tab", { name: "Rounds" }).click();
  await page.getByRole("button", { name: "Ajouter un round" }).click();
  await expect(page.getByText("Round 1")).toBeVisible();

  await page.getByRole("button", { name: "Auto-generer" }).first().click();
  await expect(page.getByText("Table 1")).toBeVisible();

  await page.getByRole("tab", { name: "Ranking" }).click();
  await expect(page.getByText("Classement")).toBeVisible();
});
