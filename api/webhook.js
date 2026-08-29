// api/webhook.js
// WhatsApp Cloud API webhook — Satellite Data Translator
// Deploy as a Vercel serverless function

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// Durban coordinates (hardcode for MVP, generalize later)
const DURBAN_LAT = -29.8587;
const DURBAN_LNG = 31.0218;

export default async function handler(req, res) {
  // --- Webhook verification (Meta calls this once when you set up the webhook) ---
  if (req.method === "GET") {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.status(403).send("Verification failed");
  }

  // --- Incoming messages ---
  if (req.method === "POST") {
    try {
      const entry = req.body?.entry?.[0];
      const change = entry?.changes?.[0];
      const message = change?.value?.messages?.[0];

      if (!message) {
        // Could be a status update (delivered/read), not a real message — ignore
        return res.status(200).send("EVENT_RECEIVED");
      }

      const from = message.from; // sender's WhatsApp number
      const text = message.text?.body || "";

      const reply = await handleQuery(text);
      await sendWhatsAppMessage(from, reply);

      return res.status(200).send("EVENT_RECEIVED");
    } catch (err) {
      console.error("Webhook error:", err);
      return res.status(500).send("Internal error");
    }
  }

  return res.status(405).send("Method not allowed");
}

// --- Route the user's question to the right data source, then explain it via LLM ---
async function handleQuery(text) {
  const lower = text.toLowerCase();

  let rawData;
  let dataLabel;

  if (lower.includes("iss") || lower.includes("space station")) {
    rawData = await getISSPass();
    dataLabel = "ISS pass prediction";
  } else if (lower.includes("storm") || lower.includes("weather") || lower.includes("flare")) {
    rawData = await getSpaceWeather();
    dataLabel = "space weather / solar activity";
  } else {
    rawData = await getSpaceFact();
    dataLabel = "space fact";
  }

  return await explainWithAI(text, dataLabel, rawData);
}

// --- Data source: Open Notify (ISS pass predictions over Durban) ---
async function getISSPass() {
  const url = `https://api.g7vrd.co.uk/v1/satellite-passes/25544/${DURBAN_LAT}/${DURBAN_LNG}.json`;
  const res = await fetch(url);
  if (!res.ok) return { error: "Could not fetch ISS data right now." };
  return await res.json();
}

// --- Data source: NASA DONKI (space weather notifications) ---
async function getSpaceWeather() {
  const today = new Date().toISOString().split("T")[0];
  const url = `https://api.nasa.gov/DONKI/notifications?startDate=${today}&endDate=${today}&type=all&api_key=${process.env.NASA_API_KEY || "DEMO_KEY"}`;
  const res = await fetch(url);
  if (!res.ok) return { error: "Could not fetch space weather data right now." };
  return await res.json();
}

// --- Data source: NASA APOD (astronomy picture of the day + description) ---
async function getSpaceFact() {
  const url = `https://api.nasa.gov/planetary/apod?api_key=${process.env.NASA_API_KEY || "DEMO_KEY"}`;
  const res = await fetch(url);
  if (!res.ok) return { error: "Could not fetch a space fact right now." };
  return await res.json();
}

// --- Turn raw API data into a short, plain-language WhatsApp reply ---
async function explainWithAI(userQuestion, dataLabel, rawData) {
  const prompt = `You are a friendly assistant replying to a WhatsApp message.
User asked: "${userQuestion}"
Data type: ${dataLabel}
Raw data: ${JSON.stringify(rawData).slice(0, 2000)}

Reply in 2-4 short sentences, plain language, no jargon, suitable for a WhatsApp text.
If the data has an error, just say the info isn't available right now and suggest trying again shortly.`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await response.json();
  return data?.content?.[0]?.text || "Sorry, I couldn't work that out right now — try again in a bit.";
}

// --- Send reply back to the user via WhatsApp Cloud API ---
async function sendWhatsAppMessage(to, body) {
  const url = `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`;

  await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      text: { body },
    }),
  });
}
