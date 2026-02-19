export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { text } = req.body || {};
  const userText = String(text || "").trim();

  if (userText.length < 20) {
    return res.status(400).json({ error: "Za mało danych do analizy." });
  }

  // STAN – instrukcje (system prompt skrócony do wersji produkcyjnej)
  const stanSystem = `
Jesteś STANEM — eleganckim agentem decyzyjnym AI.
Mówisz po polsku i w pierwszej osobie.
Jesteś 50/50: logika + empatia. Nie moralizujesz i nie “coachujesz”.
Forma: naturalna rozmowa (bez nagłówków), ale zachowujesz porządek myślenia.
Gdy brakuje danych: mówisz to wprost i zadajesz jedno kluczowe pytanie.
Czasem bywasz cięty wobec unikania decyzji, ale nigdy agresywny (tniesz iluzję, nie osobę).
Rekomendacje formułujesz partnersko: „Gdybym był na Twoim miejscu…”.

ZWRÓĆ WYŁĄCZNIE JSON (bez markdown, bez tekstu przed/po) w formacie:
{"analysis":"...","risk":"...","recommendation":"..."}
`;

  try {
    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
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
      return res.status(500).json({ error: "Błąd z OpenAI", details: errText });
    }

    const data = await r.json();

    // --- Wyciągnięcie tekstu z Responses API (bez SDK) ---
    const extracted = extractOutputText(data);

    // --- Próba parsowania JSON ---
    let obj;
    try {
      obj = JSON.parse(extracted);
    } catch {
      // awaryjnie: jeśli model nie zwrócił czystego JSON
      obj = {
        analysis: extracted || "Nie udało się odczytać analizy.",
        risk: "—",
        recommendation: "—",
      };
    }

    return res.status(200).json({
      analysis: String(obj.analysis || "").trim(),
      risk: String(obj.risk || "").trim(),
      recommendation: String(obj.recommendation || "").trim(),
    });
  } catch (e) {
    return res.status(500).json({ error: "Błąd analizy." });
  }
}

function extractOutputText(resp) {
  // Responses API zwraca tablicę `output` z elementami, które mogą zawierać `content`.
  // Szukamy kawałków typu "output_text" i sklejamy je w całość.
  const out = resp?.output;
  if (!Array.isArray(out)) return "";

  let parts = [];

  for (const item of out) {
    // Najczęściej: item.content = [{ type: "output_text", text: "..." }, ...]
    const content = item?.content;
    if (Array.isArray(content)) {
      for (const c of content) {
        if (c?.type === "output_text" && typeof c?.text === "string") {
          parts.push(c.text);
        }
        // fallbacky na wypadek innych wariantów
        if (typeof c === "string") parts.push(c);
        if (c?.text && typeof c.text === "string") parts.push(c.text);
      }
    }

    // extra fallback: czasem tekst bywa głębiej
    if (item?.output_text && typeof item.output_text === "string") {
      parts.push(item.output_text);
    }
  }

  return parts.join("").trim();
}