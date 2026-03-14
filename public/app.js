const API_BASE = "/api";
const DEFAULT_USER_ID = "demo-user-1";
const DEFAULT_MODE = "full";

let selectedMode = DEFAULT_MODE;
let currentDecisionId = null;
let selectedCategory = "";

const el = {
  title: document.getElementById("title"),
  situation: document.getElementById("situation"),
  analyzeBtn: document.getElementById("analyzeBtn"),
  statusBox: document.getElementById("statusBox"),
  resultSection: document.getElementById("resultSection"),
  resultMeta: document.getElementById("resultMeta"),
  resultOutput: document.getElementById("resultOutput"),
  resultSignal: document.getElementById("resultSignal"),
  decisionList: document.getElementById("decisionList"),
  followupSection: document.getElementById("followupSection"),
  followupOutcome: document.getElementById("followupOutcome"),
  followupNotes: document.getElementById("followupNotes"),
  saveFollowupBtn: document.getElementById("saveFollowupBtn"),
  newUserBtn: document.getElementById("newUserBtn"),
  unlockProBtn: document.getElementById("unlockProBtn"),
  paywallBox: document.getElementById("paywallBox"),
  paywallUnlockBtn: document.getElementById("paywallUnlockBtn"),
  loader: document.getElementById("analysisLoader"),
  stepCategory: document.getElementById("stepCategory"),
  stepRisk: document.getElementById("stepRisk"),
  stepPattern: document.getElementById("stepPattern"),
  stepMode: document.getElementById("stepMode"),
  modeButtons: Array.from(document.querySelectorAll(".mode-btn")),
  navPlus: document.querySelector(".nav-plus")
};

function getUserId() {
  let userId = localStorage.getItem("stan_user_id");
  if (!userId) {
    userId = DEFAULT_USER_ID;
    localStorage.setItem("stan_user_id", userId);
  }
  return userId;
}

function setStatus(message) {
  if (el.statusBox) {
    el.statusBox.textContent = message;
  }
}

function setCategory(category) {
  selectedCategory = category || "";
  if (el.title && !el.title.value.trim() && selectedCategory) {
    el.title.value =
      selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1);
  }
}

function setMode(mode) {
  selectedMode = mode || DEFAULT_MODE;

  el.modeButtons.forEach((button) => {
    const isActive = button.dataset.mode === selectedMode;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

function formatDate(dateString) {
  if (!dateString) return "brak daty";

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "brak daty";

  return date.toLocaleString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function signalLabel(signal) {
  return signal || "—";
}

function outcomeLabel(value) {
  if (value === "good") return "Wyszło dobrze";
  if (value === "mixed") return "Mieszanie / średnio";
  if (value === "bad") return "Wyszło źle";
  return "Brak follow-upu";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function nl2brSafe(value) {
  return escapeHtml(value).replace(/\n/g, "<br>");
}

function buildResultHtml(analysis) {
  const text = String(analysis || "").trim();
  if (!text) {
    return `
      <div>
        <strong>Insight</strong><br>
        Brak analizy.
      </div>
    `;
  }

  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length >= 3) {
    const [first, second, third, ...rest] = lines;

    return `
      <div>
        <strong>Insight</strong><br>
        ${escapeHtml(first)}
      </div>
      <div>
        <strong>Pytanie</strong><br>
        ${escapeHtml(second)}
      </div>
      <div>
        <strong>Mały krok</strong><br>
        ${escapeHtml(third)}
      </div>
      ${
        rest.length
          ? `<div>${nl2brSafe(rest.join("\n"))}</div>`
          : ""
      }
    `;
  }

  return `
    <div>
      <strong>Insight</strong><br>
      ${nl2brSafe(text)}
    </div>
  `;
}

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json"
    },
    ...options
  });

  let data;
  try {
    data = await response.json();
  } catch (_error) {
    throw new Error("Serwer zwrócił nieprawidłową odpowiedź.");
  }

  if (!response.ok) {
    throw new Error(data.error || "Wystąpił błąd.");
  }

  return data;
}

function showLoader() {
  if (el.loader) el.loader.classList.remove("hidden");
  if (el.resultSection) el.resultSection.classList.add("hidden");

  if (el.stepCategory) {
    el.stepCategory.textContent = "○ Kategoria";
    el.stepCategory.classList.remove("done");
  }
  if (el.stepRisk) {
    el.stepRisk.textContent = "○ Ryzyko";
    el.stepRisk.classList.remove("done");
  }
  if (el.stepPattern) {
    el.stepPattern.textContent = "○ Wzorzec";
    el.stepPattern.classList.remove("done");
  }
  if (el.stepMode) {
    el.stepMode.textContent = "○ Tryb odpowiedzi";
    el.stepMode.classList.remove("done");
  }
}

function hideLoader() {
  if (el.loader) el.loader.classList.add("hidden");
}

function animateRouter(router) {
  return new Promise((resolve) => {
    const steps = [
      () => {
        if (el.stepCategory) {
          el.stepCategory.textContent = `✓ Kategoria: ${router?.category || "mixed"}`;
          el.stepCategory.classList.add("done");
        }
      },
      () => {
        if (el.stepRisk) {
          el.stepRisk.textContent = `✓ Ryzyko: ${router?.risk || "medium"}`;
          el.stepRisk.classList.add("done");
        }
      },
      () =>