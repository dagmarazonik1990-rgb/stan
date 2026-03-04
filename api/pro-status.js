import Stripe from "stripe";
import crypto from "crypto";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

function signJwt(payload, secret, expSeconds = 60 * 60 * 24 * 30) {
  const header = { alg: "HS256", typ: "JWT" };
  const exp = Math.floor(Date.now() / 1000) + expSeconds;

  const body = { ...payload, exp };

  const b64 = (obj) =>
    Buffer.from(JSON.stringify(obj))
      .toString("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

  const h = b64(header);
  const p = b64(body);
  const data = `${h}.${p}`;

  const sig = crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${data}.${sig}`;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { session_id } = req.query || {};
    if (!session_id) {
      return res.status(400).json({ error: "Brak session_id." });
    }

    if (!process.env.STAN_JWT_SECRET) {
      return res.status(500).json({ error: "Brak STAN_JWT_SECRET w env." });
    }

    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ["subscription", "line_items"],
    });

    if (!session) {
      return res.status(404).json({ error: "Nie znaleziono sesji." });
    }

    // Musi być subskrypcja
    const sub = session.subscription;
    if (!sub || typeof sub !== "object") {
      return res.status(403).json({ error: "Brak subskrypcji w tej sesji." });
    }

    // Aktywna / trialing => OK
    const ok = ["active", "trialing"].includes(sub.status);
    if (!ok) {
      return res.status(403).json({ error: `Subskrypcja nieaktywna: ${sub.status}` });
    }

    // Ustal tier po cenie
    const items = sub.items?.data || [];
    const priceIds = new Set(items.map((it) => it.price?.id).filter(Boolean));

    const stan = process.env.PRICE_ID_STAN;
    const pro = process.env.PRICE_ID_STAN_PRO;

    let tier = "stan";
    if (pro && priceIds.has(pro)) tier = "pro";
    else if (stan && priceIds.has(stan)) tier = "stan";

    const token = signJwt(
      {
        tier,
        customer: session.customer || null,
        subscription: sub.id,
      },
      process.env.STAN_JWT_SECRET,
      60 * 60 * 24 * 30 // 30 dni
    );

    return res.status(200).json({ tier, token });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Status error" });
  }
}