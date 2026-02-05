const { Builder, By, until } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");

function resolveTargetUrl() {
  return process.env.BOT_TARGET_URL || "http://localhost:3000";
}

async function run() {
  const targetUrl = resolveTargetUrl();
  const timeoutMs = Number(process.env.BOT_TIMEOUT_MS) || 45000;
  const headless = process.env.BOT_HEADLESS === "false" ? false : true;
  const options = new chrome.Options();
  if (headless) {
    options.addArguments("--headless=new");
  }
  options.addArguments("--disable-gpu");
  options.addArguments("--no-sandbox");
  options.addArguments("--window-size=1280,800");

  const driver = await new Builder()
    .forBrowser("chrome")
    .setChromeOptions(options)
    .build();

  try {
    await driver.get(targetUrl);
    await driver.wait(until.elementLocated(By.id("username")), timeoutMs);

    await driver.wait(async () => {
      const captcha = await driver.findElement(By.id("captcha"));
      const className = await captcha.getAttribute("class");
      return !className.includes("captcha--inactive");
    }, timeoutMs);

    await driver.sleep(400);

    const prompt = await driver.findElement(By.id("captcha-prompt")).getText();
    const answer = solveCaptchaPrompt(prompt);
    await driver.findElement(By.id("captcha-answer")).sendKeys(answer);

    await driver.findElement(By.id("username")).sendKeys("selenium_bot");
    await driver.findElement(By.id("password")).sendKeys("password123");

    await driver.executeScript(() => {
      const form = document.getElementById("login-form");
      if (form) {
        form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      }
    });

    await driver.sleep(1500);
    console.log(`Selenium bot attempted login on ${targetUrl}.`);
  } finally {
    await driver.quit();
  }
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
