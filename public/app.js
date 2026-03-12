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
  modeButtons: Array.from(document.querySelectorAll(".mode-btn"))
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
  if (el.statusBox) el.statusBox.textContent = message;
}

function setCategory(category) {
  selectedCategory = category;
  if (!el.title.value.trim()) {
    el.title.value = category.charAt(0).toUpperCase() + category.slice(1);
  }
}

function setMode(mode) {
  selectedMode = mode;
  el.modeButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === mode);
  });
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleString("pl-PL", {
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

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Wystąpił błąd.");
  }

  return data;
}

function showLoader() {
  el.loader.classList.remove("hidden");
  el.stepCategory.textContent = "○ Kategoria";
  el.stepRisk.textContent = "○ Ryzyko";
  el.stepPattern.textContent = "○ Wzorzec";
  el.stepMode.textContent = "○ Tryb odpowiedzi";
  el.stepCategory.classList.remove("done");
  el.stepRisk.classList.remove("done");
  el.stepPattern.classList.remove("done");
  el.stepMode.classList.remove("done");
}

function hideLoader() {
  el.loader.classList.add("hidden");
}

function animateRouter(router) {
  return new Promise((resolve) => {
    const steps = [
      () => {
        el.stepCategory.textContent = `✓ Kategoria: ${router?.category || "mixed"}`;
        el.stepCategory.classList.add("done");
      },
      () => {
        el.stepRisk.textContent = `✓ Ryzyko: ${router?.risk || "medium"}`;
        el.stepRisk.classList.add("done");
      },
      () => {
        el.stepPattern.textContent = `✓ Wzorzec: ${router?.reasoningHint || "analiza sytuacji"}`;
        el.stepPattern.classList.add("done");
      },
      () => {
        el.stepMode.textContent = `✓ Tryb: ${router?.recommendedMode || selectedMode}`;
        el.stepMode.classList.add("done");
      }
    ];

    let i = 0;
    const interval = setInterval(() => {
      steps[i]();
      i += 1;
      if (i === steps.length) {
        clearInterval(interval);
        setTimeout(resolve, 250);
      }
    }, 220);
  });
}

function renderDecisionList(decisions) {
  if (!decisions.length) {
    el.decisionList.innerHTML = `<div class="decision-item-meta">Brak zapisanych decyzji.</div>`;
    return;
  }

  el.decisionList.innerHTML = decisions.map((decision) => `
    <button class="decision-item" data-decision-id="${decision.id}" type="button">
      <div class="decision-item-title">${escapeHtml(decision.title || "Bez tytułu")}</div>
      <div class="decision-item-meta">${escapeHtml(signalLabel(decision.signal))}</div>
      <div class="decision-item-meta">${escapeHtml(formatDate(decision.createdAt))}</div>
      <div class="decision-item-meta">${escapeHtml(outcomeLabel(decision.followup?.outcome))}</div>
    </button>
  `).join("");

  document.querySelectorAll("[data-decision-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      await loadDecision(button.dataset.decisionId);
    });
  });
}

function renderDecision(decision) {
  currentDecisionId = decision.id;
  el.resultSection.classList.remove("hidden");
  el.followupSection.classList.remove("hidden");
  el.resultMeta.textContent = `${decision.mode.toUpperCase()} · ${formatDate(decision.createdAt)}`;
  el.resultOutput.textContent = decision.analysis;
  el.resultSignal.textContent = decision.signal || "—";
  el.title.value = decision.title || "";
  el.situation.value = decision.situation || "";
  el.followupOutcome.value = decision.followup?.outcome || "";
  el.followupNotes.value = decision.followup?.notes || "";
  setMode(decision.mode || DEFAULT_MODE);
}

async function refreshDashboard() {
  const userId = getUserId();
  const data = await api(`/user?userId=${encodeURIComponent(userId)}`);
  renderDecisionList(data.decisions);
}

