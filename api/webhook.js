import Stripe from "stripe";
import { kv } from "@vercel/kv";

export const config = {
  api: { bodyParser: false }
};

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).send("Method not allowed");

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const sig = req.headers["stripe-signature"];
    const rawBody = await readRawBody(req);

    let event;
    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const deviceId = session?.metadata?.deviceId;

      if (deviceId) {
        // PRO flag
        await kv.set(`pro:${deviceId}`, "1");
        // (opcjonalnie) zapis czasu aktywacji
        await kv.set(`pro_since:${deviceId}`, String(Date.now()));
      }
    }

    return res.status(200).json({ received: true });
  } catch (e) {
    return res.status(500).send(e?.message || "Webhook error");
  }
}