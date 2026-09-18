import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const auth = (identity: string) => ({ Authorization: `Bearer fixture-${identity}` });
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-09-18T09:00:00Z"));
});

test("direct HTTP authorization: two tenants, public/private fields and forged role", async ({ request }) => {
  const anonymous = await request.get("http://127.0.0.1:8011/cases");
  expect(anonymous.status()).toBe(401);
  const response = await request.get("http://127.0.0.1:8011/cases", { headers: auth("greenline-reviewer") });
  expect((await response.json()).map((c: { id: string }) => c.id)).toEqual(["greenline-1", "public-1"]);
  const denied = await request.get("http://127.0.0.1:8011/cases/apex-1", { headers: auth("greenline-reviewer") });
  expect(denied.status()).toBe(404);
  const forged = await request.post("http://127.0.0.1:8011/cases/apex-1/transitions", { headers: auth("apex-viewer"), data: { action: "approve", version: 1, assessment: "Forged frontend action" } });
  expect(forged.status()).toBe(403);
});

test("T1: controlled delayed response cannot overwrite current evidence", async ({ page }) => {
  let release!: () => void;
  let arrived!: () => void;
  const requested = new Promise<void>((done) => { arrived = done; });
  const gate = new Promise<void>((done) => { release = done; });
  await page.route("**/reviewer-api/cases/apex-1", async (route) => {
    const response = await route.fetch(); arrived(); await gate;
    await route.fulfill({ response }).catch(() => { /* An aborted obsolete request is expected. */ });
  });
  await page.goto("/reviewer.html");
  await requested;
  await page.getByRole("button", { name: "Nova safety evidence draft" }).click();
  await expect(page.getByRole("heading", { name: "Nova safety evidence" })).toBeVisible();
  release();
  await expect(page.getByRole("region", { name: "Evidence panel" })).toContainText("one corrective action open");
  await expect(page.getByRole("region", { name: "Evidence panel" })).not.toContainText("recycled resin");
});

test("T2: keyboard validation, submit, approve and tenant change", async ({ page }) => {
  await page.goto("/reviewer.html");
  const submit = page.getByRole("button", { name: "Submit assessment" });
  await submit.focus(); await page.keyboard.press("Enter");
  await expect(page.getByRole("alert")).toContainText("written evidence assessment");
  await page.getByLabel("Written evidence assessment").fill("The synthetic v2 declaration supports 40% recycled resin.");
  await submit.focus(); await page.keyboard.press("Enter");
  await expect(page.getByTestId("case-status")).toHaveText("submitted");
  await expect(page.getByRole("heading", { name: "Nova material declaration" })).toBeFocused();
  await page.getByLabel("Fixture identity").selectOption("apex-reviewer");
  await expect(page.getByRole("heading", { name: "Private reviewer note" })).toBeVisible();
  await page.getByRole("button", { name: "Approve assessment" }).click();
  await expect(page.getByTestId("case-status")).toHaveText("approved");
  await page.getByLabel("Fixture identity").selectOption("apex-viewer");
  await expect(page.getByText(/Read-only role/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Private reviewer note" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Approve assessment" })).toHaveCount(0);
  await page.getByLabel("Fixture identity").selectOption("greenline-reviewer");
  await expect(page.getByRole("heading", { name: "Greenline packaging audit" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Nova/ })).toHaveCount(0);
  await page.getByLabel("Search cases").fill("no-match");
  await expect(page.getByText("No cases match your search.")).toBeVisible();
});

