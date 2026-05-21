# Leads Reach ↔ Slotwise — webhook testing

When a lead books from Leads Reach, Slotwise sends webhooks to your CRM. Leads Reach records **timeline activities** on the lead/deal (not a separate appointments table).

## What works today

| Slotwise event | When | Leads Reach (after updates below) |
|----------------|------|-----------------------------------|
| `appointment.booked` | Booking confirmed | Meeting activity on lead timeline |
| `appointment.cancelled` | Customer or admin cancels | Cancellation activity |
| `appointment.rescheduled` | Time changed | Reschedule activity |
| `appointment.status_changed` | Admin: checked in, completed, etc. | Status activity |

Payload includes `ref` (e.g. `lead_7377_deal_9`) so the CRM finds the correct lead.

---

## 1. One-time setup

### Slotwise (appointment API — port 3003)

1. **Admin → Settings → Integrations** (or org settings):
   - **Webhook URL:** Leads Reach inbound URL (see below)
   - **Webhook secret:** shared secret (e.g. `dev-appointment-webhook-secret-change-me`)
2. Or in root `.env`:
   ```
   WEBHOOK_URL=http://localhost:4000/api/webhooks/appointments
   WEBHOOK_SECRET=dev-appointment-webhook-secret-change-me
   ```
3. Create a **partner API key** for Leads Reach connect (if not already).

### Leads Reach backend (port 4000)

In `AiSalesCopilot-Backend/.env`:

```
APPOINTMENT_API_URL=http://localhost:3003
APPOINTMENT_WEB_URL=http://localhost:3002
APPOINTMENT_WEBHOOK_SECRET=dev-appointment-webhook-secret-change-me
WEBHOOK_BASE_URL=http://localhost:4000
```

`APPOINTMENT_WEBHOOK_SECRET` must **exactly match** Slotwise `WEBHOOK_SECRET` / org webhook secret.

On startup, logs should show:
`Appointment Booking: http://localhost:4000/api/webhooks/appointments`

Register **that URL** in Slotwise admin (not the Slotwise API URL).

### Local dev: Slotwise must reach Leads Reach

If both run on localhost, Slotwise (3003) POSTs to Leads Reach (4000) — that works without ngrok.

If Slotwise runs in Docker or another machine, use **ngrok** on Leads Reach:

```bash
ngrok http 4000
```

Set Slotwise webhook URL to `https://YOUR-ID.ngrok-free.app/api/webhooks/appointments`.

---

## 2. End-to-end test

1. Start **API 3003**, **web 3002**, **Leads Reach API 4000**, **Leads Reach web 3000**.
2. In Leads Reach: **Settings → Integrations → Appointment Booking** — connect with partner API key.
3. Open a **lead** (note lead id, e.g. `7377`) → **Book appointment** → pick service/provider → **Continue** → pick time → **Confirm**.
4. **Slotwise API logs:** `Webhook appointment.booked dispatched to ...`
5. **Leads Reach API logs:** `[AppointmentWebhook]` success (no 401).
6. **Leads Reach UI:** Lead drawer → timeline / activities → **Meeting booked: …**

### Cancel / reschedule / complete

| Action | Where | Expected webhook |
|--------|--------|------------------|
| Cancel | Slotwise admin calendar or customer manage link | `appointment.cancelled` |
| Reschedule | Manage link or admin | `appointment.rescheduled` |
| Check in / Complete | Slotwise admin appointment status | `appointment.status_changed` |

Each should add a new activity on the same lead (via `ref`).

---

## 3. Quick webhook test (curl)

Replace `SECRET` and lead ref as needed.

```powershell
$secret = "dev-appointment-webhook-secret-change-me"
$body = '{"event":"appointment.booked","timestamp":"2026-05-20T12:00:00.000Z","data":{"appointmentId":"test-1","status":"confirmed","customerEmail":"asadshah1024@gmail.com","customerName":"Asad Shah","serviceName":"Discovery Call","startUtc":"2026-05-21T09:00:00.000Z","ref":"lead_7377_deal_9","source":"leadsreach"}}'
$hmac = New-Object System.Security.Cryptography.HMACSHA256
$hmac.Key = [Text.Encoding]::UTF8.GetBytes($secret)
$sig = ([BitConverter]::ToString($hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($body))).Replace('-','')).ToLower()
Invoke-WebRequest -Uri "http://localhost:4000/api/webhooks/appointments" -Method POST -ContentType "application/json" -Headers @{ "X-Webhook-Signature" = $sig } -Body $body
```

Expect `200` and `{ "received": true }`. Check lead `7377` for a new meeting activity.

---

## 4. Troubleshooting

| Symptom | Fix |
|---------|-----|
| No webhook in Slotwise logs | Set org webhook URL or `WEBHOOK_URL` in `.env`; restart API |
| `401 Invalid signature` on Leads Reach | Match `APPOINTMENT_WEBHOOK_SECRET` ↔ Slotwise secret exactly |
| Webhook OK but no CRM activity | Payload missing `ref` — re-book after Slotwise update; or lead id wrong |
| Activity on wrong lead | `ref` must be `lead_{id}` or `lead_{id}_deal_{dealId}` from booking session |
| Return after book works, no webhook | Check API console on confirm; booking may have failed validation |

---

## 5. Cursor prompt — Leads Reach repo

Paste into Cursor in **AiSalesCopilot-Backend** (and frontend if needed):

```
Update Leads Reach appointment webhooks to match Slotwise partner booking.

Context:
- Slotwise sends POST JSON to /api/webhooks/appointments with header X-Webhook-Signature (HMAC-SHA256 hex of raw body).
- Secret: APPOINTMENT_WEBHOOK_SECRET (must match Slotwise org webhook secret).
- Payload data includes ref (e.g. lead_7377_deal_9), appointmentId, status, serviceName, startUtc, customerEmail.

Tasks:
1. In appointmentBooking.service.ts processAppointmentWebhook:
   - Handle appointment.status_changed (in addition to booked, cancelled, rescheduled).
   - For status_changed: createActivity with subject like "Appointment checked in: {service}" or "Appointment completed: {service}" using data.newStatus (checked_in, completed, confirmed, etc.).
   - Parse data.ref for lead/deal linking (already done via parseBookingRef).

2. In activityCopyForEvent: add copy for appointment.status_changed based on newStatus.

3. Ensure .env.example documents APPOINTMENT_WEBHOOK_SECRET and WEBHOOK_BASE_URL.

4. Do not change Slotwise; only Leads Reach.

Test: book from lead drawer → timeline shows meeting; cancel in Slotwise admin → cancellation activity; mark completed → status activity.
```

---

## Slotwise changes (this repo)

- Webhook payload now includes **`ref`** from booking `metadata`.
- Admin status updates fire **`appointment.status_changed`** with `previousStatus` / `newStatus`.

No Leads Reach UI changes required for basic flow — activities appear on the lead/deal timeline.
