import { test, expect, type Page } from "@playwright/test";
const snapshot = (page: Page) =>
  page.evaluate(() => (window as any).__stillwater.snapshot());
async function enter(page: Page) {
  await page.goto("/?test=1");
  await page.getByRole("button", { name: "Enter the pond" }).click();
}

test("water ripples only on a click, not hover, hold, drag, or controls", async ({
  page,
}) => {
  await page.clock.install();
  await enter(page);
  await page.clock.pauseAt(
    await page.evaluate(() => new Date(Date.now() + 100)),
  );
  const activeWaves = async () =>
    (await snapshot(page)).water.ripples.filter(
      (wave: number[]) => wave[3] > 0,
    );
  const start = await snapshot(page);
  expect(start.water.reflective).toBe(true);
  await page.mouse.move(400, 400);
  await page.clock.fastForward(250);
  expect(await activeWaves()).toHaveLength(0);
  expect((await snapshot(page)).water.flow).toEqual([0, 0]);
  await page.mouse.down();
  await page.clock.fastForward(250);
  expect(await activeWaves()).toHaveLength(0);
  await page.mouse.up();
  await page.clock.fastForward(100);
  expect(await activeWaves()).toHaveLength(1);
  const first = (await activeWaves())[0];
  await page.mouse.move(650, 420, { steps: 10 });
  await page.clock.fastForward(250);
  expect(await activeWaves()).toHaveLength(1);
  expect((await activeWaves())[0].slice(0, 2)).toEqual(first.slice(0, 2));
  await page.mouse.click(650, 420);
  await page.clock.fastForward(100);
  expect(await activeWaves()).toHaveLength(2);
  await page.mouse.click(650, 420);
  await page.clock.fastForward(100);
  expect(await activeWaves()).toHaveLength(3);
  const after = await snapshot(page);
  expect(after.camera.x).toBe(start.camera.x);
  expect(after.camera.z).toBe(start.camera.z);
  expect(after.camera.yaw).toBe(start.camera.yaw);
  await page.mouse.down();
  await page.mouse.move(680, 440, { steps: 5 });
  await page.mouse.up();
  await page.clock.fastForward(100);
  expect(await activeWaves()).toHaveLength(3);
  await page.mouse.click(650, 420, { button: "right" });
  await page.clock.fastForward(100);
  expect(await activeWaves()).toHaveLength(3);
  await page.mouse.click(400, 40);
  await page.clock.fastForward(100);
  expect(await activeWaves()).toHaveLength(3);
  // A pending click is discarded on focus loss, not replayed on return.
  await page.mouse.click(400, 400);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await page.clock.fastForward(100);
  expect(await activeWaves()).toHaveLength(3);
  await page.getByRole("button", { name: "Reduce motion" }).click();
  const frozen = (await snapshot(page)).water.ripples;
  await page.mouse.click(400, 400);
  await page.clock.fastForward(250);
  expect((await snapshot(page)).water.ripples).toEqual(frozen);
  await page.getByRole("button", { name: "Enable gentle motion" }).click();
  await page.clock.fastForward(100);
  expect(await activeWaves()).toHaveLength(3);
});

test("touch taps create one water ripple even after a delayed frame; touch drags do not", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.clock.install();
  await enter(page);
  await page.clock.pauseAt(
    await page.evaluate(() => new Date(Date.now() + 100)),
  );
  const waves = async () =>
    (await snapshot(page)).water.ripples.filter(
      (wave: number[]) => wave[3] > 0,
    );
  expect(await waves()).toHaveLength(0);
  await page.touchscreen.tap(170, 590);
  await page.clock.fastForward(4000);
  expect(await waves()).toHaveLength(1);
  expect((await waves())[0][3]).toBeCloseTo(0.28);
  await page.touchscreen.tap(170, 590);
  await page.clock.fastForward(100);
  expect(await waves()).toHaveLength(2);
  const cdp = await context.newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: 170, y: 590 }],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: 210, y: 620 }],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await page.clock.fastForward(100);
  expect(await waves()).toHaveLength(2);
  await page.getByRole("button", { name: "Reset view" }).click();
  await page.clock.fastForward(100);
  expect(await waves()).toHaveLength(2);
  await context.close();
});

test("hovering a lantern turns its actual material red and restores amber on leave", async ({
  page,
}) => {
  await enter(page);
  const lantern = (await snapshot(page)).entities.find(
    (e: any) => e.id === "lantern-1",
  );
  let hit = false;
  for (const dy of [-35, -65, -95, -120, 0]) {
    await page.mouse.move(lantern.x, lantern.y + dy);
    await page.waitForTimeout(180);
    if (
      (await snapshot(page)).entities.find((e: any) => e.id === lantern.id)
        .hovered
    ) {
      hit = true;
      break;
    }
  }
  expect(hit).toBe(true);
  await expect
    .poll(
      async () =>
        (await snapshot(page)).entities.find((e: any) => e.id === lantern.id)
          .lampColor[1],
    )
    .toBeLessThan(0.2);
  await page.mouse.move(3, 3);
  await expect
    .poll(
      async () =>
        (await snapshot(page)).entities.find((e: any) => e.id === lantern.id)
          .lampColor[1],
    )
    .toBeGreaterThan(0.8);
});

test("the sky contains stars and lanterns float at different heights above the water", async ({
  page,
}) => {
  await enter(page);
  const scene = await snapshot(page);
  expect(scene.stars).toBeGreaterThanOrEqual(2400);
  const lanterns = scene.entities.filter((e: any) => e.kind === "lantern");
  expect(
    lanterns.filter((e: any) => e.position[1] > 2).length,
  ).toBeGreaterThanOrEqual(3);
  expect(lanterns.some((e: any) => e.position[1] < 0.2)).toBe(true);
});
