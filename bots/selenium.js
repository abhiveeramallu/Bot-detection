const { Builder, By, until } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");

async function run() {
  const options = new chrome.Options();
  options.addArguments("--headless=new");
  options.addArguments("--disable-gpu");
  options.addArguments("--no-sandbox");
  options.addArguments("--window-size=1280,800");

  const driver = await new Builder()
    .forBrowser("chrome")
    .setChromeOptions(options)
    .build();

  try {
    await driver.get("http://localhost:3000");
    await driver.wait(until.elementLocated(By.id("username")), 5000);

    await driver.wait(async () => {
      const captcha = await driver.findElement(By.id("captcha"));
      const className = await captcha.getAttribute("class");
      return !className.includes("captcha--inactive");
    }, 5000);

    await driver.sleep(400);

    await driver.executeScript(() => {
      const handle = document.getElementById("captcha-handle");
      const track = document.getElementById("captcha-track");
      if (!handle || !track) return;

      track.scrollIntoView({ block: "center", inline: "center" });
      const rect = track.getBoundingClientRect();
      const startX = rect.left + 12;
      const endX = rect.right - 12;
      const y = rect.top + rect.height / 2;
      const steps = 12;

      const usePointer = typeof PointerEvent !== "undefined";

      const dispatch = (type, x, y, target) => {
        const options = {
          bubbles: true,
          clientX: x,
          clientY: y,
          pointerId: 1,
          pointerType: "mouse",
          isPrimary: true
        };
        const event = usePointer
          ? new PointerEvent(type, options)
          : new MouseEvent(type.replace("pointer", "mouse"), options);
        (target || document).dispatchEvent(event);
      };

      dispatch("pointerdown", startX, y, handle);
      for (let i = 1; i <= steps; i += 1) {
        const nextX = startX + ((endX - startX) * i) / steps;
        dispatch("pointermove", nextX, y, document);
      }
      dispatch("pointerup", endX, y, document);
    });

    await driver.findElement(By.id("username")).sendKeys("selenium_bot");
    await driver.findElement(By.id("password")).sendKeys("password123");

    await driver.executeScript(() => {
      const form = document.getElementById("login-form");
      if (form) {
        form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      }
    });

    await driver.sleep(1500);
    console.log("Selenium bot attempted login.");
  } finally {
    await driver.quit();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
