const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// Lightweight, rule-based scoring that can be swapped for ML/DL later.
// Inputs are privacy-friendly and derived from client behavior + bot-detect signals.
function scoreAttempt({
  botDetectDecision,
  botSignalCount,
  automationSignals,
  captcha,
  trapClicked,
  timingMs,
  mouseMoveCount,
  keystrokeCount,
  typingDurationMs
}) {
  let automationRisk = 0;
  let behaviorRisk = 0;
  const reasons = [];
  const captchaScoring = scoreCaptcha(captcha);

  if (trapClicked) {
    return {
      score: 1,
      automationScore: 1,
      behaviorScore: 0,
      captchaScore: captchaScoring.score,
      captchaReasons: captchaScoring.reasons,
      reasons: ["Trap clicked"],
      features: buildFeatures({
        botDetectDecision,
        botSignalCount,
        automationSignals,
        captcha: captchaScoring.features,
        trapClicked,
        timingMs,
        mouseMoveCount,
        keystrokeCount,
        typingDurationMs
      })
    };
  }

  if (botDetectDecision === "bot") {
    automationRisk += 0.7;
    reasons.push("bot-detect flagged automation");
  }

  if (typeof botSignalCount === "number" && botSignalCount > 0) {
    automationRisk += Math.min(0.2, botSignalCount * 0.05);
    reasons.push(`automation signals present (count ${botSignalCount})`);
  }

  if (automationSignals?.webdriver === true) {
    automationRisk += 0.6;
    reasons.push("navigator.webdriver=true");
  }

  if (automationSignals?.headlessUA === true) {
    automationRisk += 0.5;
    reasons.push("headless user agent detected");
  }

  if (automationSignals?.pluginsLength === 0) {
    automationRisk += 0.05;
    reasons.push("pluginsLength=0");
  }

  if (automationSignals?.languagesLength === 0) {
    automationRisk += 0.05;
    reasons.push("languagesLength=0");
  }

  const timeToFirstClick = timingMs?.timeToFirstClickMs;
  if (typeof timeToFirstClick === "number" && timeToFirstClick >= 0) {
    if (timeToFirstClick < 300) {
      behaviorRisk += 0.15;
      reasons.push(`first click very fast (${timeToFirstClick}ms)`);
    }
  }

  const timeToSubmit = timingMs?.timeToSubmitMs;
  if (typeof timeToSubmit === "number" && timeToSubmit >= 0) {
    if (timeToSubmit < 800) {
      behaviorRisk += 0.25;
      reasons.push(`form submitted very fast (${timeToSubmit}ms)`);
    }
  }

  if (typeof mouseMoveCount === "number") {
    if (mouseMoveCount < 2) {
      behaviorRisk += 0.1;
      reasons.push(`mouse movement low (${mouseMoveCount})`);
    }
  }

  if (typeof keystrokeCount === "number" && typeof typingDurationMs === "number") {
    const typingSeconds = typingDurationMs / 1000;
    if (typingSeconds > 0) {
      const cps = keystrokeCount / typingSeconds;
      if (cps > 12) {
        behaviorRisk += 0.15;
        reasons.push(`typing speed high (${cps.toFixed(1)} cps)`);
      }
    }
  }

  const totalRisk = automationRisk + behaviorRisk + captchaScoring.score * 0.6;

  return {
    score: clamp(totalRisk, 0, 1),
    automationScore: clamp(automationRisk, 0, 1),
    behaviorScore: clamp(behaviorRisk, 0, 1),
    captchaScore: captchaScoring.score,
    captchaReasons: captchaScoring.reasons,
    reasons,
    features: buildFeatures({
      botDetectDecision,
      botSignalCount,
      automationSignals,
      captcha: captchaScoring.features,
      trapClicked,
      timingMs,
      mouseMoveCount,
      keystrokeCount,
      typingDurationMs
    })
  };
}

