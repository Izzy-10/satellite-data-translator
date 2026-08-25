# Satellite Data Translator — WhatsApp Bot

AI Builders Challenge (August) — Advance Space Exploration with AI
By Sizwe Sicelimilo Sibiya

## What it does
Users text plain-language space questions to a WhatsApp number. The bot pulls
real data (ISS position, space weather, or a daily space fact) and replies
in simple, human language via an LLM.

## Supported queries (MVP)
- "When can I see the ISS from Durban?" → ISS pass prediction
- "Is there a solar storm today?" → NASA space weather alert
- Anything else → daily space fact (NASA APOD)

## Setup

1. **Deploy to Vercel**
   ```
   vercel deploy
   ```

2. **Set environment variables** (Vercel dashboard → Settings → Environment Variables)
   See `.env.example` for the full list.

3. **Connect the WhatsApp webhook**
   - Meta Developer Dashboard → your app → WhatsApp → Configuration
   - Callback URL: `https://<your-vercel-domain>/api/webhook`
   - Verify token: same value as `WHATSAPP_VERIFY_TOKEN`
   - Subscribe to the `messages` field

4. **Test**
   - Send a WhatsApp message to your test number: "when can I see the ISS from Durban"
   - Check Vercel function logs if no reply comes through

## Next steps (after MVP)
- Add location detection instead of hardcoded Durban
- Add satellite tracking beyond ISS (N2YO API)
- Cache API responses to avoid rate limits
- Add a simple project page with demo screenshots/video for submission
