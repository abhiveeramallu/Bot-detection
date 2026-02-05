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
  earlyAttempt: false,
  dragStartAt: null,
  dragEndAt: null,
  dragStartX: null,
  lastX: null,
  lastT: null,
  lastDx: null,
  dragDistance: 0,
  currentPosition: 0,
  speeds: [],
  numberOfCorrections: 0,
  dragDurationMs: 0,
  reactionTimeMs: 0,
  mouseSpeedVariance: 0,
  dragDistanceRatio: 0,
  clientScore: null,
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
const captchaTrack = document.getElementById("captcha-track");
const captchaHandle = document.getElementById("captcha-handle");
const captchaProgress = document.getElementById("captcha-progress");
const captchaStatus = document.getElementById("captcha-status");
const captchaHp = document.getElementById("captcha-hp");
const runBotsBtn = document.getElementById("run-bots");
const botLogEl = document.getElementById("bot-log");
const botLogStatusEl = document.getElementById("bot-log-status");
const botLogLinesEl = document.getElementById("bot-log-lines");
let botLogTimer = null;

initBotDetect();
initBehaviorTracking();
initCaptcha();
initBotRunner();

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
  // Behavioral CAPTCHA layers: honeypot + drag metrics + reaction time.
  loginBtn.disabled = true;
  captchaEl.classList.add("captcha--inactive");

  captchaHp.addEventListener("input", () => {
    captchaState.honeypotTriggered = true;
  });

  captchaHp.addEventListener("focus", () => {
    captchaState.honeypotTriggered = true;
  });

  scheduleCaptchaActivation();

  const supportsPointer = "PointerEvent" in window;
  if (supportsPointer) {
    captchaHandle.addEventListener("pointerdown", onDragStart);
    document.addEventListener("pointermove", onDragMove);
    document.addEventListener("pointerup", onDragEnd);
    document.addEventListener("pointercancel", onDragEnd);
  } else {
    captchaHandle.addEventListener("mousedown", onDragStart);
    document.addEventListener("mousemove", onDragMove);
    document.addEventListener("mouseup", onDragEnd);
  }
}

function scheduleCaptchaActivation() {
  const delay = randomBetween(650, 1400);
  captchaState.activationDelayMs = delay;
  setCaptchaStatus("Preparing verification...", "");

  window.setTimeout(() => {
    captchaState.active = true;
    captchaState.activatedAt = performance.now();
    captchaEl.classList.remove("captcha--inactive");
    setCaptchaStatus("Slide the handle to verify.", "");
  }, delay);
}

function onDragStart(event) {
  if (captchaState.verified) {
    return;
  }
  if (!captchaState.active) {
    captchaState.earlyAttempt = true;
    setCaptchaStatus("Please wait a moment, verification is loading.", "error");
    return;
  }

  const pointX = getClientX(event);
  captchaState.dragStartAt = performance.now();
  captchaState.reactionTimeMs = Math.round(captchaState.dragStartAt - captchaState.activatedAt);
  captchaState.dragStartX = pointX;
  captchaState.lastX = pointX;
  captchaState.lastT = captchaState.dragStartAt;
  captchaState.lastDx = null;
  captchaState.speeds = [];
  captchaState.numberOfCorrections = 0;
  captchaState.dragDistance = 0;

  if (event.pointerId !== undefined && captchaHandle.setPointerCapture) {
    captchaHandle.setPointerCapture(event.pointerId);
  }
}

function onDragMove(event) {
  if (!captchaState.dragStartAt) return;

  const now = performance.now();
  const pointX = getClientX(event);
  const dx = pointX - captchaState.lastX;
  const dt = now - captchaState.lastT;

  if (dt > 0) {
    const speed = Math.abs(dx) / dt;
    captchaState.speeds.push(speed);
  }

  if (captchaState.lastDx !== null && Math.sign(dx) !== Math.sign(captchaState.lastDx) && Math.abs(dx) > 2) {
    captchaState.numberOfCorrections += 1;
  }

  captchaState.lastDx = dx;
  captchaState.lastX = pointX;
  captchaState.lastT = now;

  const { position, ratio } = updateHandlePosition(pointX);
  captchaState.currentPosition = position;
  captchaState.dragDistance = Math.max(captchaState.dragDistance, position);
  captchaState.dragDistanceRatio = ratio;
}

