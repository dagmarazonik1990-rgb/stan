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
  navPlus: document.querySelector(".nav-plus"),
  orb: document.getElementById("mainOrb")
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

  const blocks = text.split(/\n\s*\n/).filter(Boolean);

  return blocks
    .map((block) => {
      const lines = block.split("\n").filter(Boolean);
      const [first, ...rest] = lines;

      if (!rest.length) {
        return `<div>${nl2brSafe(first)}</div>`;
      }

      return `
        <div>
          <strong>${escapeHtml(first)}</strong><br>
          ${nl2brSafe(rest.join("\n"))}
        </div>
      `;
    })
    .join("");
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
  } catch {
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
      () => {
        if (el.stepPattern) {
          el.stepPattern.textContent = `✓ Wzorzec: ${router?.reasoningHint || "analiza sytuacji"}`;
          el.stepPattern.classList.add("done");
        }
      },
      () => {
        if (el.stepMode) {
          el.stepMode.textContent = `✓ Tryb: ${router?.recommendedMode || selectedMode}`;
          el.stepMode.classList.add("done");
        }
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
  if (!el.decisionList) return;

  if (!decisions.length) {
    el.decisionList.innerHTML = `<div class="decision-item-meta">Brak zapisanych decyzji.</div>`;
    return;
  }

  el.decisionList.innerHTML = decisions
    .map((decision) => {
      return `
        <button class="decision-item" data-decision-id="${escapeHtml(decision.id)}" type="button">
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

  if (el.resultSection) el.resultSection.classList.remove("hidden");
  if (el.followupSection) el.followupSection.classList.remove("hidden");

  if (el.resultMeta) {
    el.resultMeta.textContent = `${(decision.mode || DEFAULT_MODE).toUpperCase()} · ${formatDate(decision.createdAt)}`;
  }

  if (el.resultOutput) {
    el.resultOutput.innerHTML = buildResultHtml(decision.analysis);
  }

  if (el.resultSignal) {
    el.resultSignal.textContent = decision.signal || "—";
  }

  if (el.title) {
    el.title.value = decision.title || "";
  }

  if (el.situation) {
    el.situation.value = decision.situation || "";
  }

  if (el.followupOutcome) {
    el.followupOutcome.value = decision.followup?.outcome || "";
  }

  if (el.followupNotes) {
    el.followupNotes.value = decision.followup?.notes || "";
  }

  setMode(decision.mode || DEFAULT_MODE);
}

async function refreshDashboard() {
  const userId = getUserId();
  const data = await api(`/user?userId=${encodeURIComponent(userId)}`);
  renderDecisionList(data.decisions || []);
}

async function loadDecision(decisionId) {
  const userId = getUserId();
  const data = await api(
    `/decision?userId=${encodeURIComponent(userId)}&decisionId=${encodeURIComponent(decisionId)}`
  );
  renderDecision(data.decision);
  await refreshDashboard();

  if (el.resultSection) {
    el.resultSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

async function analyze() {
  const title = el.title?.value.trim() || "";
  const situation = el.situation?.value.trim() || "";

  if (!situation) {
    setStatus("Najpierw opisz sytuację.");
    return;
  }

  setStatus("STAN analizuje...");
  if (el.paywallBox) el.paywallBox.classList.add("hidden");
  showLoader();

  try {
    const userId = getUserId();

    const data = await api("/analyze", {
      method: "POST",
      body: JSON.stringify({
        userId,
        title,
        situation,
        mode: selectedMode
      })
    });

    await animateRouter(data.router || null);
    hideLoader();

    currentDecisionId = data.decision.id;
    renderDecision(data.decision);
    await refreshDashboard();
    setStatus("Analiza gotowa.");

    if (el.resultSection) {
      el.resultSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  } catch (error) {
    hideLoader();

    if (error.message === "FREE_LIMIT_REACHED") {
      if (el.paywallBox) el.paywallBox.classList.remove("hidden");
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

  const outcome = el.followupOutcome?.value || "";
  const notes = el.followupNotes?.value.trim() || "";

  if (!outcome) {
    setStatus("Wybierz ocenę follow-upu.");
    return;
  }

  try {
    const userId = getUserId();
    const data = await api("/followup", {
      method: "POST",
      body: JSON.stringify({
        userId,
        decisionId: currentDecisionId,
        outcome,
        notes
      })
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

    if (el.paywallBox) el.paywallBox.classList.add("hidden");
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

    if (el.resultSection) el.resultSection.classList.add("hidden");
    if (el.followupSection) el.followupSection.classList.add("hidden");
    if (el.paywallBox) el.paywallBox.classList.add("hidden");

    if (el.title) el.title.value = "";
    if (el.situation) el.situation.value = "";
    if (el.followupOutcome) el.followupOutcome.value = "";
    if (el.followupNotes) el.followupNotes.value = "";

    await refreshDashboard();
    setStatus("Utworzono nowego użytkownika demo.");
  } catch (error) {
    setStatus(error.message || "Nie udało się utworzyć użytkownika demo.");
  }
}

function updateOrbReaction() {
  if (!el.orb || !el.situation) return;

  const len = el.situation.value.trim().length;
  const intensity = Math.min(len / 180, 1);

  const scale = 1 + intensity * 0.08;
  const translate = intensity * -10;
  const glow = 45 + intensity * 45;
  const blur = intensity * 2;

  el.orb.style.transform = `translateY(${translate}px) scale(${scale})`;
  el.orb.style.filter = `brightness(${1 + intensity * 0.18}) blur(${blur}px)`;
  el.orb.style.boxShadow = `
    0 0 ${glow}px rgba(139,92,246,${0.35 + intensity * 0.35}),
    0 20px 60px rgba(0,0,0,0.38),
    inset -20px -30px 40px rgba(0,0,0,0.32)
  `;
}

el.modeButtons.forEach((button) => {
  button.addEventListener("click", () => setMode(button.dataset.mode));
});

if (el.analyzeBtn) {
  el.analyzeBtn.addEventListener("click", analyze);
}

if (el.saveFollowupBtn) {
  el.saveFollowupBtn.addEventListener("click", saveFollowup);
}

if (el.newUserBtn) {
  el.newUserBtn.addEventListener("click", createNewDemoUser);
}

if (el.unlockProBtn) {
  el.unlockProBtn.addEventListener("click", unlockPro);
}

if (el.paywallUnlockBtn) {
  el.paywallUnlockBtn.addEventListener("click", unlockPro);
}

if (el.navPlus) {
  el.navPlus.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (el.situation) el.situation.focus();
  });
}

if (el.situation) {
  el.situation.addEventListener("input", updateOrbReaction);
}

(async function init() {
  try {
    setMode(DEFAULT_MODE);
    updateOrbReaction();
    await refreshDashboard();
    setStatus("Gotowe.");
  } catch (error) {
    setStatus(error.message || "Nie udało się załadować danych demo.");
  }
})();
