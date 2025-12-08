# Chain – Farmer & Consumer Circular Food Platform

consumer url: https://chain-bl.netlify.app
farmer url: https://agrisense-hero.netlify.app

for .env variables contact to the admin (Sajid). +8801788040850 Whatsapp

Chain is a two-sided platform that links smallholder farmers with household consumers to reduce crop loss, lower food prices, and minimize waste. Both web and voice channels expose the same workflows so users can act even without the app open. Daily SMS alerts, outbound/interactive voice calls, and low-cost IoT hardware keep everyone connected to real-time insights.

## Banglalink API Integration

Chain leverages **Banglalink AppLink APIs** for SMS and subscription management across both portals:

### SMS API Usage
- **Farmer Portal**: Daily SMS alerts sent to farmers with critical farm insights, moisture threshold warnings, scheduled analytics summaries, and field health updates.
- **Consumer Portal**: Order delivery SMS notifications sent to consumers when orders are dispatched, delivered, or require action.

### Subscription API Usage
- **Consumer Portal**: Premium subscription management for advanced features including:
  - AI-powered nutrition assistant with personalized recommendations
  - Advanced recipe suggestions with budget optimization
  - Enhanced meal planning and nutrient gap analysis
  - Priority support and early access to new features

The subscription API handles subscription creation, renewal, cancellation, and payment processing, enabling users to unlock premium AI-driven features that enhance their food management experience.

## Repository Structure
- `Farmer/backend` – Node/Express APIs for farm analytics, satellite/IoT ingestion, pricing, SMS/voice, and device management.
- `Farmer/frontend` – React + Vite dashboard for farmers and admins.
- `Farmer/hardware_Code.ino` – ESP32 firmware (WiFi + GSM fallback) for soil/moisture sensing and alerts; can be mounted on kitchen/fridge magnets for quick logging prompts.
- `Consumer/backend` – Node/Express APIs for inventory logs, nutrition/recipe AI, donations, store, rewards, and notifications.
- `Consumer/frontend` – React + Vite consumer web app (PWA-ready with push).

## What Chain Delivers
- End-to-end farm intelligence: IoT sensors, satellite-derived field analysis, local weather, and AI guidance in Bangla/English.
- Multichannel support: every key flow works via web UI **and** voice; critical items also go out as SMS.
- Market linkage: farmers view live market prices and list/sell produce directly.
- Household food OS: inventory tracking, spoilage alerts, recipe + nutrition guidance, and budget-aware shopping.
- Circular economy: households donate organic/agro waste for fertilizer processing, earn rewards, and buy farmer-grown items cheaply in the integrated store.
- Hardware nudges: kitchen/fridge-mounted device reminders to log usage and reduce waste.

## Farmer Portal – Core Capabilities
- Device linking & live telemetry: secure API-keyed ingestion from ESP32 sensors; current + historical views.
- Satellite & field analytics: NDVI/NDMI/EVI, water stress, soil moisture, irrigation recommendations, and field health trends.
- Weather-aware advisory: current + forecasted conditions stitched into AI guidance.
- AI & chatbot: Bengali/English advisory, JSON-validated reports; context-aware chat.
- Voice flows: Retell-powered outbound/interactive calls for guidance and data capture; farmer data lookup by phone.
- SMS/voice alerts: moisture thresholds, scheduled morning analytics, and critical event notifications.
- Market + selling: daily market prices, farmer product listings, and admin price controls.
- Waste & inputs: classify farm waste (pesticide/fertilizer candidates) and route for pickup/processing.

## Consumer Portal – Core Capabilities
- Inventory & logs: daily inventory tracking, consumption logs, and expiry/“expiring soon” alerts (push/SMS/voice capable).
- Recipes & nutrition: AI recipes prioritizing soon-to-expire items; nutrient gap detection from logs; budget-aware meal plans and substitution guidance.
- Budget + family profiles: household member data and monthly budgets drive recommendations.
- Store: low-cost items sourced from farmer portal supply; checkout with Stripe-ready flows.
- Donations & pickups: nearby food-sharing (human/animal) options; organic/agro waste pickup requests routed to fertilizer processing; rewards issued for each contribution.
- Messaging & notifications: in-app chat/updates, push notifications, and SMS cadence.
- Voice parity: key actions (status, recommendations, donations) available via voice endpoints.

## Circular Loop in Practice
1) Farmers get higher yields/less loss via sensors + satellite + AI → production cost drops.  
2) Their produce feeds the consumer store at lower prices → consumers buy here first.  
3) Consumer logs identify agro/organic waste; flagged items are collected, processed into low-cost fertilizer.  
4) Fertilizer returns to farmers cheaply, reinforcing profitability; consumers earn rewards, keeping them engaged.

## Tech Stack
- Node.js + Express (APIs), Supabase (Postgres), node-cron scheduling
- React + Vite frontends; PWA/push on consumer side
- OpenAI for analytics/recipes/nutrition; Bengali/English localization
- Retell AI for voice; ElevenLabs/Realtime services present in farmer stack
- **Banglalink AppLink APIs**: SMS API for daily farmer alerts and order delivery notifications; Subscription API for consumer premium features
- Stripe client (consumer payments), Supabase auth/JWT for sessions
- ESP32 (WiFi + GSM) firmware for sensing and kitchen/fridge prompts

