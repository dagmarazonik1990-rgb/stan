const FREE_LIMIT = 2;

function nowIso() {
  return new Date().toISOString();
}

function newId(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

const globalStore = globalThis.__STAN_DB__ || {
  users: {},
  decisions: {}
};

globalThis.__STAN_DB__ = globalStore;

function ensureUser(id) {
  if (!globalStore.users[id]) {
    globalStore.users[id] = {
      id,
      name: `Demo User ${Object.keys(globalStore.users).length + 1}`,
      email: `${id}@demo.local`,
      plan: "free",
      usageByMonth: {
        [currentMonthKey()]: 0
      },
      createdAt: nowIso()
    };
  }

  const user = globalStore.users[id];
  const monthKey = currentMonthKey();
  if (typeof user.usageByMonth[monthKey] !== "number") {
    user.usageByMonth[monthKey] = 0;
  }
  return user;
}

function createDemoUser() {
  const id = newId("user");
  const user = ensureUser(id);
  return summarizeUser(user);
}

function summarizeUser(user) {
  const monthKey = currentMonthKey();
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    plan: user.plan,
    usageThisMonth: user.usageByMonth[monthKey] || 0,
    monthlyLimit: user.plan === "pro" ? null : FREE_LIMIT,
    createdAt: user.createdAt
  };
}

function updatePlan(userId, plan) {
  const user = ensureUser(userId);
  user.plan = plan;
  return summarizeUser(user);
}

function canAnalyze(user) {
  if (user.plan === "pro") return true;
  const monthKey = currentMonthKey();
  return (user.usageByMonth[monthKey] || 0) < FREE_LIMIT;
}

function increaseUsage(user) {
  const monthKey = currentMonthKey();
  user.usageByMonth[monthKey] = (user.usageByMonth[monthKey] || 0) + 1;
}

function listDecisionsForUser(userId) {
  ensureUser(userId);
  return Object.values(globalStore.decisions)
    .filter((decision) => decision.userId === userId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function getDecision(userId, decisionId) {
  const decision = globalStore.decisions[decisionId];
  if (!decision || decision.userId !== userId) return null;
  return decision;
}

function parseSignalFromAnalysis(text) {
  if (!text) return "Brak sygnału";
  if (text.includes("🔴")) return "🔴 Potential trap";
  if (text.includes("🟠")) return "🟠 Serious red flags";
  if (text.includes("🟡")) return "🟡 Risky";
  if (text.includes("🟢")) return "🟢 Healthy / Rational";
  return "Brak sygnału";
}

function saveDecision({ userId, title, situation, mode, analysis }) {
  const decision = {
    id: newId("decision"),
    userId,
    title: title || "Bez tytułu",
    situation,
    mode,
    analysis,
    signal: parseSignalFromAnalysis(analysis),
    followup: null,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };

  globalStore.decisions[decision.id] = decision;
  return decision;
}

function saveFollowup({ userId, decisionId, outcome, notes }) {
  const decision = getDecision(userId, decisionId);
  if (!decision) return null;

  decision.followup = {
    outcome,
    notes,
    savedAt: nowIso()
  };
  decision.updatedAt = nowIso();
  return decision;
}

export {
  FREE_LIMIT,
  ensureUser,
  summarizeUser,
  createDemoUser,
  updatePlan,
  canAnalyze,
  increaseUsage,
  saveDecision,
  saveFollowup,
  listDecisionsForUser,
  getDecision
};