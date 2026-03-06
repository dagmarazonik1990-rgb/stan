export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  try {

    const { text } = req.body

    if (!text) {
      return res.status(400).json({ error: "Brak opisu sytuacji" })
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {

      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },

      body: JSON.stringify({

        model: "gpt-4o-mini",

        messages: [

          {
            role: "system",
            content: `
Jesteś STAN.

Strategiczny doradca decyzji.

Twoje zadanie:

1. przeanalizować sytuację
2. znaleźć ryzyka
3. wskazać chaos decyzyjny
4. oszacować która opcja ma większe szanse

Nie moralizujesz.
Nie diagnozujesz ludzi.
Mówisz konkretnie.
`
          },

          {
            role: "user",
            content: text
          }

        ],

        temperature: 0.7

      })

    })

    const data = await response.json()

    const result = data.choices?.[0]?.message?.content || "Brak odpowiedzi"

    return res.status(200).json({
      analysis: result
    })

  } catch (error) {

    console.error(error)

    return res.status(500).json({
      error: "Błąd analizy"
    })

  }

}