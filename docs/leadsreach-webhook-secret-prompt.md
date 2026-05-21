# Leads Reach — webhook signing secret (paste into Cursor)

Slotwise now **auto-generates** the webhook signing secret when an admin saves a webhook URL. Leads Reach must **verify** that secret — admins copy `whsec_…` from Slotwise admin into Leads Reach.

---

## Prompt

Update Leads Reach for the new Slotwise webhook signing flow.

### What changed on Slotwise

- Admin enters **only** webhook URL in Slotwise → system generates `whsec_…` signing secret (shown once).
- Slotwise signs every webhook: header `X-Webhook-Signature` = HMAC-SHA256 hex of raw body.
- Partners must **not** invent their own secret; they use the value copied from Slotwise admin.

### Leads Reach tasks

1. **Connect / Integrations UI** (`IntegrationsHub.tsx`):
   - Remove any instruction that says “set the same secret in both .env files manually”.
   - Add: “After connecting, copy the **signing secret** from Slotwise Admin → Settings → Integrations → Outbound webhooks into `APPOINTMENT_WEBHOOK_SECRET` on this server.”
   - Optional: add optional password field **Webhook signing secret** on connect form → save to integration config or document that it must go in server `.env` only (preferred: keep server env only for security).

2. **Backend** (`appointmentBooking.service.ts`):
   - `verifyAppointmentWebhookSignature` already uses `APPOINTMENT_WEBHOOK_SECRET` — no change if env is set correctly.
   - Log on success: `[AppointmentWebhook] verified {event} lead={id}`.

3. **`.env.example`**:
   ```
   # Copy whsec_… from Slotwise Admin → Integrations → Outbound webhooks (shown once when URL is saved)
   APPOINTMENT_WEBHOOK_SECRET=whsec_...
   ```

4. **Status endpoint** (`GET /api/integrations/appointment/status`):
   - Return `webhook_url` (Leads Reach inbound URL for display) — already may exist.
   - Do **not** return the signing secret via API.

### Partner setup steps (document in UI)

1. Leads Reach owner: note webhook URL from API startup log: `{WEBHOOK_BASE_URL}/api/webhooks/appointments`
2. Slotwise admin: paste that URL → Save → copy `whsec_…`
3. Leads Reach DevOps: set `APPOINTMENT_WEBHOOK_SECRET=whsec_…` → restart API
4. Book test appointment → timeline activity appears

Do not modify Slotwise repo.
