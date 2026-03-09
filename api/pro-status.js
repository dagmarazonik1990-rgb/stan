export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {

    const { email } = req.body || {};

    if (!email) {
      return res.status(400).json({ error: "Missing email" });
    }

    // na razie prosty status
    // później webhook będzie zapisywał userów PRO

    const proUsers = [
      // przykładowo
      "test@stan.app"
    ];

    const semiUsers = [
      // przykładowo
    ];

    let tier = "free";

    if (proUsers.includes(email)) {
      tier = "orb";
    }

    if (semiUsers.includes(email)) {
      tier = "semi";
    }

    return res.status(200).json({
      tier
    });

  } catch (error) {

    console.error("Status error:", error);

    return res.status(500).json({
      error: "Status check failed"
    });
  }
}