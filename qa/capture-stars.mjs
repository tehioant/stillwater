import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

// Run with the local Vite preview on port 4173.
const directory = "qa/screenshots/stars";
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
    await page.screenshot({ path: `${directory}/${label}-pond.png` });
    await page.mouse.move(width / 2, height / 2);
    await page.mouse.down();
    await page.mouse.move(width / 2, height / 2 - 200, { steps: 10 });
    await page.mouse.up();
    await page.clock.fastForward(100);
    await page.screenshot({ path: `${directory}/${label}-sky.png` });
    const state = await page.evaluate(() => window.__stillwater.snapshot());
    console.log(JSON.stringify({ label, stars: state.stars, errors }));
    if (errors.length) throw new Error(`${label}: ${errors.join("; ")}`);
    await page.close();
  }
} finally {
  await browser.close();
}
