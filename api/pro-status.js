import { kv } from "@vercel/kv";

export default async function handler(req, res) {
  try {
    const deviceId =
      req.query?.deviceId ||
      req.headers["x-device-id"];

    if (!deviceId || typeof deviceId !== "string") {
      return res.status(400).json({ pro: false, error: "Missing deviceId" });
    }

    const pro = (await kv.get(`pro:${deviceId}`)) === "1";
    return res.status(200).json({ pro });
  } catch (e) {
    return res.status(500).json({ pro: false, error: e?.message || "Error" });
  }
}