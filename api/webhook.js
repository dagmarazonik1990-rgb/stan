import Stripe from "stripe";

export const config = {
  api: { bodyParser: false },
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

    const sig = req.headers["stripe-signature"];
    const whsec = process.env.STRIPE_WEBHOOK_SECRET;
    if (!sig || !whsec) return res.status(400).send("Missing signature/webhook secret");

    const rawBody = await readRawBody(req);

    const event = stripe.webhooks.constructEvent(rawBody, sig, whsec);

    // Minimal: logika pod przyszłość (np. blokada PRO po cancel)
    // Bez bazy danych nie cofniemy tokenów na urządzeniach, ale webhook jest gotowy.
    switch (event.type) {
      case "customer.subscription.deleted":
      case "customer.subscription.updated":
      case "invoice.payment_failed":
      case "invoice.paid":
        // tu w przyszłości podepniesz bazę (Supabase) i status użytkownika
        break;
      default:
        break;
    }

    res.json({ received: true });
  } catch (err) {
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
}