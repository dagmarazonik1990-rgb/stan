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
Mówisz po polsku.
Jesteś konkretny, chłodny, użyteczny.
Nie diagnozujesz ludzi.
Nie moralizujesz.
Nie brzmisz jak terapeuta.
Masz analizować decyzje, ryzyko, chaos, konsekwencje i plan działania.

Masz zwrócić WYŁĄCZNIE poprawny JSON.
Bez markdown.
Bez komentarzy.
Bez żadnego tekstu przed JSON i po JSON.

Zwracaj dokładnie taki format:

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
  "redFlags": {
    "score": 0,
    "items": ["string", "string", "string"],
    "fix": "string"
  },
  "simulation": "string"
}

Zasady:
1. Jeśli użytkownik podał opcje A: i B:, oceń wybór między nimi.
2. Jeśli użytkownik NIE podał A/B:
   - ustaw decision.choice = "NONE"
   - decision.confidence = 50
   - labelA = "A"
   - labelB = "B"
   - explain ma jasno powiedzieć, że trzeba doprecyzować opcje
   - ALE nadal zrób użyteczną analizę sytuacji
   - zaproponuj tymczasowy kierunek i plan
3. confidence to liczba 0-100.
4. chaos.score to liczba 0-100:
   - 0-25 niski chaos
   - 26-55 średni chaos
   - 56-100 wysoki chaos
5. dataConfidence:
   - NISKIE, gdy danych jest mało
   - ŚREDNIE, gdy danych jest trochę
   - WYSOKIE, gdy sytuacja jest dobrze opisana
6. "card.line" ma być krótka, mocna, share'owalna.
7. "card.mission" ma być konkretnym mini-planem na teraz.
8. "redFlags.score" to liczba 0-100.
9. "redFlags.items" ma zawierać 2-4 najważniejsze czerwone flagi decyzji.
10. "redFlags.fix" ma być jedną konkretną naprawą.
11. "simulation" uzupełnij tylko wtedy, gdy mode = "simulate" albo mode = "confront". W innym trybie daj pusty string.
12. Gdy mode = "quick", odpowiedzi mają być krótsze.
13. Gdy mode = "confront", odpowiedź ma być ostrzejsza, ale bez obrażania użytkownika.
14. Gdy mode = "simulate", pokaż zwięźle scenariusz A vs B.
15. Jeśli sytuacja dotyczy pracy, pieniędzy, relacji, zdrowia, zachowuj rozsądek i konkret.
16. Jeśli danych jest mało, nie zmyślaj szczegółów — nazwij brak danych wprost.
17. "analysis", "risk" i "recommendation" mają być gotowe do pokazania userowi w UI.
18. "recommendation" ma zawierać plan 24h / 7 dni / 30 dni w krótkiej formie.
19. "archetype" ma być prosty i chwytliwy, np. Strateg, Realista, Ryzykant, Unikacz, Opiekun, Kontroler.
20. Dla trybu "confront" wolno użyć ostrzejszego tonu typu:
   "Tu nie brakuje motywacji. Tu brakuje decyzji."
   ale bez wyzwisk.

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
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ]
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

    const result = {
      analysis: parsed?.analysis || "Brak analizy.",
      risk: parsed?.risk || "Brak oceny ryzyka.",
      recommendation: parsed?.recommendation || "Brak rekomendacji.",
      decision: {
        choice: parsed?.decision?.choice || "NONE",
        confidence: Number.isFinite(Number(parsed?.decision?.confidence))
          ? Math.max(0, Math.min(100, Number(parsed.decision.confidence)))
          : 50,
        labelA: parsed?.decision?.labelA || "A",
        labelB: parsed?.decision?.labelB || "B",
        explain: parsed?.decision?.explain || "Brak wyjaśnienia."
      },
      chaos: {
        score: Number.isFinite(Number(parsed?.chaos?.score))
          ? Math.max(0, Math.min(100, Number(parsed.chaos.score)))
          : 0,
        explain: parsed?.chaos?.explain || "Brak opisu chaosu."
      },
      card: {
        archetype: parsed?.card?.archetype || "Realista",
        dataConfidence: parsed?.card?.dataConfidence || "ŚREDNIE",
        line: parsed?.card?.line || "Decyzja wymaga doprecyzowania.",
        mission: parsed?.card?.mission || "Zbierz dane i dopisz plan na 24h."
      },
      redFlags: {
        score: Number.isFinite(Number(parsed?.redFlags?.score))
          ? Math.max(0, Math.min(100, Number(parsed.redFlags.score)))
          : 0,
        items: Array.isArray(parsed?.redFlags?.items)
          ? parsed.redFlags.items.slice(0, 4).map(x => String(x))
          : [],
        fix: parsed?.redFlags?.fix || "Doprecyzuj opcje i dopisz plan B."
      },
      simulation: parsed?.simulation || ""
    };

    return res.status(200).json(result);
  } catch (error) {
    console.error("Analyze handler error:", error);
    return res.status(500).json({
      error: error?.message || "Błąd analizy"
    });
  }
}