function buildFeatures({
  botDetectDecision,
  botSignalCount,
  automationSignals,
  captcha,
  trapClicked,
  timingMs,
  mouseMoveCount,
  keystrokeCount,
  typingDurationMs
}) {
  const typingSeconds = typeof typingDurationMs === "number" ? typingDurationMs / 1000 : null;
  const typingCps = typingSeconds && typingSeconds > 0 && typeof keystrokeCount === "number"
    ? Number((keystrokeCount / typingSeconds).toFixed(2))
    : null;

  return {
    botDetectDecision,
    botSignalCount,
    webdriver: automationSignals?.webdriver ?? null,
    headlessUA: automationSignals?.headlessUA ?? null,
    pluginsLength: automationSignals?.pluginsLength ?? null,
    languagesLength: automationSignals?.languagesLength ?? null,
    captchaScore: captcha?.score ?? null,
    captchaChallengeType: captcha?.challengeType ?? null,
    captchaTimeToSolveMs: captcha?.timeToSolveMs ?? null,
    captchaAttempts: captcha?.attempts ?? null,
    captchaHoneypotTriggered: captcha?.honeypotTriggered ?? null,
    captchaActivationDelayMs: captcha?.activationDelayMs ?? null,
    captchaVerifiedClient: captcha?.verified ?? null,
    trapClicked: Boolean(trapClicked),
    timeToFirstClickMs: timingMs?.timeToFirstClickMs ?? null,
    timeToSubmitMs: timingMs?.timeToSubmitMs ?? null,
    mouseMoveCount: mouseMoveCount ?? null,
    keystrokeCount: keystrokeCount ?? null,
    typingDurationMs: typingDurationMs ?? null,
    typingCps
  };
}

module.exports = {
  scoreAttempt
};

function scoreCaptcha(captcha = {}) {
  // Server-side CAPTCHA scoring (randomized text challenge).
  let score = 0;
  const reasons = [];

  const hasMetrics = typeof captcha.timeToSolveMs === "number"
    || typeof captcha.userAnswer === "string"
    || typeof captcha.answer === "string";

  if (!hasMetrics) {
    return {
      score: 0.85,
      reasons: ["captcha metrics missing"],
      features: buildCaptchaFeatures(captcha, 0.85)
    };
  }

  if (captcha.honeypotTriggered) {
    return {
      score: 1,
      reasons: ["captcha honeypot triggered"],
      features: buildCaptchaFeatures(captcha, 1)
    };
  }

  const answer = normalizeAnswer(captcha.answer);
  const userAnswer = normalizeAnswer(captcha.userAnswer);

  if (!captcha.verified) {
    score += 0.7;
    reasons.push("captcha not verified");
  } else if (answer && userAnswer && answer !== userAnswer) {
    score += 0.7;
    reasons.push("captcha answer mismatch");
  }

  if (typeof captcha.timeToSolveMs === "number") {
    if (captcha.timeToSolveMs < 400) {
      score += 0.25;
      reasons.push(`captcha solved too fast (${captcha.timeToSolveMs}ms)`);
    }
    if (captcha.timeToSolveMs > 20000) {
      score += 0.2;
      reasons.push(`captcha solved too slow (${captcha.timeToSolveMs}ms)`);
    }
  }

  if (typeof captcha.attempts === "number" && captcha.attempts > 2) {
    score += 0.2;
    reasons.push(`captcha retries high (${captcha.attempts})`);
  }

  return {
    score: clamp(score, 0, 1),
    reasons,
    features: buildCaptchaFeatures(captcha, clamp(score, 0, 1))
  };
}

function buildCaptchaFeatures(captcha, score) {
  return {
    score,
    challengeType: captcha.type ?? null,
    timeToSolveMs: captcha.timeToSolveMs ?? null,
    attempts: captcha.attempts ?? null,
    honeypotTriggered: captcha.honeypotTriggered ?? null,
    activationDelayMs: captcha.activationDelayMs ?? null,
    verified: captcha.verified ?? null
  };
}

function normalizeAnswer(value) {
  return String(value || "").trim().toLowerCase();
}
