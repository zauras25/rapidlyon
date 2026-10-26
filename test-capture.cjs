const { chromium } = require("playwright");
const fs = require("fs");

(async () => {
  fs.mkdirSync("rapidlyon-full-audit", { recursive: true });

  const browser = await chromium.launch({
    headless: false
  });

  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 }
  });

  console.log("Opening homepage...");

  await page.goto("http://localhost:3000", {
    waitUntil: "domcontentloaded",
    timeout: 30000
  });

  await page.waitForTimeout(2000);

  await page.screenshot({
    path: "rapidlyon-full-audit/home-test.png",
    fullPage: true
  });

  console.log("SUCCESS: Screenshot saved!");

  await browser.close();
})().catch(error => {
  console.error("CAPTURE ERROR:", error);
  process.exitCode = 1;
});
