const state = {
  pageLoadTs: performance.now(),
  firstClickMs: null,
  mouseMoveCount: 0,
  keystrokeCount: 0,
  typingStartMs: null,
  typingEndMs: null,
  trapClicked: false
};

const captchaState = {
  active: false,
  verified: false,
  activationDelayMs: 0,
  activatedAt: null,
  challengeType: null,
  challengePrompt: null,
  challengeAnswer: null,
  userAnswer: "",
  challengeCreatedAt: null,
  timeToSolveMs: null,
  honeypotTriggered: false,
  attempts: 0
};

const statusEl = document.getElementById("status");
const statusMessageEl = document.getElementById("status-message");
const statusReasonEl = document.getElementById("status-reason");
const formEl = document.getElementById("login-form");
const trapBtn = document.getElementById("trap-btn");
const usernameEl = document.getElementById("username");
const passwordEl = document.getElementById("password");
const loginBtn = document.getElementById("login-btn");
const captchaEl = document.getElementById("captcha");
const captchaPrompt = document.getElementById("captcha-prompt");
const captchaAnswer = document.getElementById("captcha-answer");
const captchaRefresh = document.getElementById("captcha-refresh");
const captchaStatus = document.getElementById("captcha-status");
const captchaHp = document.getElementById("captcha-hp");

initBotDetect();
initBehaviorTracking();
initCaptcha();

formEl.addEventListener("submit", async (event) => {
  event.preventDefault();

  const username = usernameEl.value.trim();
  const automationSignals = collectAutomationSignals();
  const botDetectPayload = collectBotDetect();

  // Humans must finish CAPTCHA; bots (automation signals) still get logged server-side.
  const shouldForceServerCheck = automationSignals.webdriver
    || botDetectPayload?.decision === "bot"
    || event.isTrusted === false;

  if (!captchaState.verified && !shouldForceServerCheck) {
    setCaptchaStatus("Please complete the slider to verify you're human.", "error");
    return;
  }
  const captchaPayload = buildCaptchaPayload();

  const nowMs = performance.now();
  const timingMs = {
    timeToFirstClickMs: state.firstClickMs,
    timeToSubmitMs: Math.round(nowMs - state.pageLoadTs)
  };

  const typingDurationMs = state.typingStartMs && state.typingEndMs
    ? Math.round(state.typingEndMs - state.typingStartMs)
    : 0;

  const payload = {
    username,
    trapClicked: state.trapClicked,
    behavior: {
      timingMs,
      mouseMoveCount: state.mouseMoveCount,
      keystrokeCount: state.keystrokeCount,
      typingDurationMs
    },
    botDetect: botDetectPayload,
    automationSignals,
    captcha: captchaPayload,
    fingerprint: collectFingerprint()
  };

  setStatus("Analyzing request...", "");

  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    const isAccepted = result.decision === "ACCEPTED";
    const fallback = isAccepted
      ? {
        message: "Verification successful.",
        reason: "Thanks for completing the human check."
      }
      : {
        message: "We could not verify this attempt.",
        reason: "Please try again and complete the verification."
      };

    const message = result.userMessage || fallback.message;
    const reason = result.userReason || fallback.reason;

    if (isAccepted) {
      setStatus(message, "success", reason);
      triggerHaptic("accepted");
    } else {
      setStatus(message, "danger", reason);
      triggerHaptic("rejected");
    }
  } catch (error) {
    setStatus("Server error.", "danger", "Please try again in a moment.");
    console.error(error);
  }
});

function initBotDetect() {
  if (!window.BotDetect?.collector || !window.BotDetect?.detector) {
    setStatus("Security checks unavailable.", "danger", "Please verify the demo setup.");
    return;
  }

  try {
    // Enables built-in traps from bot-detect (automation hooks / headless checks)
    if (typeof window.BotDetect.collector.enableTraps === "function") {
      window.BotDetect.collector.enableTraps();
    }
  } catch (error) {
    console.warn("BotDetect traps failed to initialize", error);
  }
}

function collectBotDetect() {
  if (!window.BotDetect?.collector || !window.BotDetect?.detector) {
    return {
      decision: "unknown",
      results: [],
      error: "bot-detect not loaded"
    };
  }

  try {
    const results = window.BotDetect.collector.collect();
    const decision = window.BotDetect.detector.detect(results);
    return { results, decision };
  } catch (error) {
    console.warn("BotDetect collection failed", error);
    return {
      decision: "unknown",
      results: [],
      error: error?.message || "collection failed"
    };
  }
}

function initBehaviorTracking() {
  document.addEventListener("click", () => {
    if (state.firstClickMs === null) {
      state.firstClickMs = Math.round(performance.now() - state.pageLoadTs);
    }
  });

  document.addEventListener("mousemove", () => {
    if (state.mouseMoveCount < 500) {
      state.mouseMoveCount += 1;
    }
  });

  const typingHandler = () => {
    const nowMs = performance.now();
    if (state.typingStartMs === null) {
      state.typingStartMs = nowMs;
    }
    state.typingEndMs = nowMs;
    state.keystrokeCount += 1;
  };

  usernameEl.addEventListener("keydown", typingHandler);
  passwordEl.addEventListener("keydown", typingHandler);

  trapBtn.addEventListener("click", () => {
    state.trapClicked = true;
  });
}

