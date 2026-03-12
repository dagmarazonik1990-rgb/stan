import { createDemoUser, ensureUser, summarizeUser, listDecisionsForUser } from "./_db.js";

export default async function handler(req, res) {
  if (req.method === "POST") {
    const user = createDemoUser();
    return res.status(201).json({ user, decisions: [] });
  }

  if (req.method === "GET") {
    const userId = req.query.userId;
    if (!userId) {
      return res.status(400).json({ error: "userId jest wymagane." });
    }

    const user = ensureUser(userId);
    const decisions = listDecisionsForUser(userId);
    return res.status(200).json({ user: summarizeUser(user), decisions });
  }

  return res.status(405).json({ error: "Method not allowed." });
}
