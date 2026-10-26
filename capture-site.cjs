const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const base = "http://localhost:3000";
const output = "site-screenshots";

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 }
  });

  fs.mkdirSync(output, { recursive: true });

  const routes = [
    "/",
    "/work",
    "/services",
    "/pricing",
    "/resources",
    "/faq",
    "/contact",
    "/admin/operations",
    "/admin/discovery",
    "/admin/projects",
    "/admin/billing",
    "/admin/portfolio",
    "/admin/reviews",
    "/client/login",
    "/client/dashboard"
  ];

  for (const route of routes) {
    try {
      const response = await page.goto(base + route, {
        waitUntil: "domcontentloaded",
        timeout: 30000
      });

      await page.waitForTimeout(1500);

      if (response && response.status() >= 400) {
        console.log("HTTP", response.status(), route);
        continue;
      }

      const name = route === "/"
        ? "homepage"
        : route.replace(/\W+/g, "-");

      await page.screenshot({
        path: path.join(output, name + ".png"),
        fullPage: true
      });

      console.log("Captured:", route);
    } catch (error) {
      console.log("Failed:", route, error.message);
    }
  }

  await browser.close();
  console.log("Screenshots completed.");
})();
