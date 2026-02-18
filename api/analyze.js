export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Use POST" });
    return;
  }

  try {
    const { text } = req.body || {};
    if (!text || text.length < 20) {
      res.status(400).json({ error: "Za krótki tekst." });
      return;
    }

    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: [
          {
            role: "system",
            content:
              "Jesteś STAN: asystent-agent. Dajesz konkretną, krótką analizę w 4 sekcjach: 1) FAKTY 2) EMOCJE 3) TY 4) KROK (1 działanie w 24h). Bez moralizowania.",
          },
          { role: "user", content: text },
        ],
      }),
    });

    const data = await r.json();

    if (!r.ok) {
      res.status(500).json({ error: data?.error?.message || "OpenAI error" });
      return;
    }

    const outputText = data.output_text || "(brak odpowiedzi)";
    res.status(200).json({ ok: true, result: outputText });
  } catch (e) {
    res.status(500).json({ error: "Server error" });
  }
}