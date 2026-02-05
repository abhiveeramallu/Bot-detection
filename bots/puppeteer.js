const puppeteer = require("puppeteer");

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function resolveTargetUrl() {
  return process.env.BOT_TARGET_URL || "http://localhost:3000";
}

async function run() {
  const targetUrl = resolveTargetUrl();
  const timeoutMs = Number(process.env.BOT_TIMEOUT_MS) || 45000;
  const headless = process.env.BOT_HEADLESS === "false" ? false : "new";
  const browser = await puppeteer.launch({
    headless,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const page = await browser.newPage();
  page.setDefaultTimeout(timeoutMs);
  await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });

  try {
    await page.waitForSelector("#username", { timeout: timeoutMs });
    await page.waitForFunction(() => {
      const captcha = document.getElementById("captcha");
      return captcha && !captcha.classList.contains("captcha--inactive");
    }, { timeout: timeoutMs });
  } catch (error) {
    const pageUrl = page.url();
    const title = await page.title();
    console.error(`Page not ready for bot flow. url=${pageUrl} title=${title}`);
    throw error;
  }

  await wait(400);

  await page.waitForSelector("#captcha-prompt", { timeout: timeoutMs });
  const prompt = await page.$eval("#captcha-prompt", (el) => el.textContent || "");
  const answer = solveCaptchaPrompt(prompt);
  await page.type("#captcha-answer", answer);

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
  console.log(`Puppeteer bot attempted login on ${targetUrl}.`);

  await browser.close();
}

function solveCaptchaPrompt(prompt) {
  const text = String(prompt || "").trim();
  const mathMatch = text.match(/What is\\s+(\\d+)\\s*\\+\\s*(\\d+)\\?/i);
  if (mathMatch) {
    return String(Number(mathMatch[1]) + Number(mathMatch[2]));
  }
  const colonIndex = text.indexOf(":");
  if (colonIndex >= 0) {
    return text.slice(colonIndex + 1).trim();
  }
  const parts = text.split(" ");
  return parts[parts.length - 1] || "";
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
