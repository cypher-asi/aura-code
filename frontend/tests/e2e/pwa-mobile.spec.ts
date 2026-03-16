import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/auth/session", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ error: "Unauthorized", code: "unauthorized", details: null }),
    });
  });

  await page.route("**/api/auth/validate", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ error: "Unauthorized", code: "unauthorized", details: null }),
    });
  });
});

test("mobile login page renders with PWA metadata", async ({ page }) => {
  await page.goto("/login");

  await expect(page).toHaveTitle(/AURA/);
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#05070d");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.webmanifest");
  await expect(page.getByPlaceholder("Email")).toBeVisible();
  await expect(page.locator("form").getByRole("button", { name: "Sign In" })).toBeVisible();
});

test("manifest and service worker assets are reachable", async ({ page }) => {
  const manifestResponse = await page.request.get("/manifest.webmanifest");
  expect(manifestResponse.ok()).toBeTruthy();

  const manifest = await manifestResponse.json();
  expect(manifest.name).toBe("Aura Mobile Companion");
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ src: "/pwa-192.png" }),
      expect.objectContaining({ src: "/pwa-512.png" }),
    ]),
  );

  const swResponse = await page.request.get("/sw.js");
  expect(swResponse.ok()).toBeTruthy();
  expect(await swResponse.text()).toContain("STATIC_CACHE");
});

test("service worker registers in chromium", async ({ page, context, browserName }) => {
  test.skip(browserName !== "chromium", "Playwright only exposes service workers in Chromium.");

  await page.goto("/login");
  await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) return;
    await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
  });

  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker");
  expect(worker.url()).toContain("/sw.js");
});
