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
  if (/(związek|relacja|partner|facet|dziewczyn|relationship|love|kocha|randk)/i.test(text)) {
    category = "relationship";
  } else if (/(praca|szef|firma|job|work|career)/i.test(text)) {
    category = "work";
  } else if (/(pieniądze|kredyt|pożyczka|dług|money|loan|debt)/i.test(text)) {
    category = "money";
  } else if (/(rodzina|matka|ojciec|family)/i.test(text)) {
    category = "family";
  }

  let risk = "medium";
  if (/(manipul|toksycz|scam|pułapka|abuse|oszust|red flag|przemoc|kłam)/i.test(text)) {
    risk = "high";
  } else if (text.length < 120) {
    risk = "low";
  }

  let recommendedMode = requestedMode || "full";
  if (recommendedMode === "confront") recommendedMode = "reality";
  if (category === "relationship" && risk !== "low") recommendedMode = "reality";
  else if (text.length < 220 && recommendedMode === "full") recommendedMode = "quick";

  return {
    category,
    risk,
    recommendedMode,
    needsFollowupQuestion: false,
    followupQuestion: "",
    blindSpot: true,
    reasoningHint: "Zwróć uwagę na niespójności między słowami, działaniem i realnym kosztem decyzji."
  };
}

function safeParseRouter(raw, requestedMode, situation) {
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;

    const allowedCategories = [
      "relationship",
      "work",
      "money",
      "family",
      "self-worth",
      "mixed"
    ];

    const allowedRisks = ["low", "medium", "high"];
    const allowedModes = ["quick", "full", "reality"];

    let requested = requestedMode || "full";
    if (requested === "confront") requested = "reality";

    return {
      category: allowedCategories.includes(parsed.category) ? parsed.category : "mixed",
      risk: allowedRisks.includes(parsed.risk) ? parsed.risk : "medium",
      recommendedMode: allowedModes.includes(parsed.recommendedMode)
        ? parsed.recommendedMode
        : requested,
      needsFollowupQuestion: false,
      followupQuestion: "",
      blindSpot: typeof parsed.blindSpot === "boolean" ? parsed.blindSpot : true,
      reasoningHint:
        typeof parsed.reasoningHint === "string" && parsed.reasoningHint.trim()
          ? parsed.reasoningHint.slice(0, 180)
          : "Zwróć uwagę na niespójności między słowami, działaniem i realnym kosztem decyzji."
    };
  } catch {
    return fallbackRouter({ situation, requestedMode });
  }
}

function fallbackAnalysis(mode, title, situation, router) {
  const safeTitle = title || "Ta decyzja";
  const safeMode = mode === "confront" ? "reality" : mode;

  if (safeMode === "quick") {
    return `Insight
${safeTitle} wygląda jak sytuacja, w której trzeba oddzielić emocje od faktów.

Pytanie
Czy wybierasz to, co jest realne, czy to, co chciałabyś, żeby było realne?

Mały krok
Wypisz 3 fakty, 3 ryzyka i 1 najbardziej racjonalny następny ruch.

Sygnał decyzji
${router.risk === "high" ? "🟠 Duże ryzyko" : router.risk === "low" ? "🟢 Racjonalnie" : "🟡 Uważaj"}`;
  }

  if (safeMode === "reality") {
    return `Insight
W tej historii widać napięcie między nadzieją a faktami.

Pytanie
Czy ta osoba / sytuacja daje Ci realne bezpieczeństwo, czy tylko chwilowe złudzenie?

Mały krok
Sprawdź, co w tej relacji albo decyzji jest potwierdzone czynami, a nie obietnicami.

Sygnał decyzji
${router.risk === "high" ? "🔴 Potencjalna pułapka" : "🟠 Poważne red flags"}`;
  }

  return `Insight
Z tego, co opisujesz, ${safeTitle.toLowerCase()} wiąże się z napięciem między tym, czego chcesz, a tym, co naprawdę pokazują fakty.

Pytanie
Jaki koszt zapłacisz za brak decyzji albo za dalsze odwlekanie?

Mały krok
Nazwij najbardziej stabilną opcję na teraz i sprawdź, czy jest spójna z rzeczywistością.

Dalsza analiza
Najważniejsze są tu: konsekwencje, poziom ryzyka i to, czy nie bronisz bardziej swojej nadziei niż faktów.

Sygnał decyzji
${router.risk === "high" ? "🟠 Poważne ryzyko" : router.risk === "low" ? "🟢 Stabilny kierunek" : "🟡 Decyzja wymaga ostrożności"}`;
}

function extractTextFromResponsesApi(data) {
  if (!data) return null;

  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  if (Array.isArray(data.output)) {
    const parts = [];

    for (const item of data.output) {
      if (!item || !Array.isArray(item.content)) continue;

      for (const content of item.content) {
        if (!content) continue;

        if (content.type === "output_text" && typeof content.text === "string") {
          parts.push(content.text);
        }

        if (content.type === "text" && typeof content.text === "string") {
          parts.push(content.text);
        }
      }
    }

    const joined = parts.join("\n").trim();
    if (joined) return joined;
  }

  return null;
}

async function callOpenAI(messages, { json = false } = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  if (!apiKey) return null;

  const payload = {
    model,
    input: messages
  };

  if (json) {
    payload.text = {
      format: {
        type: "json_object"
      }
    };
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    console.error("OpenAI error:", response.status, errorText);
    return null;
  }

  const data = await response.json();
  return extractTextFromResponsesApi(data);
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

  let requestedMode = mode || "full";
  if (requestedMode === "confront") requestedMode = "reality";

  const routerRaw = await callOpenAI(
    [
      {
        role: "system",
        content: baseSystemPrompt()
      },
      {
        role: "user",
        content: intakeRouterPrompt({
          title: title || "",
          situation,
          requestedMode
        })
      }
    ],
    { json: true }
  );

  const router = routerRaw
    ? safeParseRouter(routerRaw, requestedMode, situation)
    : fallbackRouter({ situation, requestedMode });

  const finalMode = router.recommendedMode || requestedMode || "full";

  const analysisRaw = await callOpenAI([
    {
      role: "system",
      content: baseSystemPrompt()
    },
    {
      role: "user",
      content: buildAnalysisPrompt({
        mode: finalMode,
        title: title || "",
        situation,
        router
      })
    }
  ]);

  const analysis = analysisRaw || fallbackAnalysis(finalMode, title || "", situation, router);

  increaseUsage(user);

  const signal =
    router.risk === "high"
      ? "🟠 Poważne ryzyko"
      : router.risk === "low"
        ? "🟢 Stabilnie"
        : "🟡 Uważaj";

  const decision = saveDecision({
    userId,
    title: title || "",
    situation,
    mode: finalMode,
    analysis,
    signal
  });

  return res.status(200).json({
    user: summarizeUser(user),
    decision,
    router
  });
}
