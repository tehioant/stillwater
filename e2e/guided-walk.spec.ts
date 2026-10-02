import { test, expect, type Page } from "@playwright/test";
const snapshot = (page: Page) =>
  page.evaluate(() => (window as any).__stillwater.snapshot());
async function enter(page: Page) {
  await page.clock.install();
  await page.goto("/?test=1");
  await page.getByRole("button", { name: "Enter the pond" }).click();
  await page.clock.pauseAt(
    await page.evaluate(() => new Date(Date.now() + 100)),
  );
}
async function arrive(page: Page) {
  for (let i = 0; i < 130; i++) {
    const state = await snapshot(page);
    if (state.passage.world === "forest" && state.passage.phase === "idle")
      return;
    await page.clock.fastForward(250);
  }
  throw new Error(
    `Walk did not arrive: ${JSON.stringify(await snapshot(page))}`,
  );
}

test("walk button guides to mountains, supports cancellation and arrives through the passage", async ({
  page,
}) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (e) => {
    if (e.type() === "error") errors.push(e.text());
  });
  await enter(page);
  const start = await snapshot(page);
  await expect(
    page.getByRole("button", { name: "Walk to mountains", exact: true }),
  ).toBeVisible({ timeout: 2000 });
  await page
    .getByRole("button", { name: "Walk to mountains", exact: true })
    .click();
  await page.clock.fastForward(250);
  expect((await snapshot(page)).camera.z).toBeLessThan(start.camera.z);
  expect((await snapshot(page)).camera.z).toBeGreaterThan(start.camera.z - 1);
  await page.getByRole("button", { name: "Stop walking", exact: true }).click();
  const stopped = (await snapshot(page)).camera.z;
  await page.clock.fastForward(1000);
  expect((await snapshot(page)).camera.z).toBe(stopped);
  await page.screenshot({
    path: "qa/screenshots/passage/walk-button-desktop.png",
  });
  await page
    .getByRole("button", { name: "Walk to mountains", exact: true })
    .click();
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await page.clock.fastForward(250);
  expect((await snapshot(page)).camera.z).toBe(stopped);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(
    page.getByRole("button", { name: "Walk to mountains", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Walk to mountains", exact: true })
    .click();
  await page.mouse.move(480, 300);
  await page.clock.fastForward(250);
  expect((await snapshot(page)).camera.z).toBe(stopped);
  await page
    .getByRole("button", { name: "Walk to mountains", exact: true })
    .click();
  await page.getByRole("button", { name: "Reset view" }).click();
  await page.clock.fastForward(250);
  expect((await snapshot(page)).camera.z).toBe(12);
  await page
    .getByRole("button", { name: "Walk to mountains", exact: true })
    .click();
  await arrive(page);
  await expect(
    page.getByRole("button", { name: "Walk to mountains", exact: true }),
  ).toBeHidden();
  expect((await snapshot(page)).camera.z).toBeCloseTo(9.5);
  expect(errors).toEqual([]);
});

test("reduced motion walk button uses a fade without automatic camera movement", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await enter(page);
  const before = (await snapshot(page)).camera;
  await page
    .getByRole("button", { name: "Walk to mountains", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await page.clock.fastForward(100);
  expect((await snapshot(page)).camera.z).toBe(before.z);
  await arrive(page);
  expect((await snapshot(page)).camera.z).toBe(12);
});

test("mobile walk button is touch-operable and fits the portrait scene", async ({
  browser,
}) => {
  test.setTimeout(180000);
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await enter(page);
  await page.clock.fastForward(1500);
  const button = page.getByRole("button", {
    name: "Walk to mountains",
    exact: true,
  });
  const box = await button.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: "qa/screenshots/passage/walk-button-mobile.png",
  });
  await button.tap();
  await arrive(page);
  expect((await snapshot(page)).passage.fireflies).toBe(44);
  await context.close();
});
