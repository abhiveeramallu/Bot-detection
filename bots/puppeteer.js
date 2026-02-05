const puppeteer = require("puppeteer");

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function run() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const page = await browser.newPage();
  await page.goto("http://localhost:3000", { waitUntil: "networkidle0" });

  await page.waitForFunction(() => {
    const captcha = document.getElementById("captcha");
    return captcha && !captcha.classList.contains("captcha--inactive");
  });

  await wait(400);

  const handle = await page.$("#captcha-handle");
  const track = await page.$("#captcha-track");
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
    await wait(50);
  }

  await page.mouse.up();

  await page.type("#username", "puppeteer_bot");
  await page.type("#password", "password123");
  await page.evaluate(() => {
    const form = document.getElementById("login-form");
    if (form) {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    }
  });

  if (typeof page.waitForTimeout === "function") {
    await page.waitForTimeout(1500);
  } else {
    await wait(1500);
  }
  console.log("Puppeteer bot attempted login.");

  await browser.close();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
