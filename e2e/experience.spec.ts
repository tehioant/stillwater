import { test, expect } from "@playwright/test";

test("opens a full-screen blue-hour pond and supports entering, moving, and reset", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Stillwater" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Enter the pond" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Enter the pond" }).click();
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.locator("#experience")).toHaveAttribute(
    "data-ready",
    "true",
  );
  const start = await page.evaluate(() =>
    (window as any).__stillwater?.snapshot(),
  );
  await page.locator("canvas").focus();
  await page.keyboard.down("w");
  await expect
    .poll(
      async () =>
        (await page.evaluate(() => (window as any).__stillwater.snapshot()))
          .camera.z,
      { timeout: 10000 },
    )
    .toBeLessThan(start.camera.z - 0.2);
  await page.keyboard.up("w");
  const moved = await page.evaluate(() =>
    (window as any).__stillwater.snapshot(),
  );
  expect(moved.camera.z).toBeLessThan(start.camera.z - 0.2);
  await page.getByRole("button", { name: "Reset view" }).click();
  const reset = await page.evaluate(() =>
    (window as any).__stillwater.snapshot(),
  );
  expect(reset.camera.z).toBeCloseTo(12, 1);
  expect(errors).toEqual([]);
});
