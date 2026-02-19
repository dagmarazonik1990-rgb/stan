export default async function handler(req, res) {
  const reply = (analysis, risk, recommendation, status = 200) =>
    res.status(status).json({ analysis, risk, recommendation });

  if (req.method !== "POST") {
    return reply(
      "Ten endpoint działa tylko dla POST.",
      "—",
      "Wróć do aplikacji i kliknij „Analiza →”."
    );
  }

  const { text } = req.body || {};
  const userText = String(text || "").trim();

  if (userText.length < 20) {
    return reply(
      "Brakuje mi danych. Napisz proszę trochę więcej: co się stało i co chcesz osiągnąć.",
      "Ryzyko: bez danych analiza będzie zgadywaniem.",
      "Dopisz 2–3 zdania: cel + ograniczenia (czas/pieniądze/relacje)."
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return reply(
      "Tryb DEMO: nie mam podpiętego klucza OpenAI, więc pokazuję przykładową analizę.",
      "Ryzyko: to jest tylko demo — bez AI.",
      "Dodaj OPENAI_API_KEY w Vercel → Settings → Environment Variables i zrób redeploy."
    );
  }

  const stanSystem = `
Jesteś STANEM — eleganckim agentem decyzyjnym AI.
Mówisz po polsku i w pierwszej osobie.
Jesteś 50/50: logika + empatia. Nie moralizujesz i nie coachujesz.
Forma: naturalna rozmowa (bez nagłówków), ale zachowujesz porządek myślenia.
Gdy brakuje danych: mówisz to wprost i zadajesz 1 kluczowe pytanie.
Czasem bywasz cięty wobec unikania decyzji, ale nigdy agresywny (tniesz iluzję, nie osobę).
Rekomendacje formułujesz partnersko: „Gdybym był na Twoim miejscu…”.

ZWRÓĆ WYŁĄCZNIE CZYSTY JSON:
{"analysis":"...","risk":"...","recommendation":"..."}
`;

  try {
    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        input: [
          { role: "system", content: stanSystem },
          { role: "user", content: userText },
        ],
        temperature: 0.7,
      }),
    });

    const raw = await r.text();

    if (!r.ok) {
      return reply(
        "Nie mogę teraz dokończyć analizy — OpenAI zwróciło błąd.",
        `Błąd: ${raw.slice(0, 220)}`,
        "Sprawdź billing/klucz. Jeśli chcesz, pokaż mi ten fragment błędu."
      );
    }

    const data = JSON.parse(raw);
    const extracted = extractOutputText(data);
    const obj = safeParseJSON(extracted);

    return reply(
      String(obj.analysis || "").trim() || extracted || "Brak analizy.",
      String(obj.risk || "").trim() || "Brak oceny ryzyka.",
      String(obj.recommendation || "").trim() || "Brak rekomendacji."
    );
  } catch (e) {
    return reply(
      "Nie mogę teraz dokończyć analizy (błąd po stronie usługi).",
      `Wyjątek: ${String(e).slice(0, 180)}`,
      "Spróbuj ponownie za chwilę."
    );
  }
}

function extractOutputText(resp) {
  const out = resp?.output;
  if (!Array.isArray(out)) return "";

  const parts = [];
  for (const item of out) {
    const content = item?.content;
    if (Array.isArray(content)) {
      for (const c of content) {
        if (c?.type === "output_text" && typeof c?.text === "string") parts.push(c.text);
        else if (typeof c?.text === "string") parts.push(c.text);
      }
    }
  }
  return parts.join("").trim();
}

function safeParseJSON(text) {
  try { return JSON.parse(text); } catch {}
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch {}
  }
  return { analysis: text, risk: "", recommendation: "" };
}