async function loadDecision(decisionId) {
  const userId = getUserId();
  const data = await api(`/decision?userId=${encodeURIComponent(userId)}&decisionId=${encodeURIComponent(decisionId)}`);
  renderDecision(data.decision);
  await refreshDashboard();
}

async function analyze() {
  const title = el.title.value.trim();
  const situation = el.situation.value.trim();

  if (!situation) {
    setStatus("Najpierw opisz sytuację.");
    return;
  }

  setStatus("STAN analizuje...");
  el.paywallBox.classList.add("hidden");
  showLoader();

  try {
    const userId = getUserId();
    const fullSituation = selectedCategory
      ? `Kategoria użytkownika: ${selectedCategory}\n\n${situation}`
      : situation;

    const data = await api("/analyze", {
      method: "POST",
      body: JSON.stringify({
        userId,
        title,
        situation: fullSituation,
        mode: selectedMode
      })
    });

    await animateRouter(data.router || null);
    hideLoader();

    currentDecisionId = data.decision.id;
    renderDecision(data.decision);
    await refreshDashboard();
    setStatus("Analiza gotowa.");
  } catch (error) {
    hideLoader();
    if (error.message === "FREE_LIMIT_REACHED") {
      el.paywallBox.classList.remove("hidden");
      setStatus("FREE limit osiągnięty. Odblokuj PRO demo.");
      return;
    }
    setStatus(error.message || "Coś poszło nie tak.");
  }
}

async function saveFollowup() {
  if (!currentDecisionId) {
    setStatus("Najpierw zapisz analizę decyzji.");
    return;
  }

  const outcome = el.followupOutcome.value;
  const notes = el.followupNotes.value.trim();

  if (!outcome) {
    setStatus("Wybierz ocenę follow-upu.");
    return;
  }

  try {
    const userId = getUserId();
    const data = await api("/followup", {
      method: "POST",
      body: JSON.stringify({ userId, decisionId: currentDecisionId, outcome, notes })
    });

    renderDecision(data.decision);
    await refreshDashboard();
    setStatus("Follow-up zapisany.");
  } catch (error) {
    setStatus(error.message || "Nie udało się zapisać follow-upu.");
  }
}

async function unlockPro() {
  try {
    const userId = getUserId();
    await api("/plan", {
      method: "POST",
      body: JSON.stringify({ userId, plan: "pro" })
    });
    el.paywallBox.classList.add("hidden");
    setStatus("PRO demo odblokowane.");
  } catch (error) {
    setStatus(error.message || "Nie udało się odblokować PRO demo.");
  }
}

async function createNewDemoUser() {
  try {
    const data = await api("/user", { method: "POST" });
    localStorage.setItem("stan_user_id", data.user.id);
    currentDecisionId = null;
    el.resultSection.classList.add("hidden");
    el.followupSection.classList.add("hidden");
    el.paywallBox.classList.add("hidden");
    el.title.value = "";
    el.situation.value = "";
    el.followupOutcome.value = "";
    el.followupNotes.value = "";
    selectedCategory = "";
    await refreshDashboard();
    setStatus("Utworzono nowego użytkownika demo.");
  } catch (error) {
    setStatus(error.message || "Nie udało się utworzyć użytkownika demo.");
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

window.setCategory = setCategory;

el.modeButtons.forEach((button) => {
  button.addEventListener("click", () => setMode(button.dataset.mode));
});

el.analyzeBtn.addEventListener("click", analyze);
el.saveFollowupBtn.addEventListener("click", saveFollowup);
el.newUserBtn.addEventListener("click", createNewDemoUser);
el.unlockProBtn.addEventListener("click", unlockPro);
el.paywallUnlockBtn.addEventListener("click", unlockPro);

(async function init() {
  try {
    setMode(DEFAULT_MODE);
    await refreshDashboard();
    setStatus("Gotowe.");
  } catch (error) {
    setStatus(error.message || "Nie udało się załadować danych demo.");
  }
})();
