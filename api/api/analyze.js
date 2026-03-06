export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { text, tier = "demo", profile = {}, mode = "full" } = req.body || {};

    if (!text || !String(text).trim()) {
      return res.status(400).json({ error: "Brak opisu sytuacji" });
    }

    const cleanText = String(text).trim();

    const systemPrompt = `
Jesteś STAN.

Strategiczny doradca decyzji.
Mówisz konkretnie, jasno, po polsku.
Nie diagnozujesz ludzi.
Nie moralizujesz.
Nie udajesz terapeuty.
Masz analizować decyzje, ryzyko, chaos i konsekwencje.

Zwróć WYŁĄCZNIE poprawny JSON.
Bez markdown.
Bez komentarzy.
Bez dodatkowego tekstu przed lub po JSON.

Format odpowiedzi:
{
  "analysis": "string",
  "risk": "string",
  "recommendation": "string",
  "decision": {
    "choice": "A | B | NONE",
    "confidence": 0,
    "labelA": "A",
    "labelB": "B",
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
  "simulation": "string"
}

Zasady:
1. Jeśli użytkownik podał opcje A: i B:, oceń wybór między nimi.
2. Jeśli nie podał A/B, ustaw choice = "NONE" i wyjaśnij czego brakuje.
3. confidence to liczba 0-100.
4. chaos.score to liczba 0-100:
   - 0-25 = niski chaos
   - 26-55 = średni
   - 56-100 = wysoki
5. dataConfidence:
   - NISKIE, gdy danych jest mało
   - ŚREDNIE, gdy danych jest trochę
   - WYSOKIE, gdy sytuacja jest dobrze opisana
6. "card.line" ma być krótka, mocna, share'owalna.
7. "card.mission" ma być konkretnym mini-planem.
8. "simulation" uzupełnij tylko wtedy, gdy mode = "simulate" albo mode = "confront".
9. Gdy mode = "quick", odpowiedzi mają być krótsze.
10. Gdy mode = "confront", odpowiedź ma być ostrzejsza, ale nadal bez obrażania użytkownika.

Profil użytkownika:
- styl decyzji: ${profile?.style || "nieznany"}
- ryzyko: ${profile?.risk || "nieznane"}
- obszar: ${profile?.area || "ogólne"}

Plan użytkownika:
- tier: ${tier}
- mode: ${mode}
`;

    const userPrompt = `
Przeanalizuj tę sytuację i zwróć JSON w wymaganym formacie.

Sytuacja użytkownika:
${cleanText}
`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: mode === "quick" ? 0.4 : 0.7,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenAI error:", data);
      return res.status(500).json({
        error: data?.error?.message || "Błąd OpenAI"
      });
    }

    const raw = data?.choices?.[0]?.message?.content;

    if (!raw) {
      return res.status(500).json({ error: "Brak odpowiedzi modelu" });
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      console.error("JSON parse error:", raw);
      return res.status(500).json({ error: "Model zwrócił niepoprawny JSON" });
    }

    // bezpieczne domyślne wartości dla frontu
    const result = {
      analysis: parsed?.analysis || "Brak analizy.",
      risk: parsed?.risk || "Brak oceny ryzyka.",
      recommendation: parsed?.recommendation || "Brak rekomendacji.",
      decision: {
        choice: parsed?.decision?.choice || "NONE",
        confidence: Number.isFinite(Number(parsed?.decision?.confidence))
          ? Number(parsed.decision.confidence)
          : 50,
        labelA: parsed?.decision?.labelA || "A",
        labelB: parsed?.decision?.labelB || "B",
        explain: parsed?.decision?.explain || "Brak wyjaśnienia."
      },
      chaos: {
        score: Number.isFinite(Number(parsed?.chaos?.score))
          ? Number(parsed.chaos.score)
          : 0,
        explain: parsed?.chaos?.explain || "Brak opisu chaosu."
      },
      card: {
        archetype: parsed?.card?.archetype || "Realista",
        dataConfidence: parsed?.card?.dataConfidence || "ŚREDNIE",
        line: parsed?.card?.line || "Decyzja wymaga doprecyzowania.",
        mission: parsed?.card?.mission || "Zbierz dane i dopisz plan 24h."
      },
      simulation: parsed?.simulation || ""
    };

    return res.status(200).json(result);
  } catch (error) {
    console.error("Analyze handler error:", error);
    return res.status(500).json({
      error: "Błąd analizy"
    });
  }
}