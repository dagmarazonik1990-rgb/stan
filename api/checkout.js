import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {

    const { tier } = req.body || {};

    if (!tier) {
      return res.status(400).json({ error: "Missing tier" });
    }

    let priceId;

    if (tier === "orb") {
      priceId = process.env.STRIPE_PRICE_ORB;
    }

    if (tier === "semi") {
      priceId = process.env.STRIPE_PRICE_SEMI;
    }

    if (!priceId) {
      return res.status(400).json({ error: "Invalid tier" });
    }

    const session = await stripe.checkout.sessions.create({

      payment_method_types: ["card"],

      mode: "payment",

      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],

      success_url: `${process.env.APP_URL}/?success=true`,
      cancel_url: `${process.env.APP_URL}/?cancel=true`,

      metadata: {
        tier
      }

    });

    return res.status(200).json({
      url: session.url
    });

  } catch (error) {

    console.error("Checkout error:", error);

    return res.status(500).json({
      error: "Checkout failed"
    });
  }
}