const path = require("path");
const express = require("express");

const { scoreAttempt } = require("./aiScoring");
const { appendLog, readLogs } = require("./logger");

const app = express();
const SCORE_THRESHOLD = 0.6;
const CAPTCHA_THRESHOLD = 0.6;

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/login", (req, res) => {
  const payload = req.body || {};
  const username = sanitizeUsername(payload.username);

  const botDetectDecision = normalizeBotDetectDecision(payload.botDetect?.decision ?? payload.botDetectDecision);
  const botSignals = Array.isArray(payload.botDetect?.results)
    ? payload.botDetect.results
    : Array.isArray(payload.botDetectResults)
      ? payload.botDetectResults
      : [];

  const botSignalCount = countBotSignals(botSignals);
  const botDetectFlags = summarizeBotDetect(botSignals);

  const timingMs = payload.behavior?.timingMs || {};
  const mouseMoveCount = payload.behavior?.mouseMoveCount;
  const keystrokeCount = payload.behavior?.keystrokeCount;
  const typingDurationMs = payload.behavior?.typingDurationMs;
  const trapClicked = Boolean(payload.trapClicked);
  const automationSignals = payload.automationSignals || {};
  const captcha = payload.captcha || {};

  const scoring = scoreAttempt({
    botDetectDecision,
    botSignalCount,
    automationSignals,
    captcha,
    trapClicked,
    timingMs,
    mouseMoveCount,
    keystrokeCount,
    typingDurationMs
  });

  const decision = decide({
    trapClicked,
    botDetectDecision,
    score: scoring.score,
    captchaScore: scoring.captchaScore,
    captchaHoneypotTriggered: scoring.features.captchaHoneypotTriggered
  });

  const label = decision === "ACCEPTED" ? "Human" : "Bot";
  const reasonSummary = buildReasonSummary({
    trapClicked,
    botDetectDecision,
    botDetectFlags,
    captchaScore: scoring.captchaScore,
    captchaReasons: scoring.captchaReasons,
    captchaHoneypotTriggered: scoring.features.captchaHoneypotTriggered,
    scoreReasons: scoring.reasons,
    decision
  });

  const automationFlags = summarizeAutomationFlags({
    botDetectDecision,
    botSignalCount,
    automationSignals
  });

  const userFeedback = buildUserFeedback({
    decision,
    captchaVerified: Boolean(captcha?.verified),
    captchaHoneypotTriggered: Boolean(scoring.features.captchaHoneypotTriggered),
    trapClicked,
    botDetectDecision
  });

  const fingerprint = payload.fingerprint || {};

  try {
    appendLog({
      timestamp: new Date().toISOString(),
      username,
      decision,
      label,
      reason: reasonSummary,
      reasonSummary,
      aiScore: scoring.score.toFixed(2),
      captchaScore: scoring.captchaScore.toFixed(2),
      behaviorScore: scoring.behaviorScore.toFixed(2),
      automationScore: scoring.automationScore.toFixed(2),
      automationFlags: automationFlags.join("; "),
      botDetectDecision,
      botSignalCount,
      botDetectFlags: botDetectFlags.join("; "),
      captchaDragDurationMs: scoring.features.captchaDragDurationMs,
      captchaMouseSpeedVariance: scoring.features.captchaMouseSpeedVariance,
      captchaCorrections: scoring.features.captchaCorrections,
      captchaReactionTimeMs: scoring.features.captchaReactionTimeMs,
      captchaHoneypotTriggered: scoring.features.captchaHoneypotTriggered,
      captchaDragDistanceRatio: scoring.features.captchaDragDistanceRatio,
      captchaActivationDelayMs: scoring.features.captchaActivationDelayMs,
      captchaEarlyAttempt: scoring.features.captchaEarlyAttempt,
      captchaVerifiedClient: scoring.features.captchaVerifiedClient,
      trapClicked,
      timeToFirstClickMs: scoring.features.timeToFirstClickMs,
      timeToSubmitMs: scoring.features.timeToSubmitMs,
      mouseMoveCount: scoring.features.mouseMoveCount,
      keystrokeCount: scoring.features.keystrokeCount,
      typingDurationMs: scoring.features.typingDurationMs,
      typingCps: scoring.features.typingCps,
      webdriver: scoring.features.webdriver,
      headlessUA: scoring.features.headlessUA,
      pluginsLength: scoring.features.pluginsLength,
      languagesLength: scoring.features.languagesLength,
      userAgent: fingerprint.userAgent || "",
      platform: fingerprint.platform || "",
      language: fingerprint.language || "",
      timezone: fingerprint.timezone || ""
    });
  } catch (error) {
    console.error("Failed to write access log", error);
  }

  res.json({
    decision,
    userMessage: userFeedback.message,
    userReason: userFeedback.reason
  });
});

