import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
const browser = await chromium.launch({
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
await page.goto("http://127.0.0.1:4173/?test=1");
await page.waitForFunction(
  () => document.querySelector("#experience").dataset.ready === "true",
);
await page.waitForTimeout(700);
await fs.mkdir("qa/screenshots", { recursive: true });
await page.screenshot({ path: "qa/screenshots/desktop-welcome.png" });
await page.getByRole("button", { name: "Enter the pond" }).click();
await page.waitForTimeout(700);
await page.screenshot({ path: "qa/screenshots/desktop-pond.png" });
console.log(
  JSON.stringify(
    {
      errors,
      scene: await page.evaluate(() => window.__stillwater.snapshot()),
    },
    null,
    2,
  ),
);
await browser.close();
