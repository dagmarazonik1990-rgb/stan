import {
  ensureUser,
  summarizeUser,
  canAnalyze,
  increaseUsage,
  saveDecision
} from "./_db.js";

import {
  baseSystemPrompt,
  intakeRouterPrompt,
  buildAnalysisPrompt
} from "./_prompts.js";

function fallbackRouter({ situation, requestedMode }) {
  const text = (situation || "").toLowerCase();

  let category = "mixed";
  if (/(związek|relacja|partner|facet|dziewczyn|relationship|love)/i.test(text)) category = "relationship";
  else if (/(praca|szef|firma|job|work|career)/i.test(text)) category = "work";
  else if (/(pieniądze|kredyt|pożyczka|dług|money|loan|debt)/i.test(text)) category = "money";
  else if (/(rodzina|matka|ojciec|family)/i.test(text)) category = "family";

  let risk = "medium";
  if (/(manipul|toksycz|scam|pułapka|abuse|oszust)/i.test(text)) risk = "high";
  else if (text.length < 120) risk = "low";

  let recommendedMode = requestedMode || "full";
  if (category === "relationship" && risk !== "low") recommendedMode = "reality";
  else if (text.length < 220) recommendedMode = requestedMode === "full" ? "full" : (requestedMode || "quick");

  return {
    category,
    risk,
    recommendedMode,
    needsFollowupQuestion: false,
    followupQuestion: "",
    blindSpot: true,
    reasoningHint: "Look for contradictions and realistic consequences."
  };
}

function safeParseRouter(raw, requestedMode, situation) {
  try {
    const parsed = JSON.parse(raw);
    const allowedCategories = ["relationship", "work", "money", "family", "self-worth", "mixed"];
    const allowedRisks = ["low", "medium", "high"];
    const allowedModes = ["quick", "full", "reality"];

    return {
      category: allowedCategories.includes(parsed.category) ? parsed.category : "mixed",
      risk: allowedRisks.includes(parsed.risk) ? parsed.risk : "medium",
      recommendedMode: allowedModes.includes(parsed.recommendedMode) ? parsed.recommendedMode : (requestedMode || "full"),
      needsFollowupQuestion: false,
      followupQuestion: "",
      blindSpot: typeof parsed.blindSpot === "boolean" ? parsed.blindSpot : true,
      reasoningHint: typeof parsed.reasoningHint === "string"
        ? parsed.reasoningHint.slice(0, 120)
        : "Look for contradictions and realistic consequences."
    };
  } catch {
    return fallbackRouter({ situation, requestedMode });
  }
}

function fallbackAnalysis(mode, title, situation, router) {
  const safeTitle = title || "Ta decyzja";

  if (mode === "quick") {
    return `SITUATION SUMMARY
${safeTitle} wygląda jak sytuacja, w której trzeba oddzielić emocje od faktów.

MAIN RISK
Największym ryzykiem jest decyzja pod wpływem napięcia albo nadziei bez twardych przesłanek.

MOST RATIONAL OPTION
Najbardziej racjonalna będzie opcja, która daje więcej stabilności i mniej zależy od obietnic.

ONE KEY QUESTION
Czy wybierasz to, co jest realne, czy to, co chciałabyś, żeby było realne?

DECISION SIGNAL
${router.risk === "high" ? "🟠 Serious red flags" : router.risk === "low" ? "🟢 Healthy / Rational" : "🟡 Risky"}`;
  }

  if (mode === "reality") {
    return `KEY SIGNALS
• W tej historii widać niespójność między słowami a działaniem.
• Warto sprawdzić, czy ten wzorzec powtarza się od dawna.

WHAT THIS USUALLY MEANS
Takie sytuacje często oznaczają, że rzeczywistość jest mniej stabilna niż nadzieja.

WHAT TO WATCH FOR
Jeśli dalej będziesz ignorować sygnały ostrzegawcze, koszt emocjonalny może rosnąć.

BLIND SPOT
Możliwe, że bronisz nie faktów, tylko swojej nadziei wobec tej sytuacji.

DECISION SIGNAL
${router.risk === "high" ? "🔴 Potential trap" : "🟠 Serious red flags"}`;
  }

  return `UNDERSTANDING
Z tego, co opisujesz, ${safeTitle.toLowerCase()} wiąże się z napięciem między tym, czego chcesz, a tym, co naprawdę widać w faktach.

REALITY CHECK
Najważniejsze są tu niespójności, koszt odwlekania i ryzyko, że emocje przykrywają ocenę sytuacji.

POSSIBLE SCENARIOS
1. Jeśli nic nie zmienisz, problem może się przeciągać.
2. Jeśli doprecyzujesz granice albo fakty, obraz sytuacji stanie się jaśniejszy.
3. Jeśli pójdziesz za nadzieją bez dowodów, możesz zapłacić za to czasem i spokojem.

BLIND SPOT
Możliwe, że nie oceniasz tylko tej decyzji — oceniasz też swoją potrzebę bezpieczeństwa albo uniknięcia straty.

FUTURE SELF
Za 6–12 miesięcy Twoje przyszłe ja może bardziej docenić jasność niż chwilowy komfort.

DECISION SIGNAL
${router.risk === "high" ? "🟠 Serious red flags" : router.risk === "low" ? "🟢 Healthy / Rational" : "🟡 Risky"}

CLOSING INSIGHT
Najważniejsze pytanie nie brzmi, czego dziś najbardziej chcesz — tylko co jest spójne z rzeczywistością.`;
}

async function callOpenAI(messages) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-5-mini";

  if (!apiKey) return null;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      input: messages
    })
  });

  if (!response.ok) return null;

  const data = await response.json();
  return data?.output_text || null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  const { userId, title, situation, mode } = req.body || {};

  if (!userId || !situation) {
    return res.status(400).json({ error: "userId i situation są wymagane." });
  }

  const user = ensureUser(userId);

  if (!canAnalyze(user)) {
    return res.status(402).json({ error: "FREE_LIMIT_REACHED" });
  }

  const routerRaw = await callOpenAI([
    { role: "system", content: baseSystemPrompt() },
    { role: "user", content: intakeRouterPrompt({ title: title || "", situation, requestedMode: mode || "full" }) }
  ]);

  const router = routerRaw
    ? safeParseRouter(routerRaw, mode || "full", situation)
    : fallbackRouter({ situation, requestedMode: mode || "full" });

  const finalMode = router.recommendedMode || mode || "full";

  const analysisRaw = await callOpenAI([
    { role: "system", content: baseSystemPrompt() },
    { role: "user", content: buildAnalysisPrompt({ mode: finalMode, title: title || "", situation, router }) }
  ]);

  const analysis = analysisRaw || fallbackAnalysis(finalMode, title || "", situation, router);

  increaseUsage(user);

  const decision = saveDecision({
    userId,
    title: title || "",
    situation,
    mode: finalMode,
    analysis
  });

  return res.status(200).json({
    user: summarizeUser(user),
    decision,
    router
  });
}
