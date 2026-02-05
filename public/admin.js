const statsEl = document.getElementById("stats");
const logBody = document.getElementById("log-body");
const acceptedCountEl = document.getElementById("accepted-count");
const rejectedCountEl = document.getElementById("rejected-count");
const totalCountEl = document.getElementById("total-count");
const acceptedRateEl = document.getElementById("accepted-rate");
const rejectedRateEl = document.getElementById("rejected-rate");
const acceptedBarEl = document.getElementById("accepted-bar");
const rejectedBarEl = document.getElementById("rejected-bar");

fetch("/api/logs")
  .then((res) => res.json())
  .then((data) => {
    const entries = Array.isArray(data.entries) ? data.entries : [];
    const counts = data.counts || { accepted: 0, rejected: 0 };
    const total = (counts.accepted || 0) + (counts.rejected || 0);
    const acceptedPct = total ? Math.round((counts.accepted / total) * 100) : 0;
    const rejectedPct = total ? 100 - acceptedPct : 0;

    if (acceptedCountEl) acceptedCountEl.textContent = counts.accepted;
    if (rejectedCountEl) rejectedCountEl.textContent = counts.rejected;
    if (totalCountEl) totalCountEl.textContent = total;
    if (acceptedRateEl) acceptedRateEl.textContent = total ? `${acceptedPct}% of total` : "No attempts yet";
    if (rejectedRateEl) rejectedRateEl.textContent = total ? `${rejectedPct}% of total` : "No attempts yet";
    if (acceptedBarEl) acceptedBarEl.style.width = `${acceptedPct}%`;
    if (rejectedBarEl) rejectedBarEl.style.width = `${rejectedPct}%`;

    statsEl.textContent = total ? `Total attempts: ${total}` : "No attempts yet.";

    logBody.innerHTML = "";
    entries
      .slice()
      .reverse()
      .forEach((entry) => {
        const row = document.createElement("tr");
        if (entry.decision === "ACCEPTED") {
          row.classList.add("row--accepted");
        } else if (entry.decision === "REJECTED") {
          row.classList.add("row--rejected");
        }
        row.appendChild(buildCell(entry.timestamp));
        row.appendChild(buildCell(entry.username));
        row.appendChild(buildDecisionCell(entry.decision));
        const reasonSummary = entry.reasonSummary || entry.reason || "—";
        row.appendChild(buildCell(reasonSummary));
        row.appendChild(buildScoreCell(entry.aiScore, "ai"));
        row.appendChild(buildScoreCell(entry.behaviorScore, "behavior"));
        row.appendChild(buildScoreCell(entry.captchaScore, "captcha"));
        const flags = normalizeAutomationFlags(entry) || "—";
        row.appendChild(buildCell(flags, "cell--wrap"));
        logBody.appendChild(row);
      });
  })
  .catch((error) => {
    statsEl.textContent = "Failed to load logs.";
    console.error(error);
  });

function buildCell(value, className) {
  const cell = document.createElement("td");
  if (className) cell.className = className;
  cell.textContent = value ? String(value) : "";
  return cell;
}

function buildDecisionCell(decision) {
  const cell = document.createElement("td");
  const badge = document.createElement("span");
  const normalized = decision === "ACCEPTED" ? "ACCEPTED" : "REJECTED";
  badge.className = `badge ${normalized === "ACCEPTED" ? "badge--accepted" : "badge--rejected"}`;
  badge.textContent = normalized;
  cell.appendChild(badge);
  return cell;
}

function buildScoreCell(value, variant) {
  const cell = document.createElement("td");
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    cell.textContent = "—";
    return cell;
  }

  const score = Math.max(0, Math.min(1, parsed));
  const percent = Math.round(score * 100);
  const wrapper = document.createElement("div");
  wrapper.className = "score";

  const scoreValue = document.createElement("div");
  scoreValue.className = "score__value";
  scoreValue.textContent = score.toFixed(2);

  const bar = document.createElement("div");
  bar.className = `score__bar${variant ? ` score__bar--${variant}` : ""}`;

  const fill = document.createElement("span");
  fill.style.width = `${percent}%`;
  bar.appendChild(fill);

  wrapper.appendChild(scoreValue);
  wrapper.appendChild(bar);
  cell.appendChild(wrapper);
  return cell;
}

function normalizeAutomationFlags(entry) {
  if (entry.automationFlags) return entry.automationFlags;
  const flags = [];

  if (entry.botDetectDecision === "bot") flags.push("bot-detect");

  const botSignals = Number.parseInt(entry.botSignalCount, 10);
  if (Number.isFinite(botSignals) && botSignals > 0) {
    flags.push(`bot signals ${botSignals}`);
  }

  if (entry.webdriver === "true") flags.push("webdriver");
  if (entry.headlessUA === "true") flags.push("headless UA");
  if (entry.pluginsLength === "0") flags.push("no plugins");
  if (entry.languagesLength === "0") flags.push("no languages");

  return flags.join("; ");
}
