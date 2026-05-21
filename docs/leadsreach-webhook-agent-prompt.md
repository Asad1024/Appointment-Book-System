# Leads Reach agent prompt — Slotwise webhook integration

Copy everything below the line into Cursor in the **Leads Reach** repos (`AiSalesCopilot-Backend` + `AI-Sales-Copilot-Frontend`). Do **not** modify Slotwise.

---

## Prompt (paste from here)

You are implementing the **Slotwise (Appointment Booking) → Leads Reach CRM webhook** flow end-to-end. Slotwise is already done on the other repo. Your job is to make Leads Reach receive webhooks and show booking lifecycle on leads/deals.

### Architecture

1. User books from Leads Reach (lead/deal drawer → Book appointment modal → Slotwise `/b/{token}`).
2. Leads Reach backend creates a session via `POST {APPOINTMENT_API_URL}/partner/v1/booking-sessions` with:
   - `ref`: `lead_{leadId}` or `lead_{leadId}_deal_{dealId}` (use existing `buildBookingRef`)
   - `returnUrl`, customer fields, optional `serviceId` / `providerId`
3. After confirm, Slotwise POSTs webhooks to Leads Reach:
   - **URL:** `{WEBHOOK_BASE_URL}/api/webhooks/appointments`
   - **Header:** `X-Webhook-Signature` = HMAC-SHA256 hex of **raw** JSON body
   - **Secret:** must match `APPOINTMENT_WEBHOOK_SECRET` in Leads Reach `.env` and Slotwise admin webhook secret

### Webhook events (Slotwise sends)

| Event | When |
|-------|------|
| `appointment.booked` | Booking confirmed |
| `appointment.cancelled` | Cancelled (customer or admin) |
| `appointment.rescheduled` | Start time changed |
| `appointment.status_changed` | Admin status change (e.g. `checked_in`, `completed`) — payload includes `previousStatus`, `newStatus` |

### Example payload (`appointment.booked`)

```json
{
  "event": "appointment.booked",
  "timestamp": "2026-05-20T12:00:00.000Z",
  "data": {
    "appointmentId": "uuid",
    "status": "confirmed",
    "customerEmail": "user@example.com",
    "customerName": "Jane Doe",
    "serviceId": "uuid",
    "serviceName": "Discovery Call",
    "providerId": "uuid",
    "providerName": "John Smith",
    "locationId": "uuid",
    "startUtc": "2026-05-21T09:00:00.000Z",
    "endUtc": "2026-05-21T09:45:00.000Z",
    "source": "leadsreach",
    "ref": "lead_7377_deal_9",
    "rescheduleCount": 0
  }
}
```

**Critical:** `data.ref` links the webhook to the CRM lead. Without it, fall back to email match only.

---

### Backend tasks (`AiSalesCopilot-Backend`)

#### 1. Verify webhook route (do not break raw body)

- Route: `POST /api/webhooks/appointments` in `src/routes/appointmentWebhook.ts`
- Must use `express.raw({ type: "application/json" })` **before** `express.json()` in `app.ts` (already wired — confirm).
- Verify signature with `verifyAppointmentWebhookSignature(rawBody, x-webhook-signature)`.

#### 2. `appointmentBooking.service.ts` — `processAppointmentWebhook`

Ensure all four events are handled and call `createActivity`:

- Parse `data.ref`, `data.appointmentId`, `data.serviceName`, `data.startUtc`, `data.newStatus`, `data.previousStatus`, `data.customerEmail`.
- Use `parseBookingRef(ref)` → `{ leadId, dealId }`.
- Find lead: prefer ref → `Lead.findByPk(leadId)`; else email fallback.
- `createActivity` with:
  - `type: "meeting"`
  - `lead_id`, `deal_id` (from ref)
  - `occurred_at`: `startUtc` or now
  - `metadata`: `{ appointmentId, event, ref, serviceName, status, source: "appointment_booking" }`

Activity copy:

| Event | Subject example |
|-------|-----------------|
| `appointment.booked` | `Appointment booked: Discovery Call` |
| `appointment.cancelled` | `Appointment cancelled: Discovery Call` |
| `appointment.rescheduled` | `Appointment rescheduled: Discovery Call` |
| `appointment.status_changed` | `Appointment completed: Discovery Call` (use human label from `newStatus`: checked_in → "checked in", completed → "completed") |