function initCaptcha() {
  // Randomized text-based CAPTCHA with honeypot field.
  loginBtn.disabled = true;
  captchaEl.classList.add("captcha--inactive");

  captchaHp.addEventListener("input", () => {
    captchaState.honeypotTriggered = true;
  });

  captchaHp.addEventListener("focus", () => {
    captchaState.honeypotTriggered = true;
  });

  scheduleCaptchaActivation();

  if (captchaRefresh) {
    captchaRefresh.addEventListener("click", () => {
      if (!captchaState.active) return;
      generateCaptchaChallenge();
      setCaptchaStatus("New verification generated.", "");
    });
  }

  if (captchaAnswer) {
    captchaAnswer.addEventListener("input", () => {
      captchaState.userAnswer = String(captchaAnswer.value || "").trim();
      if (!captchaState.active) return;
      validateCaptchaAnswer();
    });
  }
}

function scheduleCaptchaActivation() {
  const delay = randomBetween(600, 1200);
  captchaState.activationDelayMs = delay;
  setCaptchaStatus("Preparing verification...", "");

  window.setTimeout(() => {
    captchaState.active = true;
    captchaState.activatedAt = performance.now();
    captchaEl.classList.remove("captcha--inactive");
    generateCaptchaChallenge();
    setCaptchaStatus("Complete the verification to continue.", "");
  }, delay);
}

function generateCaptchaChallenge() {
  const challenge = createRandomChallenge();
  captchaState.challengeType = challenge.type;
  captchaState.challengePrompt = challenge.prompt;
  captchaState.challengeAnswer = challenge.answer;
  captchaState.userAnswer = "";
  captchaState.challengeCreatedAt = performance.now();
  captchaState.timeToSolveMs = null;
  captchaState.verified = false;
  captchaState.attempts += 1;
  loginBtn.disabled = true;
  captchaEl.classList.remove("captcha--verified");
  if (captchaPrompt) captchaPrompt.textContent = challenge.prompt;
  if (captchaAnswer) captchaAnswer.value = "";
}

function validateCaptchaAnswer() {
  if (!captchaState.challengeAnswer) return;
  const normalizedAnswer = normalizeAnswer(captchaState.challengeAnswer);
  const normalizedUser = normalizeAnswer(captchaState.userAnswer);
  const verified = normalizedUser.length > 0 && normalizedUser === normalizedAnswer && !captchaState.honeypotTriggered;
  captchaState.verified = verified;
  loginBtn.disabled = !verified;

  if (verified) {
    captchaState.timeToSolveMs = Math.round(performance.now() - captchaState.challengeCreatedAt);
    setCaptchaStatus("Verification complete.", "success");
    captchaEl.classList.add("captcha--verified");
    triggerHaptic("captcha");
  } else if (normalizedUser.length > 0) {
    setCaptchaStatus("Verification does not match. Try again.", "error");
  } else {
    setCaptchaStatus("Complete the verification to continue.", "");
  }
}

function buildCaptchaPayload() {
  return {
    verified: captchaState.verified,
    type: captchaState.challengeType,
    prompt: captchaState.challengePrompt,
    answer: captchaState.challengeAnswer,
    userAnswer: captchaState.userAnswer,
    attempts: captchaState.attempts,
    timeToSolveMs: captchaState.timeToSolveMs,
    honeypotTriggered: captchaState.honeypotTriggered,
    activationDelayMs: captchaState.activationDelayMs
  };
}

function setCaptchaStatus(message, stateClass) {
  captchaStatus.textContent = message;
  captchaStatus.className = `captcha__status ${stateClass}`.trim();
}

function collectFingerprint() {
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  };
}


function collectAutomationSignals() {
  const userAgent = navigator.userAgent || "";
  return {
    webdriver: navigator.webdriver === true,
    headlessUA: /Headless|PhantomJS|SlimerJS|Electron/i.test(userAgent),
    pluginsLength: navigator.plugins ? navigator.plugins.length : null,
    languagesLength: navigator.languages ? navigator.languages.length : null
  };
}


function setStatus(message, stateClass, reason) {
  if (statusMessageEl) {
    statusMessageEl.textContent = message || "";
  }
  if (statusReasonEl) {
    statusReasonEl.textContent = reason || "";
  }
  const modifier = stateClass ? `status--${stateClass}` : "";
  const visible = message || reason ? "status--visible" : "";
  statusEl.className = `status ${modifier} ${visible}`.trim();
}


function triggerHaptic(type) {
  // Subtle haptics for humans. Bots gain no benefit.
  if (!("vibrate" in navigator)) return;
  const patterns = {
    captcha: [20],
    accepted: [30],
    rejected: [25, 40, 25]
  };
  navigator.vibrate(patterns[type] || 0);
}

function createRandomChallenge() {
  const types = ["word", "math", "code"];
  const type = types[Math.floor(Math.random() * types.length)];

  if (type === "math") {
    const a = randomBetween(2, 9);
    const b = randomBetween(3, 11);
    return {
      type,
      prompt: `What is ${a} + ${b}?`,
      answer: String(a + b)
    };
  }

  if (type === "code") {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 4; i += 1) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return {
      type,
      prompt: `Enter the code: ${code}`,
      answer: code
    };
  }

  const words = ["ocean", "purple", "secure", "signal", "verify", "human", "trust", "random"];
  const word = words[Math.floor(Math.random() * words.length)];
  return {
    type,
    prompt: `Type the word: ${word}`,
    answer: word
  };
}

function normalizeAnswer(value) {
  return String(value || "").trim().toLowerCase();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