function onDragEnd() {
  if (!captchaState.dragStartAt) return;

  captchaState.dragEndAt = performance.now();
  captchaState.dragDurationMs = Math.round(captchaState.dragEndAt - captchaState.dragStartAt);
  captchaState.mouseSpeedVariance = computeVariance(captchaState.speeds);
  captchaState.attempts += 1;

  captchaState.clientScore = scoreCaptchaClient(captchaState);

  const verified = captchaState.dragDistanceRatio >= 0.45
    && captchaState.dragDurationMs >= 400
    && captchaState.dragDurationMs <= 6000
    && captchaState.reactionTimeMs >= 250
    && !captchaState.honeypotTriggered;

  captchaState.verified = verified;
  loginBtn.disabled = !verified;

  if (verified) {
    setCaptchaStatus("Verification complete.", "success");
    triggerHaptic("captcha");
    lockCaptcha();
  } else {
    setCaptchaStatus("Please try the slider again.", "error");
    resetCaptchaHandle();
  }

  captchaState.dragStartAt = null;
  captchaState.dragStartX = null;
  captchaState.lastX = null;
  captchaState.lastT = null;
  captchaState.lastDx = null;
}

function updateHandlePosition(pointX) {
  const trackRect = captchaTrack.getBoundingClientRect();
  const handleRect = captchaHandle.getBoundingClientRect();
  const handleOffset = handleRect.width / 2;
  const maxPosition = Math.max(0, trackRect.width - handleRect.width - 6);
  const raw = pointX - trackRect.left - handleOffset;
  const clamped = clamp(raw, 0, maxPosition);
  const ratio = maxPosition > 0 ? clamped / maxPosition : 0;

  captchaHandle.style.transform = `translateX(${clamped}px)`;
  captchaProgress.style.width = `${ratio * 100}%`;
  captchaHandle.setAttribute("aria-valuenow", Math.round(ratio * 100));

  return { position: clamped, ratio };
}

function resetCaptchaHandle() {
  captchaHandle.style.transform = "translateX(0px)";
  captchaProgress.style.width = "0%";
  captchaHandle.setAttribute("aria-valuenow", "0");
  captchaState.currentPosition = 0;
  captchaState.dragDistanceRatio = 0;
  captchaState.dragDistance = 0;
}

function lockCaptcha() {
  captchaState.active = false;
  captchaState.verified = true;
  captchaEl.classList.add("captcha--verified");
  captchaHandle.style.pointerEvents = "none";
  setHandleRatio(1);
}

function setHandleRatio(ratio) {
  const trackRect = captchaTrack.getBoundingClientRect();
  const handleRect = captchaHandle.getBoundingClientRect();
  const maxPosition = Math.max(0, trackRect.width - handleRect.width - 6);
  const clampedRatio = clamp(ratio, 0, 1);
  const position = clampedRatio * maxPosition;
  captchaHandle.style.transform = `translateX(${position}px)`;
  captchaProgress.style.width = `${clampedRatio * 100}%`;
  captchaHandle.setAttribute("aria-valuenow", Math.round(clampedRatio * 100));
}

function buildCaptchaPayload() {
  return {
    verified: captchaState.verified,
    dragDurationMs: captchaState.dragDurationMs,
    mouseSpeedVariance: Number(captchaState.mouseSpeedVariance.toFixed(6)),
    numberOfCorrections: captchaState.numberOfCorrections,
    reactionTimeMs: captchaState.reactionTimeMs,
    honeypotTriggered: captchaState.honeypotTriggered,
    dragDistanceRatio: Number(captchaState.dragDistanceRatio.toFixed(3)),
    activationDelayMs: captchaState.activationDelayMs,
    earlyAttempt: captchaState.earlyAttempt,
    attempts: captchaState.attempts,
    clientScore: captchaState.clientScore
  };
}