for (const [width, height] of [[1920, 1080], [1440, 900], [390, 844]]) {
  test(`real screenshot ${width}x${height}`, async ({ page, browser, request }, testInfo) => {
    // Normalize the sidebar case through authorized fixture transitions too;
    // screenshots must match when this test is run without the preceding T2.
    const caseResponse = await request.get("http://127.0.0.1:8011/cases/apex-1", { headers: auth("apex-contributor") });
    let sidebarCase = await caseResponse.json();
    if (sidebarCase.status === "draft") {
      const submitted = await request.post("http://127.0.0.1:8011/cases/apex-1/transitions", { headers: auth("apex-contributor"), data: { action: "submit", version: sidebarCase.version, assessment: "The synthetic v2 declaration supports 40% recycled resin." } });
      expect(submitted.ok()).toBe(true); sidebarCase = await submitted.json();
    }
    if (sidebarCase.status === "submitted") {
      const approved = await request.post("http://127.0.0.1:8011/cases/apex-1/transitions", { headers: auth("apex-reviewer"), data: { action: "approve", version: sidebarCase.version, assessment: sidebarCase.assessment } });
      expect(approved.ok()).toBe(true);
    }
    await page.setViewportSize({ width: width!, height: height! });
    await page.goto("/reviewer.html");
    await page.getByLabel("Fixture identity").selectOption("apex-reviewer");
    await page.getByRole("button", { name: "Nova safety evidence draft" }).click();
    await expect(page.getByRole("heading", { name: "Private reviewer note" })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const platform = `${process.platform}-${process.arch}`;
    mkdirSync(`../../docs/screenshots/reviewer/${platform}`, { recursive: true });
    await page.screenshot({ path: `../../docs/screenshots/reviewer/${platform}/${width}x${height}.png`, fullPage: false });
    const environment = { browser: browser.version(), playwright: "1.61.1", platform, locale: "en-GB", timezone: "UTC", clock: "2026-09-18T09:00:00Z", font: "Bundled Liberation Sans (SIL OFL 1.1; exact files in public/reviewer-fonts)", viewport: { width, height }, fixture: "apex-reviewer / apex-2 / draft" };
    writeFileSync(`../../docs/screenshots/reviewer/${platform}/${width}x${height}.json`, JSON.stringify(environment, null, 2) + "\n");
    await testInfo.attach("environment", { body: JSON.stringify(environment), contentType: "application/json" });
    if (width === 390) {
      await page.getByRole("region", { name: "Evidence panel" }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: `../../docs/screenshots/reviewer/${platform}/${width}x${height}-detail.png`, fullPage: false });
    }
  });
}

test("legacy semantics detects screenshot-as-interface and no-op-button negatives", async ({ page }) => {
  await page.goto("/legacy-review.html");
  await expect(page.getByRole("heading", { name: "Legacy evidence review" })).toBeVisible();
  const workingPixels = await page.screenshot();
  await page.getByRole("button", { name: "Approve legacy case" }).click();
  await expect(page.getByRole("status")).toHaveText("Approved");
  await page.goto("/legacy-review.html?variant=no-op");
  const noOpPixels = await page.screenshot();
  expect(noOpPixels.equals(workingPixels)).toBe(true); // Identical pixels; broken behavior below.
  await page.getByRole("button", { name: "Approve legacy case" }).click();
  await expect(page.getByRole("status")).toHaveText("Draft");
  await page.goto("/legacy-review.html?variant=screenshot");
  await expect(page.getByRole("img", { name: /Screenshot of an approval interface/ })).toBeVisible();
  expect(await page.getByRole("img").evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await expect(page.getByRole("button")).toHaveCount(0);
  await expect(page.getByRole("heading")).toHaveCount(0);
});

for (const mode of ["ssr", "csr", "ssg"]) {
  test(`${mode}: initial HTML and interactive hydration`, async ({ page, request }) => {
    const response = await request.get(`http://127.0.0.1:5188/render/${mode}`);
    const html = await response.text();
    expect(html.includes("Review count: <!-- -->0")).toBe(mode !== "csr");
    const errors: string[] = []; page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:5188/render/${mode}`);
    await page.getByRole("button", { name: "Review again" }).click();
    await expect(page.getByRole("status")).toHaveText("Review count: 1");
    expect(errors).toEqual([]);
    expect(await page.locator("html").getAttribute("data-client-mode")).toBe(mode === "csr" ? "createRoot" : "hydrateRoot");
  });
}
