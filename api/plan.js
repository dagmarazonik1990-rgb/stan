import { updatePlan } from "./_db.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  const { userId, plan } = req.body || {};

  if (!userId || !plan) {
    return res.status(400).json({ error: "userId i plan są wymagane." });
  }

  const allowedPlans = ["free", "pro"];
  if (!allowedPlans.includes(plan)) {
    return res.status(400).json({ error: "Niepoprawny plan." });
  }

  const user = updatePlan(userId, plan);
  return res.status(200).json({ user });
}