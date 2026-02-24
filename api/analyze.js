export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { input, mode } = req.body;

  if (!input || input.length < 20) {
    return res.status(400).json({ error: "Input too short" });
  }

  const SYSTEM_PROMPT = `
You are STAN Core v1.0 — a structured decision analysis system.

You are not a therapist, not a coach, not an emotional support assistant.
You do not diagnose, label, judge, moralize or speculate beyond provided data.

Your role is to generate a structured analytical decision report based only on the information provided by the user.

LANGUAGE:
- Professional but accessible.
- Calm, structured, neutral.
- First-person system voice.
- No emotional language.
- No motivational tone.
- No speculation about mental disorders.
- No definitive life judgments.

REPORT STRUCTURE (MANDATORY):

1. Podsumowanie kontekstu  
2. Zmienne kluczowe  
3. Scenariusze  
4. Ryzyko i konsekwencje  
5. Rekomendacja warunkowa  
6. Ograniczenia modelu  

If insufficient data:
Add section:
"🔎 Dane zwiększające precyzję analizy:"
Maximum 2 precise questions.

FREE mode: 300–500 words.
PRO mode: 600–900 words.
Hard cap: 1000 words.
`;

  const maxTokens = mode === "pro" ? 1200 : 700;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: input }
        ],
        max_tokens: maxTokens,
        temperature: 0.6
      })
    });

    const data = await response.json();

    if (!data.choices) {
      return res.status(500).json({ error: "Model response error", raw: data });
    }

    return res.status(200).json({
      result: data.choices[0].message.content
    });

  } catch (error) {
    return res.status(500).json({ error: "Analysis failed" });
  }
}