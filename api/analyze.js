export default async function handler(req, res) {
  const reply = (analysis, risk, recommendation, status = 200) =>
    res.status(status).json({ analysis, risk, recommendation });

  if (req.method !== "POST") {
    return reply(
      "Ten endpoint działa tylko dla POST.",
      "—",
      "Wróć do aplikacji i kliknij „Analiza →”.",
      405
    );
  }

  try {
    const { text, mode = "hardcore", persona = "stan" } = req.body || {};
    const userText = String(text || "").trim();

    if (userText.length < 40) {
      return reply(
        "Za mało danych. Podaj proszę: co się stało, co chcesz osiągnąć i jakie masz ograniczenia.",
        "Ryzyko błędnej interpretacji: wysokie (za mało danych).",
        "Dopisz 2–3 zdania: cel, ograniczenia, opcje A/B."
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return reply(
        "Brak konfiguracji klucza API na serwerze.",
        "Błąd konfiguracji.",
        "Dodaj zmienną środowiskową OPENAI_API_KEY w Vercel i zrób redeploy.",
        500
      );
    }

    // SYSTEM: osobowość, bezpieczeństwo, brak diagnoz, brak chamstwa
    const system = `
Jesteś STAN — agent decyzyjny. Mówisz po polsku.
Styl: bardzo konkretny, spokojny, premium, zero lania wody. Brzmisz jak prawdziwy asystent AI.
Zasady bezpieczeństwa:
- Nie stawiasz diagnoz medycznych/prawnych/finansowych. Możesz sugerować konsultację.
- Nie jesteś chamski, nie obrażasz, nie moralizujesz.
- Jeśli brakuje danych — zadaj maksymalnie 3 pytania doprecyzowujące.
Format odpowiedzi: ZWRACASZ JSON z polami: analysis, risk, recommendation.
Długość łącznie: 300–1000 słów. Piszesz w 1. osobie (np. „Widzę…”, „Proponuję…”).
Tryb "${mode}": dociskasz konkrety, ale z klasą.
`;

    // USER PROMPT
    const user = `
Użytkownik opisał sytuację:
"""${userText}"""

Wygeneruj:
analysis: analiza faktów vs emocje, hipotezy, co jest mierzalne, co nie.
risk: ryzyka i pułapki (np. impuls, koszt, reputacja, relacje, zdrowie).
recommendation: plan 7 dni + plan 30 dni + pierwszy mikrokrok (dzisiaj).
Jeśli brakuje danych — zadaj do 3 pytań w recommendation na samej górze.
`;

    // Call OpenAI Chat Completions (bez zdradzania modelu na UI)
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        temperature: 0.55,
        max_tokens: 1200,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system.trim() },
          { role: "user", content: user.trim() }
        ]
      })
    });

    const raw = await r.json();

    if (!r.ok) {
      const msg =
        raw?.error?.message ||
        "Nieznany błąd OpenAI. Sprawdź billing/limity.";
      return reply(
        "Nie mogę teraz dokończyć analizy — dostawca AI zwrócił błąd.",
        `Błąd: ${msg}`,
        "Sprawdź billing/limity w OpenAI oraz poprawność klucza. Potem spróbuj ponownie.",
        500
      );
    }

    const content = raw?.choices?.[0]?.message?.content || "{}";
    let out = {};
    try { out = JSON.parse(content); } catch { out = {}; }

    const A = String(out.analysis || "").trim();
    const R = String(out.risk || "").trim();
    const REC = String(out.recommendation || "").trim();

    // miękkie ograniczenie długości (żeby trzymać 300–1000 słów)
    const combined = [A, R, REC].join("\n\n").trim();
    const words = combined.split(/\s+/).filter(Boolean);
    let clipped = combined;

    if (words.length > 1000) {
      clipped = words.slice(0, 1000).join(" ").trim() + "…";
    }

    // jeśli za krótko, zostawiamy — model zwykle dobija do ~300+.
    // rozbijamy z powrotem prostą heurystyką:
    // (jeśli model zwrócił pola, nie tnę ich osobno)
    if (A && R && REC) {
      return reply(A, R, REC);
    }

    // fallback: jeśli JSON się posypał
    return reply(
      clipped || "Nie udało się wygenerować analizy.",
      "—",
      "Spróbuj ponownie za chwilę."
    );

  } catch (e) {
    return res.status(500).json({
      analysis: "Błąd serwera.",
      risk: "—",
      recommendation: "Jeśli chcesz, podeślij logi z Vercel (Runtime Logs)."
    });
  }
}