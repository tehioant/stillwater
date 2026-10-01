import { test, expect, type Page } from "@playwright/test";
const snapshot = (page: Page) =>
  page.evaluate(() => (window as any).__stillwater.snapshot());
async function enter(page: Page) {
  await page.goto("/?test=1");
  await page.getByRole("button", { name: "Enter the pond" }).click();
}

test("water responds in the quiet centre without steering the camera", async ({
  page,
}) => {
  await enter(page);
  const start = await snapshot(page);
  expect(start.water.reflective).toBe(true);
  await page.mouse.move(400, 400);
  await expect
    .poll(
      async () =>
        ((await snapshot(page)).water.ripples ?? []).filter(
          (wave: number[]) => wave[3] > 0,
        ).length,
    )
    .toBeGreaterThan(0);
  const first = (await snapshot(page)).water.ripples.find(
    (wave: number[]) => wave[3] > 0,
  );
  await page.mouse.move(650, 420, { steps: 10 });
  await expect
    .poll(async () =>
      (await snapshot(page)).water.ripples.some(
        (wave: number[]) =>
          wave[3] > 0 &&
          Math.hypot(wave[0] - first[0], wave[1] - first[1]) > 0.35,
      ),
    )
    .toBe(true);
  await expect
    .poll(async () => Math.hypot(...(await snapshot(page)).water.flow))
    .toBeGreaterThan(0.02);
  const after = await snapshot(page);
  expect(after.camera.x).toBe(start.camera.x);
  expect(after.camera.z).toBe(start.camera.z);
  expect(after.camera.yaw).toBe(start.camera.yaw);
  expect(after.water.strength).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Reduce motion" }).click();
  const frozen = (await snapshot(page)).water.flow;
  const frozenWaves = (await snapshot(page)).water.ripples;
  await page.mouse.move(280, 560);
  await page.waitForTimeout(300);
  expect((await snapshot(page)).water.flow).toEqual(frozen);
  expect((await snapshot(page)).water.ripples).toEqual(frozenWaves);
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
