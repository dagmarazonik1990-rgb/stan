import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

function getBaseUrl(req) {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host;
  return `${proto}://${host}`;
}

function makeAccessToken(tier = "demo") {
  const payload = {
    tier,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30
  };

  const base64 = (obj) =>
    Buffer.from(JSON.stringify(obj))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");

  const header = base64({ alg: "none", typ: "JWT" });
  const body = base64(payload);

  return `${header}.${body}.x`;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { session_id } = req.query || {};

    if (!session_id) {
      return res.status(400).json({ error: "Missing session_id" });
    }

    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    if (session.payment_status !== "paid") {
      return res.status(200).json({
        ok: false,
        paid: false
      });
    }

    const tierRaw = session.metadata?.tier || "stan";

    let tier = "stan";
    if (tierRaw === "pro" || tierRaw === "semi") {
      tier = "pro";
    }

    const token = makeAccessToken(tier);

    return res.status(200).json({
      ok: true,
      paid: true,
      tier,
      token,
      redirect: `${getBaseUrl(req)}/`
    });

  } catch (error) {
    console.error("pro-status error:", error);

    return res.status(500).json({
      error: "Status check failed"
    });
  }
}