import { expect, test } from "@playwright/test";
import { mockAuthenticatedApp } from "./helpers/mockAuthenticatedApp";

test.use({ serviceWorkers: "block" });

test("agent editor exposes adapter, environment, and org integration choices", async ({ page }) => {
  await mockAuthenticatedApp(page, {
    integrations: [
      {
        integration_id: "int-anthropic",
        org_id: "org-1",
        name: "Anthropic Team",
        provider: "anthropic",
        default_model: "claude-opus-4-6",
        created_at: "2026-03-17T01:00:00.000Z",
        updated_at: "2026-03-17T01:00:00.000Z",
      },
      {
        integration_id: "int-openai",
        org_id: "org-1",
        name: "OpenAI Team",
        provider: "openai",
        default_model: "gpt-5.4",
        created_at: "2026-03-17T01:00:00.000Z",
        updated_at: "2026-03-17T01:00:00.000Z",
      },
    ],
  });

  await page.goto("/agents/agent-1");
  await page.getByTitle("New Agent").click();

  await expect(page.getByRole("heading", { name: "Create Agent" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Aura Harness" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Claude Code" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Codex" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Local Host/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Swarm MicroVM/i })).toBeVisible();

  await expect(page.getByRole("button", { name: /Anthropic Team/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /OpenAI Team/i })).toBeVisible();

  await page.getByRole("button", { name: "Claude Code" }).click();
  await expect(page.getByText("Claude Code and Codex currently run on the local host.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Anthropic Team/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /OpenAI Team/i })).toHaveCount(0);

  await page.getByRole("button", { name: "Codex" }).click();
  await expect(page.getByRole("button", { name: /OpenAI Team/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Anthropic Team/i })).toHaveCount(0);

  await page.getByRole("button", { name: "Aura Harness" }).click();
  await expect(page.getByRole("button", { name: /Anthropic Team/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /OpenAI Team/i })).toBeVisible();
});
