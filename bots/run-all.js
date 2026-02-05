const { spawn } = require("child_process");

const scripts = ["bot:puppeteer", "bot:playwright", "bot:selenium"];
const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

function runScript(script) {
  return new Promise((resolve, reject) => {
    const child = spawn(npmCmd, ["run", script], {
      stdio: "inherit",
      env: process.env
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${script} failed with code ${code}`));
      }
    });
  });
}

(async () => {
  for (const script of scripts) {
    console.log(`\n=== Running ${script} ===`);
    await runScript(script);
  }

  console.log("\nAll bot scripts completed.");
})().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
