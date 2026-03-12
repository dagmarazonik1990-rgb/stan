import { getDecision } from "./_db.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  const { userId, decisionId } = req.query;

  if (!userId || !decisionId) {
    return res.status(400).json({ error: "userId i decisionId są wymagane." });
  }

  const decision = getDecision(userId, decisionId);
  if (!decision) {
    return res.status(404).json({ error: "Nie znaleziono decyzji." });
  }

  return res.status(200).json({ decision });
}