## Prerequisites
- Node.js 18+ and npm
- Supabase project (URL, Service Role key, Anon key)
- OpenAI API key
- **Banglalink AppLink account**: Application ID and API password for SMS API (farmer alerts + consumer order delivery) and Subscription API (consumer premium features)
- Optional: Retell (voice), Stripe keys (consumer store), weather API key, public URLs for webhooks

## Quick Start
### Farmer stack
```bash
cd Farmer/backend
npm install
cp .env.example .env   # fill Supabase, OpenAI, JWT_SECRET, RETELL*, WEATHER_API_KEY, INTERNAL_API_TOKEN, CALL_ALERT_ENDPOINT, SATELLITE_API_URL, AGRISENSE_BACKEND_URL
npm run dev            # API on http://localhost:5000

cd ../frontend
npm install
cp .env.example .env   # set VITE_API_BASE_URL=http://localhost:5000/api
npm run dev            # UI on http://localhost:5173
```

### Consumer stack
```bash
cd Consumer/backend
npm install
cp .env.example .env   # fill SUPABASE_URL/KEYS, JWT_SECRET, OPENAI_API_KEY, optional APPLINK_* and Stripe keys
npm run dev            # API on http://localhost:5000 (default)

cd ../frontend
npm install
cp .env.example .env   # VITE_API_URL=http://localhost:5000
npm run dev            # UI on http://localhost:5173 (or per Vite)
```

## Key Environment Variables
- Farmer backend: `PORT`, `JWT_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `WEATHER_API_KEY`, `OPENAI_API_KEY`, `RETELL_API_KEY`, `RETELL_AGENT_ID`, `RETELL_PHONE_NUMBER`, `AGRISENSE_BACKEND_URL`, `INTERNAL_API_TOKEN`, `CALL_ALERT_ENDPOINT`, `SATELLITE_API_URL`. **Banglalink AppLink**: `APPLINK_APPLICATION_ID`, `APPLINK_PASSWORD`, `APPLINK_BASE_URL` (for daily SMS alerts).
- Farmer frontend: `VITE_API_BASE_URL`.
- Consumer backend: `PORT`, `CLIENT_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, `OPENAI_API_KEY`, `CORS_ALLOW_ALL`, **Banglalink AppLink**: `APPLINK_APPLICATION_ID`, `APPLINK_PASSWORD`, `APPLINK_BASE_URL` (for SMS API - order delivery notifications, and Subscription API - premium features), Stripe keys.
- Consumer frontend: `VITE_API_URL`.

## Notable Flows & Scheduling
- Farmer cron jobs: daily analytics (07:00 Asia/Dhaka), moisture checks every 2 hours, SMS/voice alert dispatchers. **Banglalink SMS API** sends daily farm insights, moisture warnings, and critical alerts to farmers.
- Voice: `POST /api/voice/retell-webhook` and `POST /api/voice/get-farmer-data` expose farm + weather + field analysis during calls; unauth endpoints kept for IVR/agent access.
- Satellite: `routes/satellite.js` and `services/scheduledFieldAnalysisService.js` handle imagery pulls and NDVI/NDMI processing.
- Waste & pickup: farmer waste classification plus consumer donation/waste routes feed fertilizer processing and rewards.
- Store: consumer `storeRoutes`, inventory pricing updates (`update-prices.js`), Stripe client ready in `config/stripeClient.js`. **Banglalink SMS API** sends order delivery notifications.
- Messaging/notifications: consumer push subscriptions (`006_create_push_subscriptions.sql`), notification routes, and SMS hooks. **Banglalink Subscription API** manages premium feature access (AI assistant, advanced recipes, nutrition analysis).

## Database & Migrations
- Consumer migrations live in `Consumer/backend/migrations`; run with `node run-migration.js` or `npm run migrate` (if script defined).
- Supabase tables are assumed for both portals; see migration files and code for schemas (`users`, `devices`, `sensor_data_history`, `field_analyses`, `products`, `donations`, `orders`, `nutrition_logs`, `push_subscriptions`, etc.).

## Hardware Notes
- `Farmer/hardware_Code.ino` targets ESP32 with WiFi primary and GSM fallback; posts sensor JSON to `/api/device/sensor-data` and can send SMS on connectivity loss.
- Designed to mount on a fridge or stove magnet for quick reminders to log inventory/usage.

## Running Both Portals Together
Open four terminals (or background processes):
```
Farmer/backend  : npm run dev
Farmer/frontend : npm run dev
Consumer/backend: npm run dev
Consumer/frontend: npm run dev
```
Adjust ports in `.env` files as needed and align `VITE_API_*` URLs.

## Testing & Verification
- Hit health/auth routes after boot: `/api/auth/login`, `/api/device/my-devices` (farmer), `/api/auth/login`, `/api/inventory` (consumer).
- For voice, expose the farmer backend publicly (ngrok) and register the webhook URL with Retell.
- For push/SMS, ensure Applink/FCM credentials and service worker (`Consumer/frontend/public/sw.js`) are served over HTTPS.

## Production Tips
- Set strong `JWT_SECRET` values and rotate keys on compromise.
- Keep `INTERNAL_API_TOKEN` private; used for trusted internal calls.
- Configure CORS origins to deployed frontends.
- Run cron jobs in a single instance to avoid duplicate alerts.
- Cache-heavy AI responses (recipes/nutrition) can be memoized in Supabase (`nutrient_cache` table present).

Chain keeps farmers profitable, consumers healthy, and waste valuable—closing the loop with AI, voice, and affordable hardware.*** End Patch​​