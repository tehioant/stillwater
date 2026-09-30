import { test, expect, type Page } from "@playwright/test";
const snapshot = (page: Page) =>
  page.evaluate(() => (window as any).__stillwater.snapshot());
async function enter(page: Page) {
  await page.goto("/?test=1");
  await page.getByRole("button", { name: "Enter the pond" }).click();
  await expect(page.locator("#experience")).toHaveAttribute(
    "data-ready",
    "true",
  );
}
async function hoverObject(page: Page, kind: string) {
  const scene = await snapshot(page);
  const entity = scene.entities
    .filter((e: any) => e.kind === kind && e.visible && e.response > 0)
    .sort((a: any, b: any) => b.response - a.response)[0];
  expect(entity, `nearby visible ${kind}`).toBeTruthy();
  for (const dy of [0, -12, -25, -40, 12, 25]) {
    await page.mouse.move(entity.x, entity.y + dy);
    await page.waitForTimeout(120);
    const state = await snapshot(page);
    if (state.entities.find((e: any) => e.id === entity.id).response === 1)
      return entity.id;
  }
  throw new Error(`No hover intersection for ${kind} ${entity.id}`);
}

test("lotus hover opens further and lantern hover warms light; leaving restores proximity", async ({
  page,
}) => {
  await enter(page);
  for (const kind of ["lotus", "lantern"]) {
    const id = await hoverObject(page, kind);
    const hovered = (await snapshot(page)).entities.find(
      (e: any) => e.id === id,
    );
    expect(hovered.response).toBe(1);
    await page.waitForTimeout(650);
    await page.mouse.move(4, 4);
    const left = (await snapshot(page)).entities.find((e: any) => e.id === id);
    await expect
      .poll(
        async () =>
          (await snapshot(page)).entities.find((e: any) => e.id === id)
            .response,
      )
      .toBeLessThan(1);
  }
});

test("reduced motion freezes ambient time but keeps intentional navigation and guide working", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await enter(page);
  const start = await snapshot(page);
  expect(start.reducedMotion).toBe(true);
  await page.waitForTimeout(350);
  expect((await snapshot(page)).elapsed).toBe(start.elapsed);
  await page.getByRole("button", { name: "How to explore" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("button", { name: "Enable gentle motion" }).click();
  await expect
    .poll(async () => (await snapshot(page)).elapsed)
    .toBeGreaterThan(start.elapsed);
});

test("camera projection matches the viewport on first render, not only after resize", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await enter(page);
  expect((await snapshot(page)).camera.aspect).toBeCloseTo(1440 / 900, 5);
});

test("drag look and resizing keep the scene intact; focus loss releases movement", async ({
  page,
}) => {
  await enter(page);
  await page.mouse.move(650, 350);
  await page.mouse.down();
  await page.mouse.move(790, 385, { steps: 5 });
  await page.mouse.up();
  expect(Math.abs((await snapshot(page)).camera.yaw)).toBeGreaterThan(0.1);
  await page.setViewportSize({ width: 900, height: 650 });
  await expect(page.locator("canvas")).toHaveJSProperty("clientWidth", 900);
  await page.locator("canvas").focus();
  await page.keyboard.down("w");
  await page.waitForTimeout(200);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  const before = await snapshot(page);
  await page.waitForTimeout(200);
  const after = await snapshot(page);
  expect(after.camera.z).toBeCloseTo(before.camera.z, 3);
  await page.keyboard.up("w");
});

test("optional sound toggles without autoplay or runtime errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await enter(page);
  expect((await snapshot(page)).soundEnabled).toBe(false);
  await page.getByRole("button", { name: "Enable ambient sound" }).click();
  await expect(
    page.getByRole("button", { name: "Disable ambient sound" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Disable ambient sound" }).click();
  await expect(
    page.getByRole("button", { name: "Enable ambient sound" }),
  ).toHaveAttribute("aria-pressed", "false");
  expect(errors).toEqual([]);
});

test("touch visitors can glide and tap nearby flowers without page overflow", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await enter(page);
  await expect(
    page.getByRole("button", { name: "Glide forward" }),
  ).toBeVisible();
  const start = await snapshot(page);
  const button = page.getByRole("button", { name: "Glide forward" });
  const box = await button.boundingBox();
  const touch = await context.newCDPSession(page);
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: box!.x + 22, y: box!.y + 22 }],
  });
  await expect
    .poll(async () => (await snapshot(page)).camera.z, { timeout: 10000 })
    .toBeLessThan(start.camera.z - 0.15);
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  expect((await snapshot(page)).camera.z).toBeLessThan(start.camera.z - 0.15);
  await page.getByRole("button", { name: "Reset view" }).click();
  // A visible flower can still have its pre-reset projection. Require an actual
  // frame after reset before obtaining tap coordinates, even on a slow renderer.
  const elapsedAfterReset = (await snapshot(page)).elapsed;
  await expect
    .poll(async () => (await snapshot(page)).elapsed)
    .toBeGreaterThan(elapsedAfterReset);
  await expect
    .poll(
      async () =>
        (await snapshot(page)).entities.filter(
          (e: any) => e.kind === "lotus" && e.visible && e.response > 0,
        ).length,
    )
    .toBeGreaterThan(0);
  const flowers = (await snapshot(page)).entities.filter(
    (e: any) => e.kind === "lotus" && e.visible && e.response > 0,
  );
  expect(flowers.length).toBeGreaterThan(0);
  const flower = flowers[0];
  await page.touchscreen.tap(flower.x, flower.y);
  await expect
    .poll(
      async () =>
        (await snapshot(page)).entities.find((e: any) => e.id === flower.id)
          .response,
    )
    .toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  await page.screenshot({ path: "test-results/mobile.png" });
  await context.close();
});

test("lost graphics context offers a persistent recovery action", async ({
  page,
}) => {
  await enter(page);
  await page.evaluate(() =>
    document
      .querySelector("canvas")!
      .dispatchEvent(new Event("webglcontextlost", { cancelable: true })),
  );
  await expect(
    page.getByRole("button", { name: "Reload the pond" }),
  ).toBeVisible();
  await expect(page.getByText("The graphics connection paused.")).toBeVisible();
});

test("unsupported 3D graphics gets a readable fallback instead of a broken entry button", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      type: any,
      ...args: any[]
    ) {
      if (type === "webgl" || type === "webgl2") return null;
      return original.apply(this, [type, ...args] as any);
    } as any;
  });
  await page.goto("/");
  await expect(page.locator("#experience")).toHaveAttribute(
    "data-ready",
    "unsupported",
  );
  await expect(page.getByText(/3D graphics enabled/)).toBeVisible();
  await expect(page.locator("#enter")).not.toBeVisible();
});
