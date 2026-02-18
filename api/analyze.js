export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { text } = req.body;

    if (!text || text.length < 20) {
      return res.status(400).json({ error: "Za krótki tekst." });
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: `
Jesteś STANEM – bezlitosnym, inteligentnym analitykiem sytuacji międzyludzkich.
Analizujesz bez cukrowania. W punktach.
Na końcu dajesz werdykt: kto ma rację i dlaczego.

Sytuacja:
${text}
        `
      })
    });

    const data = await response.json();

    res.status(200).json({
      result: data.output[0].content[0].text
    });

  } catch (error) {
    res.status(500).json({ error: "Błąd serwera." });
  }
}