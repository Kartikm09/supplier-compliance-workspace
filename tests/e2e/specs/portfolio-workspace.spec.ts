import path from "node:path";

import { expect, test, type Page, type TestInfo } from "@playwright/test";

const accounts = {
  buyerAdmin: {
    email: "admin@apex-components.invalid",
    password: requiredEnvironment("E2E_BUYER_ADMIN_PASSWORD"),
    organization: "Apex Components Group",
  },
  buyerReviewer: {
    email: "reviewer@apex-components.invalid",
    password: requiredEnvironment("E2E_BUYER_REVIEWER_PASSWORD"),
    organization: "Apex Components Group",
  },
  novaOwner: {
    email: "owner@nova-plastics.invalid",
    password: requiredEnvironment("E2E_NOVA_OWNER_PASSWORD"),
    organization: "Nova Plastics Ltd.",
  },
  greenlineOwner: {
    email: "owner@greenline-packaging.invalid",
    password: requiredEnvironment("E2E_GREENLINE_OWNER_PASSWORD"),
    organization: "Greenline Packaging Works",
  },
};

const identifiers = {
  assessment: "60000000-0000-4000-8000-000000000001",
  finding: "80000000-0000-4000-8000-000000000001",
  novaRelationship: "40000000-0000-4000-8000-000000000001",
  program: "50000000-0000-4000-8000-000000000001",
};

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required for the authenticated E2E suite.`);
  }
  return value;
}

async function signIn(
  page: Page,
  account: (typeof accounts)[keyof typeof accounts],
) {
  await page.goto("/sign-in");
  await page.getByLabel("Work email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("heading", {
      name: `Good to see you, ${account.organization}`,
    }),
  ).toBeVisible();
}

async function capturePortfolioScreenshot(
  page: Page,
  testInfo: TestInfo,
  filename: string,
) {
  if (testInfo.project.name !== "desktop-chromium") return;
  await page.screenshot({
    animations: "disabled",
    fullPage: true,
    path: path.resolve(process.cwd(), "../../docs/screenshots", filename),
  });
}

test("buyer can inspect the complete qualification record", async ({
  page,
}, testInfo) => {
  await signIn(page, accounts.buyerAdmin);
  await expect(page.getByText("Buyer operations")).toBeVisible();
  await capturePortfolioScreenshot(page, testInfo, "buyer-dashboard.png");

  await page.goto(`/programs/${identifiers.program}`);
  await expect(
    page.getByRole("heading", { name: "Standard Supplier Qualification" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Version 1" })).toBeVisible();
  await capturePortfolioScreenshot(
    page,
    testInfo,
    "qualification-program-builder.png",
  );

  await page.goto(`/reviews/${identifiers.assessment}`);
  await expect(
    page.getByRole("heading", { name: "Standard Supplier Qualification" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Evidence review" })).toBeVisible();
  await capturePortfolioScreenshot(page, testInfo, "document-review.png");

  await page.goto(`/decisions/${identifiers.assessment}`);
  await expect(page.getByRole("heading", { name: "Decision readiness" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Decision history" })).toBeVisible();
  await capturePortfolioScreenshot(page, testInfo, "approval-decision.png");

  await page.goto("/audit");
  await expect(page.getByRole("heading", { name: "Audit events" })).toBeVisible();
  await expect(page.locator("tbody tr").first()).toBeVisible();
  await capturePortfolioScreenshot(page, testInfo, "audit-trail.png");
});

test("supplier sees shared records without buyer-internal fields", async ({
  page,
}, testInfo) => {
  await signIn(page, accounts.novaOwner);
  await expect(page.getByText("Supplier operations")).toBeVisible();
  await capturePortfolioScreenshot(page, testInfo, "supplier-dashboard.png");

  await page.goto(`/assessments/${identifiers.assessment}`);
  await expect(
    page.getByRole("heading", { name: "Standard Supplier Qualification" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Review and declare" })).toBeVisible();
  await capturePortfolioScreenshot(page, testInfo, "supplier-assessment.png");

  await page.goto(`/findings/${identifiers.finding}`);
  await expect(
    page.getByRole("heading", {
      name: "Continuity test evidence needs clarification",
    }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Buyer-only demonstration note: monitor this item at renewal.",
    ),
  ).toHaveCount(0);
  await expect(
    page.getByText(
      "Buyer-only demonstration rationale: medium residual continuity risk remains.",
    ),
  ).toHaveCount(0);
  await capturePortfolioScreenshot(
    page,
    testInfo,
    "finding-corrective-action.png",
  );
});

test("unrelated supplier is denied direct resource URLs", async ({
  page,
}, testInfo) => {
  await signIn(page, accounts.greenlineOwner);

  await page.goto(`/relationships/${identifiers.novaRelationship}`);
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(
    page.getByText("The requested record was not found or access was denied."),
  ).toBeVisible();
  await expect(page.getByText("Nova Plastics Ltd.")).toHaveCount(0);
  await capturePortfolioScreenshot(
    page,
    testInfo,
    "cross-tenant-access-denied.png",
  );

  await page.goto(`/assessments/${identifiers.assessment}`);
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Standard Supplier Qualification" }),
  ).toHaveCount(0);
});

test("reviewer navigation excludes owner-only decisions", async ({ page }) => {
  await signIn(page, accounts.buyerReviewer);
  await expect(page.getByRole("link", { name: "Review queue" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Decisions" })).toHaveCount(0);
  await page.goto(`/reviews/${identifiers.assessment}`);
  await expect(page.getByRole("button", { name: "Create finding" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Decision" })).toHaveCount(0);
});

test("mobile navigation remains usable", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium");
  await signIn(page, accounts.novaOwner);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(page.getByRole("link", { name: "Assessments" })).toBeVisible();
  await page.getByRole("link", { name: "Assessments" }).click();
  await expect(page.getByRole("heading", { name: "Assessments" })).toBeVisible();
});
