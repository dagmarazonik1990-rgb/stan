const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 12;
const MAX_TEXT_LENGTH = 4000;

const ipStore = new Map();

function cleanupRateLimitStore() {
  const now = Date.now();
  for (const [key, value] of ipStore.entries()) {
    if (!value || now - value.windowStart > RATE_LIMIT_WINDOW_MS * 2) {
      ipStore.delete(key);
    }
  }
}

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || "unknown";
}

function checkRateLimit(req) {
  cleanupRateLimitStore();

  const ip = getClientIp(req);
  const now = Date.now();

  const existing = ipStore.get(ip);

  if (!existing || now - existing.windowStart > RATE_LIMIT_WINDOW_MS) {
    ipStore.set(ip, {
      windowStart: now,
      count: 1,
    });
    return { ok: true };
  }

  if (existing.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { ok: false };
  }

  existing.count += 1;
  ipStore.set(ip, existing);
  return { ok: true };
}

function safeString(value, max = 300) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function normalizeMode(mode) {
  const allowed = new Set(["full", "quick", "simulate", "confront"]);
  return allowed.has(mode) ? mode : "full";
}

function normalizeTier(tier) {
  const allowed = new Set(["demo", "stan", "pro"]);
  return allowed.has(tier) ? tier : "demo";
}

function sanitizeProfile(profile) {
  if (!profile || typeof profile !== "object") {
    return {
      style: "",
      risk: "",
      area: "",
    };
  }

  return {
    style: safeString(profile.style, 40),
    risk: safeString(profile.risk, 40),
    area: safeString(profile.area, 40),
  };
}

function clamp(num, min, max) {
  return Math.max(min, Math.min(max, num));
}

function extractJsonFromText(text) {
  if (typeof text !== "string") return null;

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }

  const candidate = text.slice(firstBrace, lastBrace + 1);

  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

function buildFallbackResponse(userText, mode) {
  const hasA = /(^|\n)\s*A\s*:/im.test(userText);
  const hasB = /(^|\n)\s*B\s*:/im.test(userText);

  const choice = hasA && hasB ? "A" : "NONE";
  const confidence = hasA && hasB ? 58 : 50;

  const base = {
    analysis:
      mode === "confront"
        ? "Widzę napięcie decyzyjne, ale bez pełnego wyniku modelu dam tylko ostrożny fallback. Doprecyzuj cel, ograniczenia i realne koszty każdej opcji."
        : "To jest wstępny fallback STANa. Opis wygląda sensownie, ale bez pełnego wyniku modelu warto doprecyzować cel, ograniczenia i realne konsekwencje obu opcji.",
    risk:
      hasA && hasB
        ? "Największe ryzyko: decyzja podjęta zbyt szybko albo na zbyt małej liczbie danych."
        : "Największe ryzyko: brak jasnych opcji A/B, przez co trudniej porównać decyzję.",
    recommendation:
      hasA && hasB
        ? "Dopisz twarde ograniczenia, koszty i termin decyzji. To zwykle najbardziej poprawia trafność analizy."
        : "Rozpisz decyzję w formacie A i B. STAN działa najlepiej, gdy porównuje konkretne opcje.",
    decision: {
      labelA: "A",
      labelB: "B",
      choice,
      confidence,
      explain:
        hasA && hasB
          ? "Wstępny sygnał przechyla się lekko w stronę opcji A, ale to tylko bezpieczny fallback."
          : "Brak pełnego porównania — podaj opcje A/B.",
    },
    chaos: {
      score: hasA && hasB ? 44 : 22,
      explain:
        hasA && hasB
          ? "Chaos jest umiarkowany: decyzja jest opisana, ale nadal brakuje części danych."
          : "Chaos niski do umiarkowanego, ale problemem jest brak rozbicia decyzji na opcje.",
    },
    card: {
      archetype: hasA && hasB ? "Strateg" : "Obserwator",
      dataConfidence: hasA && hasB ? "ŚREDNIE" : "NISKIE",
      line:
        hasA && hasB
          ? "To nie jest jeszcze decyzja do skoku w ciemno."
          : "Najpierw nazwij opcje, potem wybieraj.",
      mission:
        hasA && hasB
          ? "Misja 24h: dopisz 3 realne koszty i 3 realne korzyści dla A oraz B."
          : "Misja 24h: zapisz decyzję jako A i B oraz nazwij cel.",
    },
    redFlags: {
      score: hasA && hasB ? 36 : 18,
      items: hasA && hasB
        ? [
            "Za mało twardych danych do mocnego werdyktu.",
            "Ryzyko decyzji pod wpływem napięcia.",
          ]
        : ["Brak rozpisanych opcji A/B."],
      fix: hasA && hasB
        ? "Dopisz koszty, termin i warunki brzegowe obu opcji."
        : "Rozbij problem na A i B.",
    },
    simulation:
      mode === "simulate"
        ? "Symulacja fallback: bez pełnej analizy warto porównać, co stanie się po 7 dniach, 30 dniach i 90 dniach dla opcji A i B."
        : "",
  };

  return base;
}

