import { test, expect, type Page } from "@playwright/test";

const snapshot = (page: Page) =>
  page.evaluate(() => (window as any).__stillwater.snapshot());

test("mouse navigation pauses over controls and does not resume after guide or reset until a fresh move", async ({
  page,
}) => {
  await page.goto("/?test=1");
  const size = page.viewportSize()!;
  await page.mouse.move(size.width / 2, size.height * 0.18);
  await frames(page, 2);
  expect((await snapshot(page)).camera.z).toBe(12);
  await page.getByRole("button", { name: "Enter the pond" }).click();
  await page.mouse.move(size.width / 2, size.height * 0.18);
  await expect
    .poll(async () => (await snapshot(page)).camera.z)
    .toBeLessThan(11.8);
  await page.getByRole("button", { name: "How to explore" }).hover();
  const paused = (await snapshot(page)).camera;
  await frames(page, 4);
  expect((await snapshot(page)).camera).toEqual(paused);
  await page.getByRole("button", { name: "How to explore" }).click();
  await page.keyboard.press("Escape");
  await frames(page, 4);
  expect((await snapshot(page)).camera).toEqual(paused);
  await page.mouse.move(size.width / 2, size.height * 0.18);
  await expect
    .poll(async () => (await snapshot(page)).camera.z)
    .toBeLessThan(paused.z - 0.2);
  await page.getByRole("button", { name: "Reset view" }).click();
  await frames(page, 4);
  expect((await snapshot(page)).camera.z).toBe(12);
  await page.mouse.move(size.width / 2, size.height * 0.18);
  await expect
    .poll(async () => (await snapshot(page)).camera.z)
    .toBeLessThan(11.8);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  const blurred = (await snapshot(page)).camera;
  await frames(page, 4);
  expect((await snapshot(page)).camera).toEqual(blurred);
});

test("centre settles without excessive frame waits on a slow renderer", async ({
  page,
}) => {
  // Model the CI software renderer's long frame intervals, without lowering quality.
  await page.addInitScript(() => {
    const requestFrame = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) =>
      requestFrame(() => {
        window.setTimeout(() => callback(performance.now()), 1000);
      });
  });
  await page.goto("/?test=1");
  await page.getByRole("button", { name: "Enter the pond" }).click();
  const size = page.viewportSize()!;
  await page.mouse.move(size.width / 2, size.height * 0.18);
  await expect
    .poll(async () => (await snapshot(page)).camera.z)
    .toBeLessThan(11.8);
  expect((await snapshot(page)).navigationSpeed).toBeGreaterThan(0);
  await page.mouse.move(size.width / 2, size.height / 2);
  await expect
    .poll(async () => (await snapshot(page)).navigationSpeed, {
      timeout: 30000,
    })
    .toBeLessThan(0.001);
  const stopped = (await snapshot(page)).camera;
  await frames(page, 2);
  const later = (await snapshot(page)).camera;
  expect(later.z).toBeCloseTo(stopped.z, 2);
  expect(later.yaw).toBe(stopped.yaw);
});

async function frames(page: Page, count = 8) {
  await page.evaluate(
    (count) =>
      new Promise<void>((resolve) => {
        const next = () => {
          if (--count <= 0) resolve();
          else requestAnimationFrame(next);
        };
        requestAnimationFrame(next);
      }),
    count,
  );
}

test("mouse direction steers and glides without a held button; centre stops", async ({
  page,
}) => {
  await page.goto("/?test=1");
  await page.getByRole("button", { name: "Enter the pond" }).click();
  const size = page.viewportSize()!;
  const start = (await snapshot(page)).camera;
  await page.mouse.move(size.width / 2, size.height * 0.18);
  await expect
    .poll(async () => (await snapshot(page)).camera.z)
    .toBeLessThan(start.z - 0.2);

  await page.mouse.move(size.width * 0.86, size.height / 2);
  await expect
    .poll(async () => (await snapshot(page)).camera.yaw)
    .toBeLessThan(-0.1);
  await page.mouse.move(size.width * 0.14, size.height / 2);
  await expect
    .poll(async () => (await snapshot(page)).camera.yaw)
    .toBeGreaterThan(0.1);

  await page.getByRole("button", { name: "Reset view" }).click();
  await frames(page, 2);
  await page.mouse.move(size.width / 2, size.height * 0.82);
  await expect
    .poll(async () => (await snapshot(page)).camera.z)
    .toBeGreaterThan(12.2);

  expect((await snapshot(page)).navigationSpeed).toBeGreaterThan(0);
  await page.mouse.move(size.width / 2, size.height / 2);
  await expect
    .poll(async () => (await snapshot(page)).navigationSpeed)
    .toBeLessThan(0.001);
  const stopped = (await snapshot(page)).camera;
  await frames(page, 4);
  const later = (await snapshot(page)).camera;
  expect(later.z).toBeCloseTo(stopped.z, 2);
  expect(later.yaw).toBe(stopped.yaw);
  expect(await page.evaluate(() => document.pointerLockElement)).toBeNull();
});
