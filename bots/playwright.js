const { chromium } = require("playwright");

function resolveTargetUrl() {
  return process.env.BOT_TARGET_URL || "http://localhost:3000";
}

async function run() {
  const targetUrl = resolveTargetUrl();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(targetUrl, { waitUntil: "networkidle" });

  await page.waitForFunction(() => {
    const captcha = document.getElementById("captcha");
    return captcha && !captcha.classList.contains("captcha--inactive");
  });

  await page.waitForTimeout(400);

  const handle = await page.locator("#captcha-handle");
  const track = await page.locator("#captcha-track");
  const handleBox = await handle.boundingBox();
  const trackBox = await track.boundingBox();

  const startX = handleBox.x + handleBox.width / 2;
  const startY = handleBox.y + handleBox.height / 2;
  const endX = trackBox.x + trackBox.width - handleBox.width / 2 - 6;

  await page.mouse.move(startX, startY);
  await page.mouse.down();

  const steps = 12;
  for (let i = 1; i <= steps; i += 1) {
    const nextX = startX + ((endX - startX) * i) / steps;
    await page.mouse.move(nextX, startY);
    await page.waitForTimeout(50);
  }

  await page.mouse.up();
  await page.fill("#username", "playwright_bot");
  await page.fill("#password", "password123");
  await page.evaluate(() => {
    const form = document.getElementById("login-form");
    if (form) {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    }
  });

  await page.waitForTimeout(1500);
  console.log(`Playwright bot attempted login on ${targetUrl}.`);

  await browser.close();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
