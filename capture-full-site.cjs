const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const readline = require("readline");

const BASE = "http://localhost:3000";
const OUT = path.resolve("rapidlyon-full-audit");
const APP = fs.existsSync("src/app") ? "src/app" : "app";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});
const ask = q => new Promise(r => rl.question(q, r));

fs.mkdirSync(OUT, { recursive: true });

function discover() {
  const routes = new Set(["/"]);
  const dynamic = [];

  function walk(dir) {
    if (!fs.existsSync(dir)) return;

    for (const item of fs.readdirSync(dir, {
      withFileTypes: true
    })) {
      const full = path.join(dir, item.name);

      if (item.isDirectory()) {
        walk(full);
      } else if (/^page\.(tsx|jsx|js|ts)$/.test(item.name)) {
        const parts = path.relative(APP, dir)
          .split(path.sep)
          .filter(x => x && !/^\(.*\)$/.test(x))
          .filter(x => !x.startsWith("@"));

        const route = "/" + parts.join("/");

        if (route.includes("[")) dynamic.push(route);
        else routes.add(route);
      }
    }
  }

  walk(APP);
  return { routes: [...routes].sort(), dynamic };
}

async function login(browser, route, label) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });

  const page = await context.newPage();
  await page.goto(BASE + route, {
    waitUntil: "domcontentloaded"
  });

  console.log("\nLOGIN:", label);
  console.log("Complete login in browser.");
  await ask("Then press ENTER here...");

  await page.close();
  return context;
}

async function capture(context, route, device, report) {
  const page = await context.newPage();

  try {
    await page.setViewportSize(
      device === "desktop"
        ? { width: 1440, height: 900 }
        : { width: 390, height: 844 }
    );

    const response = await page.goto(BASE + route, {
      waitUntil: "domcontentloaded",
      timeout: 30000
    });

    await page.waitForTimeout(1800);

    const status = response?.status() || 0;
    const finalPath = new URL(page.url()).pathname;

    if (status >= 400) {
      report.push({ route, device, status, result: "HTTP error" });
      return;
    }

    if (
      finalPath !== route &&
      /\/(login|signin|sign-in)$/.test(finalPath)
    ) {
      report.push({
        route, device,
        result: "Login redirect",
        finalPath
      });
      return;
    }

    const name = route === "/"
      ? "home"
      : route.replace(/[^a-z0-9]/gi, "-");

    const folder = path.join(OUT, device);
    fs.mkdirSync(folder, { recursive: true });

    await page.screenshot({
      path: path.join(folder, name + ".png"),
      fullPage: true,
      animations: "disabled",
      timeout: 30000
    });

    report.push({ route, device, status, result: "captured" });
    console.log("OK", device, route);

  } catch (err) {
    report.push({
      route, device,
      result: "failed",
      error: err.message
    });
    console.log("FAILED", route, err.message);
  } finally {
    await page.close();
  }
}

(async () => {
  const browser = await chromium.launch({ headless: false });

  const publicContext = await browser.newContext();

  const adminContext = await login(
    browser, "/admin/login", "ADMIN"
  );

  const clientContext = await login(
    browser, "/client/login", "CLIENT"
  );

  const { routes, dynamic } = discover();

  const report = [];

  for (const device of ["desktop", "mobile"]) {
    for (const route of routes) {
      if (route.startsWith("/api")) continue;

      const context = route.startsWith("/admin")
        ? adminContext
        : route.startsWith("/client")
        ? clientContext
        : publicContext;

      await capture(context, route, device, report);
    }
  }

  fs.writeFileSync(
    path.join(OUT, "audit-report.json"),
    JSON.stringify({ routes, dynamic, report }, null, 2)
  );

  console.log("\nDONE");
  console.log("Captured:", report.filter(x => x.result === "captured").length);
  console.log("Dynamic routes requiring examples:", dynamic.length);

  await browser.close();
  rl.close();
})().catch(err => {
  console.error(err);
  rl.close();
  process.exitCode = 1;
});
