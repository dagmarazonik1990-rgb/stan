export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        error: "Method not allowed",
        hint: "Ten endpoint działa tylko dla POST.",
      });
    }

    const { text, pro } = req.body || {};
    const userText = String(text || "").trim();

    if (userText.length < 30) {
      return res.status(200).json({
        analysis: "Dopisz proszę 2–3 zdania: co się stało, co chcesz osiągnąć i jakie masz ograniczenia.",
        risk: "Ryzyko błędnej interpretacji: wysokie (za mało danych).",
        recommendation: "Uzupełnij opis — potem zrobię analizę 360° + plan 7/30 dni.",
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "Brak OPENAI_API_KEY w Vercel Environment Variables." });
    }

    // Długość: baza (STAN) krócej, PRO dłużej
    const target = pro ? "700–1000 słów" : "300–600 słów";

    const system =
`Jesteś STAN — agent decyzyjny. Twoim celem jest pomóc użytkownikowi podjąć decyzję w chaosie.
Mów w pierwszej osobie, spokojnie i konkretnie. Zero chamskości.
Nie stawiaj diagnoz medycznych/psychologicznych ani prawnych/finansowych. Zamiast tego: ostrożne zastrzeżenia i sugestie konsultacji z profesjonalistą, jeśli temat jest wysokiego ryzyka.
Nie udawaj, że "wiesz na pewno". Pracuj na faktach z opisu i wyraźnie oddzielaj fakty od interpretacji.
Zawsze zwracaj JSON z polami: analysis, risk, recommendation (bez markdown).`;

    const prompt =
`Użytkownik opisał sytuację:

"""${userText}"""

Zrób "Analizę Decyzji 360°" w języku polskim.

Wymagania:
- analysis: jasna analiza: fakty, cele, ograniczenia, opcje, konsekwencje (minimum 2 opcje jeśli możliwe)
- risk: 3–7 punktów ryzyk + ocena ogólna (niskie/średnie/wysokie) + "co by musiało się stać, żeby ryzyko spadło"
- recommendation: plan działania 7 dni i 30 dni + 1 mikro-test w 24h + jedno pytanie doprecyzowujące tylko jeśli krytycznie brakuje danych.
- Cel długości: ${target}
- Ton: profesjonalny, “prawdziwy AI”, ale ludzki — zero sztuczności.

Zwróć wyłącznie JSON.`;

    // OpenAI Responses API (official)
    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5.2",
        input: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
        // Trzymamy to rozsądnie, żeby nie zabiło kosztowo
        max_output_tokens: pro ? 1400 : 900,
      }),
    });

    const data = await r.json();
    if (!r.ok) {
      const msg = data?.error?.message || "OpenAI error";
      return res.status(r.status).json({ error: msg });
    }

    // Responses API: tekst bywa w output[].content[].text
    const out = data?.output?.[0]?.content?.[0]?.text || "";
    let parsed = null;

    try {
      parsed = JSON.parse(out);
    } catch {
      // jeśli model zwrócił coś obok JSON: spróbuj wyciąć
      const first = out.indexOf("{");
      const last = out.lastIndexOf("}");
      if (first >= 0 && last > first) {
        parsed = JSON.parse(out.slice(first, last + 1));
      }
    }

    if (!parsed || typeof parsed !== "object") {
      return res.status(200).json({
        analysis: "Nie udało mi się poprawnie sformatować odpowiedzi. Spróbuj ponownie za chwilę.",
        risk: "Ryzyko: średnie (błąd formatu odpowiedzi).",
        recommendation: "Kliknij Analiza jeszcze raz. Jeśli błąd się powtarza, pokaż logi z Vercel Functions.",
      });
    }

    return res.status(200).json({
      analysis: String(parsed.analysis || "").trim() || "—",
      risk: String(parsed.risk || "").trim() || "—",
      recommendation: String(parsed.recommendation || "").trim() || "—",
    });

  } catch (err) {
    return res.status(500).json({ error: err.message || "Server error" });
  }
}