function scoreCaptchaClient(metrics) {
  let score = 0;
  if (metrics.honeypotTriggered) score += 1;
  if (metrics.reactionTimeMs !== null && metrics.reactionTimeMs < 250) score += 0.35;
  if (metrics.dragDurationMs && metrics.dragDurationMs < 350) score += 0.35;
  if (metrics.dragDurationMs && metrics.dragDurationMs > 6000) score += 0.2;
  if (metrics.mouseSpeedVariance !== null && metrics.mouseSpeedVariance < 0.002) score += 0.25;
  if (metrics.numberOfCorrections === 0) score += 0.1;
  if (metrics.dragDistanceRatio < 0.45) score += 0.25;
  if (metrics.earlyAttempt) score += 0.2;
  return clamp(score, 0, 1);
}

function computeVariance(values) {
  if (!values || values.length === 0) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return variance;
}

function getClientX(event) {
  if (event.touches && event.touches[0]) {
    return event.touches[0].clientX;
  }
  return event.clientX;
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

function initBotRunner() {
  if (!runBotsBtn) return;

  initializeBotRunnerUi();

  runBotsBtn.addEventListener("click", async () => {
    runBotsBtn.disabled = true;
    setStatus("Launching bot tests...", "", "Bots will attempt login shortly. Check admin logs.");
    startBotLogPolling();

    try {
      const response = await fetch("/api/run-bots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "ui" })
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = result?.message || "Bot test could not start.";
        const reason = result?.reason || "This action may be disabled in production.";
        setStatus(message, "danger", reason);
        stopBotLogPolling();
      } else {
        setStatus("Bot tests started.", "success", "They should appear in admin logs within a few seconds.");
      }
    } catch (error) {
      setStatus("Bot test failed to start.", "danger", "Please check the server logs.");
      console.error(error);
      stopBotLogPolling();
    } finally {
      runBotsBtn.disabled = false;
    }
  });
}

async function initializeBotRunnerUi() {
  if (!runBotsBtn) return;
  try {
    const response = await fetch("/api/bot-status");
    if (!response.ok) {
      hideBotRunnerUi();
      return;
    }
    const data = await response.json();
    if (!data?.allowed) {
      hideBotRunnerUi();
    }
  } catch (error) {
    hideBotRunnerUi();
  }
}

function hideBotRunnerUi() {
  if (runBotsBtn) {
    runBotsBtn.style.display = "none";
  }
  if (botLogEl) {
    botLogEl.classList.remove("bot-log--visible");
    botLogEl.style.display = "none";
  }
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

function startBotLogPolling() {
  if (!botLogEl || !botLogStatusEl || !botLogLinesEl) return;
  botLogEl.classList.add("bot-log--visible");
  if (botLogTimer) clearInterval(botLogTimer);
  pollBotStatus();
  botLogTimer = window.setInterval(pollBotStatus, 1200);
}

function stopBotLogPolling() {
  if (botLogTimer) {
    clearInterval(botLogTimer);
    botLogTimer = null;
  }
}

async function pollBotStatus() {
  try {
    const response = await fetch("/api/bot-status");
    if (!response.ok) {
      updateBotLog({ status: "unavailable", logs: ["Bot status unavailable."] });
      stopBotLogPolling();
      return;
    }
    const data = await response.json();
    if (data?.allowed === false) {
      hideBotRunnerUi();
      stopBotLogPolling();
      return;
    }
    updateBotLog(data);
    if (data.status && data.status !== "running") {
      stopBotLogPolling();
    }
  } catch (error) {
    updateBotLog({ status: "error", logs: ["Unable to load bot status."] });
    stopBotLogPolling();
  }
}

function updateBotLog(data) {
  if (!botLogEl || !botLogStatusEl || !botLogLinesEl) return;
  const status = data?.status || "idle";
  botLogStatusEl.textContent = formatBotStatus(status);
  const lines = Array.isArray(data?.logs) ? data.logs : [];
  botLogLinesEl.innerHTML = "";
  lines.slice(-6).forEach((line) => {
    const entry = document.createElement("div");
    entry.className = "bot-log__line";
    entry.textContent = line;
    botLogLinesEl.appendChild(entry);
  });
}

function formatBotStatus(status) {
  if (status === "running") return "Running bot tests...";
  if (status === "completed") return "Bot tests completed.";
  if (status === "failed") return "Bot tests failed.";
  if (status === "unavailable") return "Bot status unavailable.";
  if (status === "error") return "Bot status error.";
  return "Idle";
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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
