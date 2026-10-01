import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

// Run after starting the local Vite preview on port 4173.
// Step rendered simulation time deterministically without changing camera pose.
const directory = "qa/screenshots/water-waves";
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
try {
  for (const mobile of [false, true]) {
    const width = mobile ? 390 : 960;
    const height = mobile ? 844 : 600;
    const label = mobile ? "mobile" : "desktop";
    const page = await browser.newPage({
      viewport: { width, height },
      isMobile: mobile,
      hasTouch: mobile,
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.clock.install();
    await page.goto("http://127.0.0.1:4173/?test=1");
    await page.getByRole("button", { name: "Enter the pond" }).click();
    await page.clock.pauseAt(
      await page.evaluate(() => new Date(Date.now() + 100)),
    );
    await page.screenshot({ path: `${directory}/${label}-before.png` });
    const start = await page.evaluate(() => window.__stillwater.snapshot());
    // Mouse input exercises both shader quality modes without moving the camera.
    await page.mouse.move(width * 0.43, height * 0.69);
    await page.clock.fastForward(100);
    await page.mouse.move(width * 0.68, height * 0.7, { steps: 10 });
    for (let frame = 0; frame < 12; frame++) {
      await page.clock.fastForward(250);
      await page.screenshot({
        path: `${directory}/${label}-${String(frame).padStart(2, "0")}.png`,
      });
    }
    const after = await page.evaluate(() => window.__stillwater.snapshot());
    console.log(
      JSON.stringify({
        label,
        errors,
        cameraUnchanged:
          JSON.stringify(start.camera) === JSON.stringify(after.camera),
        activeRipples: after.water.ripples.filter((wave) => wave[3] > 0),
      }),
    );
    if (errors.length) throw new Error(`${label}: ${errors.join("; ")}`);
    await page.close();
  }
} finally {
  await browser.close();
}
