import { expect, test } from "@playwright/test";
import { mockAuthenticatedApp } from "./helpers/mockAuthenticatedApp";

test("desktop browser projects root keeps desktop welcome layout", async ({ page }) => {
  await mockAuthenticatedApp(page);

  await page.goto("/projects");

  await expect(page.getByText("Welcome to AURA")).toBeVisible();
  await expect(page.getByText("Pick up work without hunting through the app.")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Open navigation" })).toHaveCount(0);
});

test("desktop browser project execution keeps desktop chrome and hides workspace-only files tab", async ({ page }) => {
  await mockAuthenticatedApp(page);

  await page.goto("/projects/proj-1/execution");

  await expect(page.getByText("Demo Project")).toBeVisible();
  await expect(page.getByRole("button", { name: "Chat" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Tasks" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Files" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Open navigation" })).toHaveCount(0);
});

test("desktop browser agents route keeps desktop layout without mobile switcher", async ({ page }) => {
  await mockAuthenticatedApp(page);

  await page.goto("/agents/agent-1");

  await expect(page.getByPlaceholder("Search Agents...")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Choose agent" })).toHaveCount(0);
  await expect(page.getByText("Send a message to chat with Builder Bot across all linked projects")).toBeVisible();
  await expect(page.getByRole("button", { name: "Open navigation" })).toHaveCount(0);
});
