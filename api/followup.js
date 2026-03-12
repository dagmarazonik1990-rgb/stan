import { saveFollowup } from "./_db.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  const { userId, decisionId, outcome, notes } = req.body || {};

  if (!userId || !decisionId || !outcome) {
    return res.status(400).json({ error: "userId, decisionId i outcome są wymagane." });
  }

  const decision = saveFollowup({ userId, decisionId, outcome, notes: notes || "" });
  if (!decision) {
    return res.status(404).json({ error: "Nie znaleziono decyzji do follow-upu." });
  }

  return res.status(200).json({ decision });
}
