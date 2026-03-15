const API_BASE = "/api";
const DEFAULT_USER_ID = "demo-user-1";
const DEFAULT_MODE = "full";

let selectedMode = DEFAULT_MODE;
let currentDecisionId = null;
let deferredPrompt = null;
let currentPersona = "orb";
let isProUnlocked = false;

const el = {
  appShell: document.getElementById("appShell"),
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
  paywallCloseBtn: document.getElementById("paywallCloseBtn"),
  paywallTitle: document.getElementById("paywallTitle"),
  paywallText: document.getElementById("paywallText"),
  loader: document.getElementById("analysisLoader"),
  stepCategory: document.getElementById("stepCategory"),
  stepRisk: document.getElementById("stepRisk"),
  stepPattern: document.getElementById("stepPattern"),
  stepMode: document.getElementById("stepMode"),
  modeButtons: Array.from(document.querySelectorAll(".mode-btn")),
  navPlus: document.querySelector(".nav-plus"),
  orb: document.getElementById("mainOrb"),
  installBanner: document.getElementById("installBanner"),
  installBtn: document.getElementById("installBtn"),
  dismissInstallBtn: document.getElementById("dismissInstallBtn"),
  installHint: document.getElementById("installHint"),
  shareCardBtn: document.getElementById("shareCardBtn"),
  shareNudge: document.getElementById("shareNudge"),
  personaChip: document.getElementById("personaChip"),
  personaCaption: document.getElementById("personaCaption"),
  planTitle: document.getElementById("planTitle"),
  planSubtitle: document.getElementById("planSubtitle"),
  orbTabBtn: document.getElementById("orbTabBtn"),
  semiTabBtn: document.getElementById("semiTabBtn"),
  semiNavBtn: document.getElementById("semiNavBtn"),
  togglePersonaBtn: document.getElementById("togglePersonaBtn"),
  semiPanel: document.getElementById("semiPanel")
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

function updatePersonaUI() {
  const isSemi = currentPersona === "semi";

  el.appShell?.classList.toggle("is-semi", isSemi);
  el.orbTabBtn?.classList.toggle("active", !isSemi);
  el.semiTabBtn?.classList.toggle("active", isSemi);

  if (el.personaChip) {
    el.personaChip.textContent = isSemi ? "SEMI" : "ORB";
  }

  if (el.planTitle) {
    el.planTitle.textContent = isSemi
      ? "Plan SEMI — 39 zł / miesiąc"
      : "Plan ORB — 29 zł / miesiąc";
  }

  if (el.planSubtitle) {
    el.planSubtitle.textContent = isSemi
      ? "SEMI daje mocniejszą konfrontację, głębsze lustro i bardziej bezpośrednią analizę wzorców."
      : "SEMI (PRO) — 39 zł / miesiąc • głębsza analiza, tryby premium, mocniejsza obecność";
  }

  if (el.personaCaption) {
    el.personaCaption.innerHTML = isSemi
      ? "SEMI nie głaszcze.<br>Pokazuje, co ignorujesz, gdzie się oszukujesz i jaki będzie koszt braku decyzji."
      : "STAN nie podejmuje decyzji za Ciebie.<br>Pomaga zobaczyć konsekwencje, ryzyko i chaos.";
  }

  if (el.semiPanel) {
    el.semiPanel.classList.toggle("hidden", !isSemi);
  }

  if (selectedMode === "quick" && isSemi) {
    setMode("reality");
  }
}

function openPaywallForSemi() {
  if (el.paywallTitle) {
    el.paywallTitle.textContent = "SEMI jest częścią PRO";
  }
  if (el.paywallText) {
    el.paywallText.textContent = "SEMI daje mocniejszą, bardziej bezpośrednią analizę. Odblokuj PRO demo, żeby z niej korzystać.";
  }
  if (el.paywallBox) {
    el.paywallBox.classList.remove("hidden");
  }
  setStatus("SEMI wymaga PRO demo.");
}

function setPersona(nextPersona) {
  if (nextPersona === "semi" && !isProUnlocked) {
    openPaywallForSemi();
    return;
  }

  currentPersona = nextPersona;
  updatePersonaUI();
}

function togglePersona() {
  if (currentPersona === "orb") {
    setPersona("semi");
  } else {
    setPersona("orb");
  }
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
  if (el.shareNudge) el.shareNudge.classList.remove("hidden");

  if (el.resultMeta) {
    const personaLabel = currentPersona === "semi" ? "SEMI" : "ORB";
    el.resultMeta.textContent = `${personaLabel} · ${(decision.mode || DEFAULT_MODE).toUpperCase()} · ${formatDate(decision.createdAt)}`;
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
    updateOrbReaction();
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

  if (currentPersona === "semi" && !isProUnlocked) {
    openPaywallForSemi();
    return;
  }

  setStatus(currentPersona === "semi" ? "SEMI analizuje..." : "STAN analizuje...");
  if (el.paywallBox) el.paywallBox.classList.add("hidden");
  showLoader();

  try {
    const userId = getUserId();
    const personaPrefix =
      currentPersona === "semi"
        ? "PERSONA: SEMI\nTon: bardziej bezpośredni, ostrzejszy, bardziej konfrontacyjny.\n\n"
        : "PERSONA: ORB\nTon: strategiczny, spokojny, klarujący chaos.\n\n";

    const data = await api("/analyze", {
      method: "POST",
      body: JSON.stringify({
        userId,
        title,
        situation: personaPrefix + situation,
        mode: selectedMode
      })
    });

    await animateRouter(data.router || null);
    hideLoader();

    currentDecisionId = data.decision.id;
    renderDecision(data.decision);
    await refreshDashboard();
    setStatus(currentPersona === "semi" ? "SEMI zakończyło analizę." : "Analiza gotowa.");

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

    isProUnlocked = true;

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
    isProUnlocked = false;
    currentPersona = "orb";

    if (el.resultSection) el.resultSection.classList.add("hidden");
    if (el.followupSection) el.followupSection.classList.add("hidden");
    if (el.paywallBox) el.paywallBox.classList.add("hidden");
    if (el.shareNudge) el.shareNudge.classList.add("hidden");

    if (el.title) el.title.value = "";
    if (el.situation) {
      el.situation.value = "";
      updateOrbReaction();
    }
    if (el.followupOutcome) el.followupOutcome.value = "";
    if (el.followupNotes) el.followupNotes.value = "";

    updatePersonaUI();
    await refreshDashboard();
    setStatus("Utworzono nowego użytkownika demo.");
  } catch (error) {
    setStatus(error.message || "Nie udało się utworzyć użytkownika demo.");
  }
}

function updateOrbReaction() {
  if (!el.orb || !el.situation) return;

  const len = el.situation.value.trim().length;
  const intensity = Math.min(len / 220, 1);

  const scale = 1 + intensity * 0.10;
  const translate = intensity * -12;
  const glow = 60 + intensity * 60;
  const outer = 140 + intensity * 80;
  const blur = intensity * 0.6;

  if (currentPersona === "semi") {
    el.orb.style.transform = `translateY(${translate}px) scale(${scale})`;
    el.orb.style.filter = `brightness(${1 + intensity * 0.22}) saturate(${1 + intensity * 0.35}) blur(${blur}px)`;
    el.orb.style.boxShadow = `
      0 0 ${glow}px rgba(255,77,184,${0.35 + intensity * 0.35}),
      0 0 ${outer}px rgba(122,44,255,${0.10 + intensity * 0.15}),
      0 24px 70px rgba(0,0,0,0.45),
      inset -18px -28px 40px rgba(0,0,0,0.30),
      inset 8px 10px 22px rgba(255,255,255,0.08)
    `;
    return;
  }

  el.orb.style.transform = `translateY(${translate}px) scale(${scale})`;
  el.orb.style.filter = `brightness(${1 + intensity * 0.22}) saturate(${1 + intensity * 0.25}) blur(${blur}px)`;
  el.orb.style.boxShadow = `
    0 0 ${glow}px rgba(139,92,246,${0.40 + intensity * 0.35}),
    0 0 ${outer}px rgba(96,165,250,${0.08 + intensity * 0.12}),
    0 24px 70px rgba(0,0,0,0.45),
    inset -18px -28px 40px rgba(0,0,0,0.30),
    inset 8px 10px 22px rgba(255,255,255,0.08)
  `;
}

function isIos() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function isInStandaloneMode() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function showInstallBanner(message) {
  if (!el.installBanner) return;
  if (el.installHint && message) el.installHint.textContent = message;
  el.installBanner.classList.remove("hidden");
}

function hideInstallBanner() {
  if (!el.installBanner) return;
  el.installBanner.classList.add("hidden");
}

function setupInstallPrompt() {
  if (isInStandaloneMode()) {
    hideInstallBanner();
    return;
  }

  if (isIos()) {
    showInstallBanner("Na iPhonie: Safari → Udostępnij → Do ekranu głównego.");
    if (el.installBtn) el.installBtn.textContent = "Jak zainstalować";
    return;
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    showInstallBanner("Zainstaluj STAN, żeby działał jak normalna aplikacja.");
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    hideInstallBanner();
    setStatus("STAN został zainstalowany.");
  });
}

async function handleInstallClick() {
  if (isIos()) {
    showInstallBanner("Na iPhonie: Safari → Udostępnij → Do ekranu głównego.");
    return;
  }

  if (!deferredPrompt) {
    showInstallBanner("Opcja instalacji pojawi się, gdy przeglądarka uzna STAN za gotowy do instalacji.");
    return;
  }

  deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;
  if (choice.outcome === "accepted") {
    setStatus("Instalacja STAN rozpoczęta.");
  }
  deferredPrompt = null;
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("SW registration failed:", error);
    });
  });
}

