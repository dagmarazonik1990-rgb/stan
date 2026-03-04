import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

function baseUrl(req) {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { plan } = req.body || {};
    const priceStan = process.env.PRICE_ID_STAN;
    const pricePro = process.env.PRICE_ID_STAN_PRO;

    if (!priceStan || !pricePro) {
      return res.status(500).json({ error: "Brak PRICE_ID w env (PRICE_ID_STAN / PRICE_ID_STAN_PRO)." });
    }

    const price =
      plan === "pro" ? pricePro :
      plan === "stan" ? priceStan :
      null;

    if (!price) {
      return res.status(400).json({ error: "Nieprawidłowy plan. Użyj 'stan' albo 'pro'." });
    }

    const url = baseUrl(req);

    // Subskrypcja miesięczna
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      allow_promotion_codes: true,

      // Wróć do aplikacji z session_id
      success_url: `${url}/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${url}/?canceled=1`,

      // Zbieramy mail — przyda się w Stripe i ewentualnym support
      customer_creation: "always",
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Checkout error" });
  }
}