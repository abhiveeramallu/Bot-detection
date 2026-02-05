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
    captchaDragDurationMs: captcha?.dragDurationMs ?? null,
    captchaMouseSpeedVariance: captcha?.mouseSpeedVariance ?? null,
    captchaCorrections: captcha?.numberOfCorrections ?? null,
    captchaReactionTimeMs: captcha?.reactionTimeMs ?? null,
    captchaHoneypotTriggered: captcha?.honeypotTriggered ?? null,
    captchaDragDistanceRatio: captcha?.dragDistanceRatio ?? null,
    captchaActivationDelayMs: captcha?.activationDelayMs ?? null,
    captchaEarlyAttempt: captcha?.earlyAttempt ?? null,
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
  // Server-side behavioral CAPTCHA scoring (not position-based).
  let score = 0;
  const reasons = [];

  const hasMetrics = typeof captcha.dragDurationMs === "number"
    || typeof captcha.reactionTimeMs === "number"
    || typeof captcha.mouseSpeedVariance === "number";

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

  if (captcha.earlyAttempt) {
    score += 0.2;
    reasons.push("captcha interacted before activation");
  }

  if (typeof captcha.reactionTimeMs === "number") {
    if (captcha.reactionTimeMs < 220) {
      score += 0.35;
      reasons.push(`reaction time too fast (${captcha.reactionTimeMs}ms)`);
    }
  }

  if (typeof captcha.dragDurationMs === "number") {
    if (captcha.dragDurationMs < 350) {
      score += 0.4;
      reasons.push(`drag too fast (${captcha.dragDurationMs}ms)`);
    }
    if (captcha.dragDurationMs > 6000) {
      score += 0.25;
      reasons.push(`drag too slow (${captcha.dragDurationMs}ms)`);
    }
  }

  const varianceLow = typeof captcha.mouseSpeedVariance === "number" && captcha.mouseSpeedVariance < 0.002;
  const noCorrections = typeof captcha.numberOfCorrections === "number" && captcha.numberOfCorrections === 0;
  const fastDrag = typeof captcha.dragDurationMs === "number" && captcha.dragDurationMs < 1200;

  if (varianceLow && noCorrections && fastDrag) {
    score += 0.6;
    reasons.push(`robotic drag pattern (variance ${captcha.mouseSpeedVariance.toFixed(4)}, corrections 0)`);
  } else {
    if (varianceLow) {
      score += 0.35;
      reasons.push(`mouse speed variance very low (${captcha.mouseSpeedVariance.toFixed(4)})`);
    }
    if (noCorrections) {
      score += 0.15;
      reasons.push("no drag corrections detected");
    }
  }

  if (typeof captcha.dragDistanceRatio === "number" && captcha.dragDistanceRatio < 0.45) {
    score += 0.35;
    reasons.push(`drag distance too short (${captcha.dragDistanceRatio})`);
  }

  if (captcha.verified === false) {
    score += 0.1;
    reasons.push("client verification not completed");
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
    dragDurationMs: captcha.dragDurationMs ?? null,
    mouseSpeedVariance: captcha.mouseSpeedVariance ?? null,
    numberOfCorrections: captcha.numberOfCorrections ?? null,
    reactionTimeMs: captcha.reactionTimeMs ?? null,
    honeypotTriggered: captcha.honeypotTriggered ?? null,
    dragDistanceRatio: captcha.dragDistanceRatio ?? null,
    activationDelayMs: captcha.activationDelayMs ?? null,
    earlyAttempt: captcha.earlyAttempt ?? null,
    verified: captcha.verified ?? null
  };
}