function buildSystemPrompt({ mode, tier, profile }) {
  return `
Jesteś STAN.
Jesteś strategicznym doradcą decyzji.
Mówisz po polsku.
Masz być konkretny, klarowny i użyteczny.
Nie moralizujesz.
Nie diagnozujesz zaburzeń ani ludzi.
Nie udajesz terapeuty.
Nie używasz reklamowego bełkotu.
Nie piszesz zbyt długo.

Twoje zadanie:
1. przeanalizować sytuację
2. wskazać ryzyka
3. oszacować chaos decyzyjny
4. wskazać czerwone flagi
5. dać rekomendację
6. jeśli są opcje A/B — oszacować, która ma większy sens
7. jeśli tryb to symulacja — pokazać skutki A/B
8. jeśli tryb to konfrontacja — być ostrzejszym i wskazać uniki myślowe

Kontekst użytkownika:
- tryb: ${mode}
- tier: ${tier}
- styl decyzji: ${profile.style || "brak"}
- tolerancja ryzyka: ${profile.risk || "brak"}
- obszar decyzji: ${profile.area || "brak"}

ZWRÓĆ WYŁĄCZNIE POPRAWNY JSON.
Bez markdown.
Bez komentarzy.
Bez dodatkowego tekstu.

Schemat JSON:
{
  "analysis": "string",
  "risk": "string",
  "recommendation": "string",
  "decision": {
    "labelA": "A",
    "labelB": "B",
    "choice": "A | B | NONE",
    "confidence": 0,
    "explain": "string"
  },
  "chaos": {
    "score": 0,
    "explain": "string"
  },
  "card": {
    "archetype": "string",
    "dataConfidence": "NISKIE | ŚREDNIE | WYSOKIE",
    "line": "string",
    "mission": "string"
  },
  "redFlags": {
    "score": 0,
    "items": ["string"],
    "fix": "string"
  },
  "simulation": "string"
}

Zasady jakości:
- confidence ma być liczbą 0-100
- chaos.score ma być liczbą 0-100
- redFlags.score ma być liczbą 0-100
- redFlags.items: 0-4 krótkie punkty
- gdy brakuje A/B, choice = "NONE"
- gdy nie ma symulacji, simulation = ""
- analysis, risk i recommendation mają być konkretne
- red flags mają dotyczyć decyzji, a nie diagnozy psychicznej
- jeśli opis jest zbyt krótki, pokaż to uczciwie
- jeśli ryzyko jest duże, nazwij je jasno

Dodatkowe wytyczne per tryb:
- full: pełna analiza
- quick: krócej, bardziej konkretnie
- simulate: mocniejsza sekcja simulation
- confront: wskaż uniki, samooszukiwanie, wygodne racjonalizacje, ale bez obrażania
`;
}

function validateModelResponse(data) {
  if (!data || typeof data !== "object") return false;
  if (typeof data.analysis !== "string") return false;
  if (typeof data.risk !== "string") return false;
  if (typeof data.recommendation !== "string") return false;
  if (!data.decision || typeof data.decision !== "object") return false;
  if (!data.chaos || typeof data.chaos !== "object") return false;
  if (!data.card || typeof data.card !== "object") return false;
  if (!data.redFlags || typeof data.redFlags !== "object") return false;
  return true;
}