function extractDecisionCardParts() {
  const raw = el.resultOutput ? el.resultOutput.innerText.trim() : "";
  const signal = el.resultSignal ? el.resultSignal.innerText.trim() : "—";

  let insight = "";
  let question = "";
  let step = "";

  const insightMatch = raw.match(/Insight\s*([\s\S]*?)Pytanie/);
  const questionMatch = raw.match(/Pytanie\s*([\s\S]*?)Mały krok/);
  const stepMatch = raw.match(/Mały krok\s*([\s\S]*)/);

  if (insightMatch) insight = insightMatch[1].trim();
  if (questionMatch) question = questionMatch[1].trim();
  if (stepMatch) step = stepMatch[1].trim();

  if (!insight && !question && !step) {
    insight = raw;
  }

  return { signal, insight, question, step };
}

async function shareDecisionCard() {
  if (!el.resultSection || el.resultSection.classList.contains("hidden")) {
    setStatus("Najpierw wygeneruj analizę.");
    return;
  }

  if (typeof html2canvas === "undefined") {
    setStatus("Nie udało się załadować modułu karty.");
    return;
  }

  try {
    setStatus("Tworzę kartę decyzji...");

    const { signal, insight, question, step } = extractDecisionCardParts();
    const personaLabel = currentPersona === "semi" ? "SEMI" : "ORB";

    const card = document.createElement("div");
    card.style.width = "1080px";
    card.style.padding = "64px";
    card.style.borderRadius = "42px";
    card.style.background =
      currentPersona === "semi"
        ? "radial-gradient(circle at top left, rgba(255,122,122,0.22), transparent 24%), radial-gradient(circle at 85% 20%, rgba(255,77,184,0.18), transparent 22%), linear-gradient(180deg, #1a0d23 0%, #12081f 40%, #0f0619 100%)"
        : "radial-gradient(circle at top left, rgba(139,92,246,0.35), transparent 28%), radial-gradient(circle at 85% 28%, rgba(96,165,250,0.18), transparent 20%), linear-gradient(180deg, #160a28 0%, #12081f 40%, #10081a 100%)";
    card.style.color = "#f5efff";
    card.style.fontFamily = "-apple-system, BlinkMacSystemFont, Inter, sans-serif";
    card.style.border = "1px solid rgba(255,255,255,0.12)";
    card.style.boxSizing = "border-box";

    const orbGradient =
      currentPersona === "semi"
        ? "radial-gradient(circle at 35% 30%, rgba(255,255,255,0.86), rgba(255,255,255,0) 22%), radial-gradient(circle at 50% 50%, #ff91c9 0%, #ff4db8 30%, #7a2cff 64%, #15061d 100%)"
        : "radial-gradient(circle at 35% 30%, rgba(255,255,255,0.82), rgba(255,255,255,0) 22%), radial-gradient(circle at 50% 50%, #a78bfa 0%, #7c3aed 45%, #2a1454 78%, #12081f 100%)";

    card.innerHTML = `
      <div style="display:flex;align-items:center;gap:18px;margin-bottom:28px;">
        <div style="width:62px;height:62px;border-radius:999px;background:${orbGradient};box-shadow:0 0 30px rgba(139, 92, 246, 0.45), inset 0 -16px 28px rgba(0,0,0,0.28);"></div>
        <div>
          <div style="font-size:62px;font-weight:900;line-height:0.95;letter-spacing:-0.05em;">${personaLabel}</div>
          <div style="margin-top:8px;font-size:22px;color:rgba(255,255,255,0.72);">Strategiczny doradca decyzji</div>
        </div>
      </div>

      <div style="padding:18px 20px;border-radius:999px;border:1px solid rgba(255,255,255,0.10);background:rgba(255,255,255,0.06);display:inline-flex;align-items:center;gap:10px;font-size:28px;font-weight:800;margin-bottom:30px;">
        <span>Sygnał decyzji</span>
        <span>${escapeHtml(signal)}</span>
      </div>

      <div style="padding:28px;border-radius:28px;border:1px solid rgba(255,255,255,0.10);background:rgba(255,255,255,0.05);margin-bottom:18px;">
        <div style="font-size:22px;font-weight:800;margin-bottom:12px;">Insight</div>
        <div style="font-size:28px;line-height:1.45;color:#f5efff;">${escapeHtml(insight || "Brak insightu.")}</div>
      </div>

      <div style="padding:28px;border-radius:28px;border:1px solid rgba(255,255,255,0.10);background:rgba(255,255,255,0.05);margin-bottom:18px;">
        <div style="font-size:22px;font-weight:800;margin-bottom:12px;">Pytanie</div>
        <div style="font-size:28px;line-height:1.45;color:#f5efff;">${escapeHtml(question || "Brak pytania.")}</div>
      </div>

      <div style="padding:28px;border-radius:28px;border:1px solid rgba(255,255,255,0.10);background:rgba(255,255,255,0.05);margin-bottom:28px;">
        <div style="font-size:22px;font-weight:800;margin-bottom:12px;">Mały krok</div>
        <div style="font-size:28px;line-height:1.45;color:#f5efff;">${escapeHtml(step || "Brak kroku.")}</div>
      </div>

      <div style="font-size:22px;color:rgba(255,255,255,0.55);">${personaLabel} • STAN (Original) © 2026</div>
    `;

    card.style.position = "fixed";
    card.style.left = "-99999px";
    card.style.top = "0";
    document.body.appendChild(card);

    const canvas = await html2canvas(card, {
      backgroundColor: null,
      scale: 2,
      useCORS: true
    });

    card.remove();

    canvas.toBlob(async (blob) => {
      if (!blob) {
        setStatus("Nie udało się utworzyć obrazka.");
        return;
      }

      const file = new File([blob], `stan-karta-${personaLabel.toLowerCase()}.png`, { type: "image/png" });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `STAN — karta ${personaLabel}`,
          text: "Moja karta decyzji ze STAN.",
          files: [file]
        });
        setStatus("Karta gotowa do udostępnienia.");
        return;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `stan-karta-${personaLabel.toLowerCase()}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setStatus("Karta została zapisana.");
    }, "image/png");
  } catch (error) {
    setStatus("Nie udało się utworzyć karty.");
  }
}

el.modeButtons.forEach((button) => {
  button.addEventListener("click", () => setMode(button.dataset.mode));
});

el.analyzeBtn?.addEventListener("click", analyze);
el.saveFollowupBtn?.addEventListener("click", saveFollowup);
el.newUserBtn?.addEventListener("click", createNewDemoUser);
el.unlockProBtn?.addEventListener("click", unlockPro);
el.paywallUnlockBtn?.addEventListener("click", unlockPro);
el.paywallCloseBtn?.addEventListener("click", () => el.paywallBox?.classList.add("hidden"));
el.navPlus?.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
  el.situation?.focus();
});
el.situation?.addEventListener("input", updateOrbReaction);
el.installBtn?.addEventListener("click", handleInstallClick);
el.dismissInstallBtn?.addEventListener("click", hideInstallBanner);
el.shareCardBtn?.addEventListener("click", shareDecisionCard);
el.orbTabBtn?.addEventListener("click", () => setPersona("orb"));
el.semiTabBtn?.addEventListener("click", () => setPersona("semi"));
el.semiNavBtn?.addEventListener("click", () => setPersona("semi"));
el.togglePersonaBtn?.addEventListener("click", togglePersona);

(async function init() {
  try {
    setMode(DEFAULT_MODE);
    updatePersonaUI();
    updateOrbReaction();
    setupInstallPrompt();
    registerServiceWorker();
    await refreshDashboard();
    setStatus("Gotowe.");
  } catch (error) {
    setStatus(error.message || "Nie udało się załadować danych demo.");
  }
})();
