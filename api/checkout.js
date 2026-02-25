import Stripe from "stripe";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const { deviceId } = req.body || {};

    if (!deviceId || typeof deviceId !== "string" || deviceId.length < 10) {
      return res.status(400).json({ error: "Missing deviceId" });
    }

    const appUrl = process.env.APP_URL?.replace(/\/$/, "");
    if (!appUrl) return res.status(500).json({ error: "Missing APP_URL" });

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      success_url: `${appUrl}/?pro=1`,
      cancel_url: `${appUrl}/?pro=0`,
      metadata: { deviceId }
    });

    return res.status(200).json({ url: session.url });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Checkout error" });
  }
}