function normalizeModelResponse(data) {
  const decisionChoiceRaw = safeString(data?.decision?.choice, 10).toUpperCase();
  const decisionChoice =
    decisionChoiceRaw === "A" || decisionChoiceRaw === "B" ? decisionChoiceRaw : "NONE";

  const redFlagItems = Array.isArray(data?.redFlags?.items)
    ? data.redFlags.items
        .map((item) => safeString(item, 120))
        .filter(Boolean)
        .slice(0, 4)
    : [];

  return {
    analysis: safeString(data.analysis, 1600),
    risk: safeString(data.risk, 1000),
    recommendation: safeString(data.recommendation, 1000),
    decision: {
      labelA: safeString(data?.decision?.labelA || "A", 40) || "A",
      labelB: safeString(data?.decision?.labelB || "B", 40) || "B",
      choice: decisionChoice,
      confidence: clamp(Number(data?.decision?.confidence || 50), 0, 100),
      explain: safeString(data?.decision?.explain, 500),
    },
    chaos: {
      score: clamp(Number(data?.chaos?.score || 0), 0, 100),
      explain: safeString(data?.chaos?.explain, 500),
    },
    card: {
      archetype: safeString(data?.card?.archetype, 60) || "—",
      dataConfidence: ["NISKIE", "ŚREDNIE", "WYSOKIE"].includes(
        safeString(data?.card?.dataConfidence, 20).toUpperCase()
      )
        ? safeString(data.card.dataConfidence, 20).toUpperCase()
        : "ŚREDNIE",
      line: safeString(data?.card?.line, 220) || "—",
      mission: safeString(data?.card?.mission, 400) || "—",
    },
    redFlags: {
      score: clamp(Number(data?.redFlags?.score || 0), 0, 100),
      items: redFlagItems,
      fix: safeString(data?.redFlags?.fix, 400) || "Doprecyzuj dane i ograniczenia decyzji.",
    },
    simulation: safeString(data?.simulation, 900),
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const rate = checkRateLimit(req);
  if (!rate.ok) {
    return res.status(429).json({
      error: "Za dużo prób. Odczekaj chwilę i spróbuj ponownie.",
    });
  }

  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};

    const text = safeString(body.text, MAX_TEXT_LENGTH + 100);
    const mode = normalizeMode(body.mode);
    const tier = normalizeTier(body.tier);
    const profile = sanitizeProfile(body.profile);

    if (!text) {
      return res.status(400).json({ error: "Brak opisu sytuacji." });
    }

    if (text.length > MAX_TEXT_LENGTH) {
      return res.status(400).json({
        error: `Opis jest za długi. Limit: ${MAX_TEXT_LENGTH} znaków.`,
      });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: "Brak konfiguracji środowiska dla analizy.",
      });
    }

    const systemPrompt = buildSystemPrompt({ mode, tier, profile });

    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: mode === "quick" ? 0.35 : 0.5,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: text,
          },
        ],
      }),
    });

    const raw = await openaiResponse.json();

    if (!openaiResponse.ok) {
      const apiMessage =
        raw?.error?.message || "Błąd po stronie modelu analizy.";
      return res.status(openaiResponse.status).json({
        error: apiMessage,
      });
    }

    const content = raw?.choices?.[0]?.message?.content || "";
    let parsed = null;

    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = extractJsonFromText(content);
    }

    if (!validateModelResponse(parsed)) {
      const fallback = buildFallbackResponse(text, mode);
      return res.status(200).json(fallback);
    }

    const normalized = normalizeModelResponse(parsed);

    if (mode !== "simulate") {
      normalized.simulation = "";
    }

    return res.status(200).json(normalized);
  } catch (error) {
    console.error("STAN analyze error:", error);

    return res.status(500).json({
      error: "Błąd analizy. Spróbuj ponownie za chwilę.",
    });
  }
}