app.get("/api/logs", (req, res) => {
  try {
    const entries = readLogs();
    const accepted = entries.filter((entry) => entry.decision === "ACCEPTED").length;
    const rejected = entries.filter((entry) => entry.decision === "REJECTED").length;

    res.json({
      entries,
      counts: { accepted, rejected }
    });
  } catch (error) {
    console.error("Failed to read access logs", error);
    res.json({
      entries: [],
      counts: { accepted: 0, rejected: 0 }
    });
  }
});

module.exports = app;

function sanitizeUsername(username) {
  if (!username || typeof username !== "string") {
    return "anonymous";
  }
  return username.trim().slice(0, 64);
}

function normalizeBotDetectDecision(decision) {
  if (!decision) {
    return "unknown";
  }
  if (typeof decision === "string") {
    return decision.toLowerCase();
  }
  if (typeof decision === "boolean") {
    return decision ? "bot" : "human";
  }
  if (typeof decision === "object") {
    if (decision.bot === true) return "bot";
    if (decision.human === true) return "human";
    if (decision.result) return String(decision.result).toLowerCase();
  }
  return "unknown";
}

function countBotSignals(results) {
  if (!Array.isArray(results)) return 0;
  return results.reduce((count, item) => {
    if (!item) return count;
    if (item.bot === true || item.bot === "true") return count + 1;
    if (item.result === "bot" || item.state === "bot") return count + 1;
    if (typeof item.score === "number" && item.score >= 1) return count + 1;
    return count;
  }, 0);
}

function decide({ trapClicked, botDetectDecision, score, captchaScore, captchaHoneypotTriggered }) {
  if (trapClicked) return "REJECTED";
  if (captchaHoneypotTriggered) return "REJECTED";
  if (botDetectDecision === "bot") return "REJECTED";
  if (captchaScore >= CAPTCHA_THRESHOLD) return "REJECTED";
  if (score >= SCORE_THRESHOLD) return "REJECTED";
  return "ACCEPTED";
}

function buildReasonSummary({
  trapClicked,
  botDetectDecision,
  botDetectFlags,
  captchaScore,
  captchaReasons,
  captchaHoneypotTriggered,
  scoreReasons,
  decision
}) {
  if (trapClicked) return "Hidden trap interaction";
  if (captchaHoneypotTriggered) return "Hidden field triggered";
  const reasons = [];

  if (botDetectDecision === "bot") {
    if (botDetectFlags.length) {
      reasons.push(`bot-detect: ${botDetectFlags.join(", ")}`);
    } else {
      reasons.push("bot-detect flagged automation");
    }
  }

  if (decision === "REJECTED") {
    if (scoreReasons.length) {
      reasons.push(`AI signals: ${scoreReasons.join(", ")}`);
    } else {
      reasons.push("AI signals elevated");
    }
  }

  if (captchaScore >= CAPTCHA_THRESHOLD) {
    if (captchaReasons && captchaReasons.length) {
      reasons.push(`CAPTCHA: ${captchaReasons.join(", ")}`);
    } else {
      reasons.push("CAPTCHA anomalies detected");
    }
  }

  if (reasons.length) {
    return reasons.join(" | ");
  }
  return "Human-like behavior";
}

function buildUserFeedback({
  decision,
  captchaVerified,
  captchaHoneypotTriggered,
  trapClicked,
  botDetectDecision
}) {
  if (decision === "ACCEPTED") {
    return {
      message: "Verification successful.",
      reason: "Thanks for completing the human check."
    };
  }

  if (!captchaVerified || captchaHoneypotTriggered) {
    return {
      message: "We could not verify this attempt.",
      reason: "Please complete the slider verification and try again."
    };
  }

  if (trapClicked || botDetectDecision === "bot") {
    return {
      message: "We could not verify this attempt.",
      reason: "Please try again using a standard browser session."
    };
  }

  return {
    message: "We could not verify this attempt.",
    reason: "Please try again and interact naturally."
  };
}

function summarizeAutomationFlags({ botDetectDecision, botSignalCount, automationSignals }) {
  const flags = [];
  if (botDetectDecision === "bot") flags.push("bot-detect");
  if (typeof botSignalCount === "number" && botSignalCount > 0) {
    flags.push(`bot signals ${botSignalCount}`);
  }
  if (automationSignals?.webdriver === true) flags.push("webdriver");
  if (automationSignals?.headlessUA === true) flags.push("headless UA");
  if (automationSignals?.pluginsLength === 0) flags.push("no plugins");
  if (automationSignals?.languagesLength === 0) flags.push("no languages");
  return flags;
}

function summarizeBotDetect(results) {
  if (!Array.isArray(results)) return [];
  return results
    .filter((item) => {
      if (!item) return false;
      if (item.bot === true || item.bot === "true") return true;
      if (item.result === "bot" || item.state === "bot") return true;
      if (typeof item.score === "number" && item.score >= 1) return true;
      return false;
    })
    .map((item) => {
      const label = item.name || item.type || item.key || item.id || item.rule || item.title;
      if (label) {
        if (item.value !== undefined) return `${label}=${item.value}`;
        return String(label);
      }
      return JSON.stringify(item).slice(0, 80);
    });
}
