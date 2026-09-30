import { test, expect } from "@playwright/test";

test("a touch tap survives a delayed next render frame", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.clock.install();
  await page.goto("/?test=1");
  await page.getByRole("button", { name: "Enter the pond" }).click();
  await page.clock.runFor(100);
  await page.clock.pauseAt(
    await page.evaluate(() => new Date(Date.now() + 10000)),
  );
  const flower = await page.evaluate(() =>
    (window as any).__stillwater
      .snapshot()
      .entities.find(
        (e: any) => e.kind === "lotus" && e.visible && e.response > 0,
      ),
  );
  expect(flower).toBeTruthy();
  await page.touchscreen.tap(flower.x, flower.y);
  // Simulate a renderer stall longer than the old wall-clock tap timeout.
  await page.clock.fastForward(4000);
  const tapped = await page.evaluate(
    (id) =>
      (window as any).__stillwater
        .snapshot()
        .entities.find((e: any) => e.id === id),
    flower.id,
  );
  expect(tapped.response).toBe(1);
  await context.close();
});
