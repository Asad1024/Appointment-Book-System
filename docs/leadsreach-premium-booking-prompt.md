# Leads Reach — premium booking flow (paste into Cursor)

**Context:** Slotwise now exposes secure short booking links and a minimal partner UI. Leads Reach must stop putting name, email, and phone in the URL. Use a modal to pick service/provider first, then open the short link.

**Slotwise API base:** `APPOINTMENT_API_URL` (e.g. `http://localhost:3003`)  
**Slotwise web base:** `APPOINTMENT_WEB_URL` (e.g. `http://localhost:3002`)

---

## 1. Create booking session (server-to-server)

When the user clicks **Book appointment** on a lead/deal, call:

`POST {APPOINTMENT_API_URL}/partner/v1/booking-sessions`  
Header: `Authorization: Bearer {stored_partner_api_key}`  
Body (JSON):

- `ref` — required, e.g. `lead_7377_deal_9` (existing format)
- `returnUrl` — required, CRM URL to return after booking (existing)
- `source` — optional, default `leadsreach`
- `customerName`, `customerEmail`, `customerPhone` — from lead row (never put in browser URL)
- `serviceId`, `providerId` — optional; set when user already chose them in your modal
- `leadLabel` — optional display string, e.g. `"Asad Shah · Deal #9"` for Slotwise header
- `campaign` — optional

Response:

- `url` — short link to open, e.g. `http://localhost:3002/b/a1b2c3d4e5f6` (15 min expiry)
- `expiresAt` — ISO timestamp
- `sessionId` — internal id

Open `url` in a new tab or iframe — **do not** build `/partner/book?...&name=...&email=...` anymore.

---

## 2. Modal UX (before opening Slotwise)

On **Book appointment** click:

1. If integration not connected → show connect flow (unchanged).
2. Open a **modal** (do not navigate away, do not open tab yet).
3. Load bookable pairs from existing `GET /api/integrations/appointment/services?base_id=...` (from stored bootstrap `pairs`), or re-fetch bootstrap if empty.
4. Modal content:
   - Title: “Book appointment”
   - Subtitle: lead name + company if available
   - **Service** dropdown (from pairs, unique by serviceId)
   - **Provider** dropdown (filtered by selected service)
   - If only one pair total → auto-select and skip dropdowns
   - Primary button: **Continue to schedule**
   - Secondary: **Copy booking link** (calls same POST booking-sessions, copies `url` to clipboard for WhatsApp/email)
5. On **Continue**:
   - `POST /partner/v1/booking-sessions` with lead fields + selected `serviceId` / `providerId`
   - `window.open(response.url, '_blank')` or embed iframe with `response.url`
   - Close modal

If user did **not** pick service/provider in modal, omit those ids — Slotwise shows its picker (legacy). Prefer always picking in modal so Slotwise opens **calendar only**.

---

## 3. Replace old URL builders

- Remove or stop using `appendLeadPrefillToBookingUrl` on long query-string URLs.
- `buildPartnerPickerUrl` → replace with `createBookingSession` API call.
- `resolveAppointmentBookingOpen` → always create session; return `{ url, mode: 'session' }` (or keep `picker` / `direct_link` labels but both use `url` from session).
- `createDirectBookingLink` → POST booking-sessions with serviceId + providerId instead of POST `/partner/v1/booking-links` then appending query params (booking-links can remain for copy-link API use cases if needed).

---

## 4. After booking returns

Keep existing `returnUrl` with `booked=true` query param. Optionally show toast on CRM: “Appointment booked — check Slotwise for details.” Webhook → CRM activity unchanged.

---

## 5. Environment

```
APPOINTMENT_API_URL=http://localhost:3003
APPOINTMENT_WEB_URL=http://localhost:3002
```

---

## 6. Success criteria

- Browser address bar shows only `http://localhost:3002/b/{shortToken}` — no email/phone in URL.
- Modal picks service/provider in Leads Reach when possible.
- Slotwise opens with calendar + pre-filled details, no main Slotwise navbar.
- Session expires in ~15 minutes if unused.

Do not modify Slotwise in this task — only Leads Reach frontend + `appointmentBooking.service.ts` + `appointmentIntegration.ts` routes.
