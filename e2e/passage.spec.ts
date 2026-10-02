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
async function stepUntil(
  page: Page,
  predicate: (state: any) => boolean,
  limit = 100,
) {
  for (let i = 0; i < limit; i++) {
    const state = await snapshot(page);
    if (predicate(state)) return state;
    await page.clock.fastForward(250);
  }
  throw new Error(
    `Journey condition not reached: ${JSON.stringify(await snapshot(page))}`,
  );
}

test("central mountains open on approach; intentional travel arrives in a forest and returns", async ({
  page,
}) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await enter(page);
  expect((await snapshot(page)).passage?.world).toBe("pond");
  await page.keyboard.down("w");
  await stepUntil(page, (state) => state.passage.opening > 0.45);
  await page.keyboard.up("w");
  await page.clock.fastForward(250);
  expect((await snapshot(page)).passage.phase).toBe("idle");
  expect((await snapshot(page)).passage.mountainOpening).toBeGreaterThan(0.4);
  await page.screenshot({
    path: "qa/screenshots/passage/mountains-opening.png",
  });
  await page.keyboard.down("w");
  await stepUntil(page, (state) => state.passage.phase === "travel");
  await page.keyboard.up("w");
  const paused = (await snapshot(page)).camera.z;
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await page.clock.fastForward(250);
  expect((await snapshot(page)).camera.z).toBe(paused);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await stepUntil(
    page,
    (state) =>
      state.passage.world === "forest" && state.passage.phase === "idle",
    30,
  );
  const forest = await snapshot(page);
  expect(forest.passage.fireflies).toBeGreaterThan(0);
  expect(forest.passage.trees).toBeGreaterThan(0);
  expect(forest.passage.stream).toBe(true);
  expect(forest.camera.z).toBeCloseTo(9.5);
  await page.screenshot({ path: "qa/screenshots/passage/forest-desktop.png" });
  expect(errors).toEqual([]);
  // Turn around with real drag-look input and glide back through the mist arch.
  await page.mouse.move(480, 300);
  await page.mouse.down();
  await page.mouse.move(480 - Math.PI / 0.003, 300, { steps: 8 });
  await page.mouse.up();
  await page.keyboard.down("w");
  await stepUntil(page, (state) => state.passage.phase === "travel", 40);
  await page.keyboard.up("w");
  await stepUntil(
    page,
    (state) => state.passage.world === "pond" && state.passage.phase === "idle",
    30,
  );
  expect((await snapshot(page)).entities.length).toBeGreaterThan(0);
  expect((await snapshot(page)).camera.z).toBeCloseTo(-20);
  expect(errors).toEqual([]);
});

test("reduced motion crosses with a fade, keeps fireflies frozen, and reset cancels safely", async ({
  page,
}) => {
  test.setTimeout(180000);
  await enter(page);
  await page.getByRole("button", { name: "Reduce motion" }).click();
  await page.locator("canvas").focus();
  await page.keyboard.down("w");
  await stepUntil(page, (state) => state.passage.phase === "travel");
  await page.keyboard.up("w");
  const before = (await snapshot(page)).camera;
  await page.clock.fastForward(100);
  expect((await snapshot(page)).camera.z).toBe(before.z);
  await stepUntil(
    page,
    (state) =>
      state.passage.world === "forest" && state.passage.phase === "idle",
    6,
  );
  expect((await snapshot(page)).camera.z).toBe(12);
  const frozen = (await snapshot(page)).passage.fireflyTime;
  await page.clock.fastForward(1000);
  expect((await snapshot(page)).passage.fireflyTime).toBe(frozen);
  await page.getByRole("button", { name: "Return to pond" }).click();
  await page.getByRole("button", { name: "Reset view" }).click();
  await page.clock.fastForward(250);
  expect((await snapshot(page)).passage.world).toBe("forest");
  expect((await snapshot(page)).passage.phase).toBe("idle");
  expect((await snapshot(page)).camera.z).toBe(12);
});

test("touch glide crosses into the glade and mobile return controls remain usable", async ({
  browser,
}) => {
  test.setTimeout(180000);
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await enter(page);
  const forward = await page
    .getByRole("button", { name: "Glide forward", exact: true })
    .boundingBox();
  expect(forward).not.toBeNull();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      {
        x: forward!.x + forward!.width / 2,
        y: forward!.y + forward!.height / 2,
      },
    ],
  });
  await stepUntil(page, (state) => state.passage.phase === "travel");
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await stepUntil(
    page,
    (state) =>
      state.passage.world === "forest" && state.passage.phase === "idle",
    30,
  );
  expect((await snapshot(page)).passage.fireflies).toBe(44);
  await page.screenshot({ path: "qa/screenshots/passage/forest-mobile.png" });
  const layout = await page.evaluate(() => {
    const note = document
      .querySelector(".footer-note")!
      .getBoundingClientRect();
    const nav = document
      .querySelector(".bottom-bar nav")!
      .getBoundingClientRect();
    return {
      noteRight: note.right,
      navLeft: nav.left,
      navRight: nav.right,
      width: innerWidth,
    };
  });
  expect(layout.navLeft).toBeGreaterThanOrEqual(layout.noteRight);
  expect(layout.navRight).toBeLessThanOrEqual(layout.width);
  await page.getByRole("button", { name: "Return to pond" }).tap();
  await stepUntil(
    page,
    (state) => state.passage.world === "pond" && state.passage.phase === "idle",
    30,
  );
  expect(errors).toEqual([]);
  await context.close();
});
