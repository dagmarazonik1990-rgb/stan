const API_BASE = "/api";
const DEFAULT_USER_ID = "demo-user-1";
const DEFAULT_MODE = "full";

let selectedMode = DEFAULT_MODE;
let currentDecisionId = null;

const el = {
  title: document.getElementById("title"),
  situation: document.getElementById("situation"),
  analyzeBtn: document.getElementById("analyzeBtn"),
  statusBox: document.getElementById("statusBox"),
  resultSection: document.getElementById("resultSection"),
  resultMeta: document.getElementById("resultMeta"),
  resultOutput: document.getElementById("resultOutput"),
  decisionList: document.getElementById("decisionList"),
  userSummary: document.getElementById("userSummary"),
  sidebarPlan: document.getElementById("sidebarPlan"),
  followupSection: document.getElementById("followupSection"),
  followupOutcome: document.getElementById("followupOutcome"),
  followupNotes: document.getElementById("followupNotes"),
  saveFollowupBtn: document.getElementById("saveFollowupBtn"),
  newUserBtn: document.getElementById("newUserBtn"),
  unlockProBtn: document.getElementById("unlockProBtn"),
  paywallBox: document.getElementById("paywallBox"),
  paywallUnlockBtn: document.getElementById("paywallUnlockBtn"),
  exportBtn: document.getElementById("exportBtn"),
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
  el.statusBox.textContent = message;
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
  if (!signal) return "Brak sygnału";
  return signal;
}

function outcomeLabel(value) {
  if (value === "good") return "Wyszło dobrze";
  if (value === "mixed") return "Mieszanie / średnio";
  if (value === "bad") return "Wyszło źle";
  return "Brak follow-upu";
}

function renderUser(user) {
  el.userSummary.textContent = `${user.name} · ${user.email} · użycie ${user.usageThisMonth}/${user.monthlyLimit === null ? "∞" : user.monthlyLimit}`;
  el.sidebarPlan.textContent = `Plan: ${user.plan.toUpperCase()}`;
}

function renderDecisionList(decisions) {
  if (!decisions.length) {
    el.decisionList.innerHTML = `<div class="muted-text">Brak zapisanych decyzji.</div>`;
    return;
  }

  el.decisionList.innerHTML = decisions
    .map((decision) => {
      const activeClass = decision.id === currentDecisionId ? ' style="border-color: rgba(124, 92, 255, 0.45);"' : "";
      return `
        <button class="decision-item" data-decision-id="${decision.id}" type="button"${activeClass}>
          <div class="decision-item-title">${escapeHtml(decision.title || "Bez tytułu")}</div>
          <div class="decision-item-meta">${escapeHtml(signalLabel(decision.signal))}</div>
          <div class="decision-item-meta">${escapeHtml(formatDate(decision.createdAt))}</div>
          <div class="decision-item-meta">${escapeHtml(outcomeLabel(decision.followup?.outcome))}</div>
        </button>
      `;
    })
    .join("");

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
  el.resultMeta.textContent = `${decision.mode.toUpperCase()} · ${signalLabel(decision.signal)} · ${formatDate(decision.createdAt)}`;
  el.resultOutput.textContent = decision.analysis;
  el.title.value = decision.title || "";
  el.situation.value = decision.situation || "";
  el.followupOutcome.value = decision.followup?.outcome || "";
  el.followupNotes.value = decision.followup?.notes || "";
  setMode(decision.mode || DEFAULT_MODE);
}

async function refreshDashboard() {
  const userId = getUserId();
  const dashboard = await api(`/user?userId=${encodeURIComponent(userId)}`);
  renderUser(dashboard.user);
  renderDecisionList(dashboard.decisions);

  if (currentDecisionId) {
    const exists = dashboard.decisions.find((item) => item.id === currentDecisionId);
    if (!exists) currentDecisionId = null;
  }
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

  try {
    const userId = getUserId();
    const data = await api("/analyze", {
      method: "POST",
      body: JSON.stringify({ userId, title, situation, mode: selectedMode })
    });

    currentDecisionId = data.decision.id;
    renderDecision(data.decision);
    renderUser(data.user);
    await refreshDashboard();
    setStatus("Analiza gotowa i zapisana w pamięci decyzji.");
  } catch (error) {
    if (error.message === "FREE_LIMIT_REACHED") {
      el.paywallBox.classList.remove("hidden");
      setStatus("FREE limit osiągnięty. Odblokuj PRO demo albo później podłącz Stripe.");
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
    const data = await api("/plan", {
      method: "POST",
      body: JSON.stringify({ userId, plan: "pro" })
    });

    renderUser(data.user);
    el.paywallBox.classList.add("hidden");
    setStatus("PRO demo odblokowane.");
    await refreshDashboard();
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
    renderUser(data.user);
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

function exportToPdf() {
  window.print();
}

el.modeButtons.forEach((button) => {
  button.addEventListener("click", () => setMode(button.dataset.mode));
});

el.analyzeBtn.addEventListener("click", analyze);
el.saveFollowupBtn.addEventListener("click", saveFollowup);
el.newUserBtn.addEventListener("click", createNewDemoUser);
el.unlockProBtn.addEventListener("click", unlockPro);
el.paywallUnlockBtn.addEventListener("click", unlockPro);
el.exportBtn.addEventListener("click", exportToPdf);

(async function init() {
  try {
    setMode(DEFAULT_MODE);
    await refreshDashboard();
    setStatus("Gotowe.");
  } catch (error) {
    setStatus(error.message || "Nie udało się załadować danych demo.");
  }
})();