export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { text } = req.body || {};
  const userText = String(text || "").trim();

  if (userText.length < 10) {
    return res.status(400).json({ error: "Za mało danych do analizy." });
  }

  const systemPrompt = `
Jesteś STANEM — eleganckim agentem decyzyjnym AI.
Mówisz po polsku i w pierwszej osobie.
Jesteś 50/50: logika + empatia.
Forma: naturalna rozmowa.
Zwróć WYŁĄCZNIE czysty JSON:
{"analysis":"...","risk":"...","recommendation":"..."}
`;

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: userText,
          },
        ],
      }),
    });

    const data = await response.json();

    const rawText =
      data.output?.[0]?.content?.[0]?.text || "{}";

    const parsed = JSON.parse(rawText);

    return res.status(200).json(parsed);

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      analysis: "Nie mogę teraz dokończyć analizy.",
      risk: "Ryzyko: przerwana analiza.",
      recommendation: "Spróbuj ponownie za chwilę.",
    });
  }
}