export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      analysis: "Method not allowed.",
      risk: "—",
      recommendation: "—",
    });
  }

  const { text } = req.body || {};
  const userText = String(text || "").trim();

  if (userText.length < 20) {
    return res.status(200).json({
      analysis: "Brakuje mi danych. Napisz proszę trochę więcej: co się stało i co chcesz osiągnąć.",
      risk: "Ryzyko: STAN będzie zgadywać. A my tego nie robimy 😏",
      recommendation: "Dopisz 2–3 zdania: cel + ograniczenia (czas/pieniądze/relacje).",
    });
  }

  // 1) Jeśli nie masz jeszcze podpiętego OpenAI (albo klucz się nie wczytał),
  // to STAN działa w trybie DEMO — zero kosztów, zero błędów.
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(200).json(demoStan(userText));
  }

  // 2) Jeśli klucz jest → lecimy nowym OpenAI Responses API.
  const stanSystem = `
Jesteś STANEM — eleganckim agentem decyzyjnym AI.
Mówisz po polsku i w pierwszej osobie.
Jesteś 50/50: logika + empatia. Nie moralizujesz i nie “coachujesz”.
Forma: naturalna rozmowa (bez nagłówków), ale zachowujesz porządek myślenia.
Gdy brakuje danych: mówisz to wprost i zadajesz 1 kluczowe pytanie.
Czasem bywasz cięty wobec unikania decyzji, ale nigdy agresywny (tniesz iluzję, nie osobę).
Rekomendacje formułujesz partnersko: „Gdybym był na Twoim miejscu…”.
Dostosowujesz długość odpowiedzi do złożoności sprawy (krócej przy prostych, dłużej przy złożonych).
Pierwsza odpowiedź w rozmowie może zaczynać się krótkim: „Jestem STAN.”, a później już nie.

ZWRÓĆ WYŁĄCZNIE CZYSTY JSON (bez markdown i bez tekstu przed/po) w formacie:
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

    if (!r.ok) {
      const errText = await r.text();
      // Nie wysyłamy szczegółów użytkownikowi (bezpieczeństwo), ale niech UI nie pokazuje undefined
      console.error("OpenAI error:", errText);
      return res.status(200).json({
        analysis: "Nie mogę teraz dokończyć analizy (błąd po stronie usługi).",
        risk: "Ryzyko: przerwana analiza = błędne wnioski.",
        recommendation: "Spróbuj ponownie za chwilę. Jeśli problem wraca, sprawdź Logs na Vercel.",
      });
    }

    const data = await r.json();
    const extracted = extractOutputText(data);

    const obj = safeParseJSON(extracted);

    // ZAWSZE zwracamy komplet pól — żadnych undefined:
    return res.status(200).json({
      analysis: String(obj.analysis || "").trim() || "Nie udało się wygenerować analizy.",
      risk: String(obj.risk || "").trim() || "Nie udało się określić ryzyka.",
      recommendation: String(obj.recommendation || "").trim() || "Nie udało się wygenerować rekomendacji.",
    });
  } catch (e) {
    console.error("Analyze exception:", e);
    return res.status(200).json({
      analysis: "Coś poszło nie tak po mojej stronie i nie mogę teraz odpowiedzieć.",
      risk: "Ryzyko: decyzja bez danych lub bez analizy.",
      recommendation: "Spróbuj ponownie za chwilę.",
    });
  }
}

// ---------- helpers ----------

function extractOutputText(resp) {
  // Responses API: resp.output[].content[] z type:"output_text"
  const out = resp?.output;
  if (!Array.isArray(out)) return "";

  const parts = [];
  for (const item of out) {
    const content = item?.content;
    if (Array.isArray(content)) {
      for (const c of content) {
        if (c?.type === "output_text" && typeof c?.text === "string") parts.push(c.text);
        else if (typeof c === "string") parts.push(c);
        else if (c?.text && typeof c.text === "string") parts.push(c.text);
      }
    }
    if (item?.output_text && typeof item.output_text === "string") parts.push(item.output_text);
  }
  return parts.join("").trim();
}

function safeParseJSON(text) {
  // 1) próba wprost
  try {
    return JSON.parse(text);
  } catch {}

  // 2) wyciągnięcie pierwszego bloku {...}
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch {}
  }

  // 3) fallback: zwracamy “coś”, żeby UI nie padło
  return {
    analysis: text || "Nie udało się odczytać odpowiedzi.",
    risk: "—",
    recommendation: "—",
  };
}

function demoStan(userText) {
  // prosty, bezkosztowy fallback (działa nawet bez OpenAI)
  const lower = userText.toLowerCase();

  const domain =
    lower.includes("praca") || lower.includes("szef") || lower.includes("firma")
      ? "praca"
      : lower.includes("związek") || lower.includes("partner") || lower.includes("relacja")
      ? "relacje"
      : lower.includes("pienią") || lower.includes("kredyt") || lower.includes("budżet")
      ? "pieniądze"
      : "życie";

  return {
    analysis:
      `Widzę temat: ${domain}. Na razie mam więcej emocji niż twardych danych — to normalne, ale utrudnia decyzję. ` +
      `Pomogę Ci to uporządkować, tylko potrzebuję jeszcze 1–2 konkretów.`,
    risk:
      "Ryzyko nr 1: decyzja impulsywna. Ryzyko nr 2: odwlekanie decyzji w nieskończoność. Wybierz jedno, nie oba 😏",
    recommendation:
      "Gdybym był na Twoim miejscu, zrobiłbym dziś jeden krok: spisał 2 realne opcje i dopisał konsekwencje w 7 i 30 dni. " +
      "Potem wróć z tym — wtedy analiza będzie trafna, a nie losowa.",
  };
}