If lead not found: log warning, return `{ ok: true }` (do not 500 — Slotwise should not retry forever).

#### 3. Booking session must send `ref`

In `createBookingSession` / `resolveAppointmentBookingOpen`, confirm body includes:

```ts
ref: buildBookingRef(params.leadId, params.dealId),
source: "leadsreach",
```

Already expected — verify not regressed.

#### 4. Environment (`.env.example` + comments)

```env
APPOINTMENT_API_URL=http://localhost:3003
APPOINTMENT_WEB_URL=http://localhost:3002
APPOINTMENT_WEBHOOK_SECRET=shared-secret-same-as-slotwise-admin
WEBHOOK_BASE_URL=http://localhost:4000
```

Document: Slotwise admin must register webhook URL = `{WEBHOOK_BASE_URL}/api/webhooks/appointments` with the **same** secret.

#### 5. Dev signature behavior

`verifyAppointmentWebhookSignature`: if `APPOINTMENT_WEBHOOK_SECRET` unset, allow in non-production only (existing pattern). Production must reject.

#### 6. Logging (help debugging)

On success: `[AppointmentWebhook] {event} lead={leadId} appointment={appointmentId}`  
On 401: `[AppointmentWebhook] Invalid signature`  
On missing lead: `[AppointmentWebhook] No lead for ref=... email=...`

---

### Frontend tasks (`AI-Sales-Copilot-Frontend`)

#### 1. Integrations hub (`IntegrationsHub.tsx`)

When appointment integration connected, show:

- Webhook URL from `GET /api/integrations/appointment/status` → `webhook_url` (read-only, copy button).
- Short note: paste this URL + `APPOINTMENT_WEBHOOK_SECRET` into **Slotwise Admin → Settings → Integrations**.

#### 2. After booking return (`?booked=true`)

`useAppointmentBookedToast` already shows toast. **Also:**

- On leads page / CRM page when `booked=true` in URL: **refetch lead activities** (or invalidate React Query cache) so the webhook-created activity appears without manual refresh.
- If `deal_id` in URL, refetch deal activities too.

#### 3. Timeline / activities UI

- Ensure `type: "meeting"` activities render with a calendar-style icon (not generic note).
- In activity row metadata, if `metadata.appointmentId` exists, optional subtitle: `Slotwise · {serviceName}` from metadata.
- Do **not** build a full appointments CRUD module unless trivial — timeline activities are enough for v1.

#### 4. Book appointment modal

No webhook changes needed if session API sends `ref`. Confirm `createAppointmentBookingSession` posts `leadId`, `dealId`, `serviceId`, `providerId` to backend.

---

### Manual test checklist (run after implementation)

1. Set matching secrets on both apps; register webhook URL in Slotwise admin.
2. Connect integration in Leads Reach settings with partner API key.
3. Open lead #7377 → Book appointment → complete booking on Slotwise.
4. Slotwise API log: `Webhook appointment.booked dispatched`.
5. Leads Reach: `200` on `/api/webhooks/appointments`.
6. Lead timeline: new **Appointment booked** activity.
7. In Slotwise admin: cancel appointment → timeline shows **cancelled** activity.
8. In Slotwise admin: mark **completed** → timeline shows **completed** activity.
9. curl test (PowerShell) against `http://localhost:4000/api/webhooks/appointments` with HMAC body including `"ref":"lead_7377"` → activity created.

### Out of scope

- Do not change Slotwise / Appointment Booking System repo.
- No new database tables for appointments in v1 (activities only).
- ngrok only if Slotwise cannot reach localhost:4000.

### Files likely touched

**Backend:**  
`src/services/integrations/appointmentBooking.service.ts`  
`src/routes/appointmentWebhook.ts`  
`src/app.ts` (confirm raw middleware order)  
`src/config/webhooks.ts`  
`.env.example`

**Frontend:**  
`app/settings/IntegrationsHub.tsx`  
`hooks/useAppointmentBookedToast.ts` or leads/CRM pages using it  
Lead/deal activity list components (icon for `meeting` type)

Deliver working code + brief summary of what was verified vs added.

---

## End of prompt
