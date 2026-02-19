export default function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  res.status(200).json({
    analysis: "Widzę kilka wątków. Ustal cel i ograniczenia. Teraz masz więcej emocji niż danych.",
    risk: "Ryzyko to działanie impulsywne albo odwlekanie decyzji w nieskończoność.",
    recommendation: "Zrób jeden mały krok dziś: spisz 2 opcje i ich konsekwencje w 7 oraz 30 dni."
  });
}