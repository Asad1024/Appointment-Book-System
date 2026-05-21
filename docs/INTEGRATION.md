# Product integration guide

Connect other company products to this booking system so users can book demos without leaving your funnel.

## Quick links (local dev)

| Use case | URL |
|----------|-----|
| Full-page booking | `http://localhost:3002/book?product=demo&source=pricing` |
| Return after booking | Add `&returnUrl=https://your-product.com/thanks` |
| Embedded iframe | `http://localhost:3002/embed/book?product=demo&source=footer` |
| **Filled link (Cal-like, one page)** | `http://localhost:3002/book/event?org=demo-company&serviceId=...&providerId=...` |
| **Partner picker (Leads Reach)** | `http://localhost:3002/partner/book?org=demo-company&source=leadsreach&ref=lead_1&returnUrl=...&name=...&email=...&phone=...` |

Partner URLs use **minimal chrome** (no site navbar). Pass lead prefill via `name`, `email`, `phone` query params — see [leadsreach-booking-prefill.md](./leadsreach-booking-prefill.md).
| Filled link API | `GET http://localhost:3003/integration/booking-event?org=demo-company&serviceId=...&providerId=...` |
| Integration context API | `GET http://localhost:3003/integration/context?org=demo-company&product=demo` |

## 1. Map products to services

Each `Service` can have a `productKey` (e.g. `crm`, `analytics`, `demo`). When `product` is passed in the URL, only services for that product are shown.

Seed example: **Product Demo** service has `productKey: demo`.

## 2. Link from your product

### New tab (recommended)

```html
<a
  href="https://book.yourcompany.com/book?product=crm&source=pricing-page&campaign=q2"
>
  Book a demo
</a>
```

### Return to your app after booking

```html
<a
  href="https://book.yourcompany.com/book?product=crm&source=pricing&returnUrl=https://yourapp.com/demo-scheduled"
>
  Book a demo
</a>
```

After confirmation, the user is redirected to `returnUrl?booked=true&appointmentId=<uuid>` (2 second delay).

### Embed in an iframe

```html
<iframe
  src="https://book.yourcompany.com/embed/book?product=crm&source=in-app"
  width="100%"
  height="720"
  style="border:0;border-radius:8px"
  title="Book a demo"
></iframe>
```

Configure allowed parent origins on the organization (`allowedEmbedOrigins` JSON array in the database).

## 3. Filled booking links (one page)

Use when service and provider are already chosen (sales call, CRM, generated link).

```
http://localhost:3002/book/event?org=demo-company&serviceId=<uuid>&providerId=<uuid>&source=leadsreach
```

After seed, demo filled link (Product Demo + John Smith):

```
http://localhost:3002/book/event?org=demo-company&serviceId=11111111-1111-4111-8111-111111111102&providerId=11111111-1111-4111-8111-111111111201&source=demo
```

Embed:

```
http://localhost:3002/embed/book/event?org=demo-company&serviceId=...&providerId=...
```

Resolve metadata (public):

```
GET /integration/booking-event?org=demo-company&serviceId=...&providerId=...
```

Pretty URLs (recommended when slugs are set):

```
http://localhost:3002/book/john-smith/product-demo?org=demo-company&source=sales-call
```

Legacy ID URLs still work:

```
http://localhost:3002/book/event?org=demo-company&serviceId=...&providerId=...
```

### Generate links in admin (Phase 2)

Staff with access to **Admin → Providers** or **Services** can open **Booking links**, pick service + provider, and copy the filled URL. Providers use **My booking link** on the provider dashboard (only their own services).

Staff API (for building UIs): `GET /catalog/staff/booking-link-options?locationId=<uuid>` (JWT).

## 8. Partner API (secure — LeadsReach, etc.)

### Setup (org admin)

1. **Admin → Settings → Integrations**
2. **Create API key** — copy `sk_…` once (shown only at creation)
3. Optional: set **Webhook URL** + secret for `appointment.booked` events
4. In LeadsReach: store the API key on the **server** only

### Secure short booking session (recommended — Leads Reach)

No PII in the browser URL. Create a 15-minute session server-side, open the returned short link.

```http
POST /partner/v1/booking-sessions
Authorization: Bearer sk_...
Content-Type: application/json

{
  "ref": "lead_7377_deal_9",
  "returnUrl": "https://crm.example/bases/141/crm?deal_id=9",
  "source": "leadsreach",
  "customerName": "Jane Doe",
  "customerEmail": "jane@example.com",
  "customerPhone": "+971501234567",
  "serviceId": "uuid",
  "providerId": "uuid",
  "leadLabel": "Jane Doe · Deal #9"
}
```

Response: `{ "url": "http://localhost:3002/b/a1b2c3...", "expiresAt": "...", "mode": "calendar" }`

- With `serviceId` + `providerId` → calendar + details only (premium flow).
- Without them → full service/provider picker on Slotwise.

### Bootstrap (connect — Leads Reach)

Called when a partner saves an API key. Returns org identity and all bookable service/provider pairs.

```http
GET /partner/v1/bootstrap
Authorization: Bearer sk_...
```

Response:

```json
{
  "orgSlug": "demo-company",
  "orgName": "Demo Company",
  "organization": { "slug": "demo-company", "name": "Demo Company" },
  "pairs": [
    {
      "serviceId": "uuid",
      "serviceName": "Product Demo",
      "providerId": "uuid",
      "providerName": "John Smith"
    }
  ]
}
```

### Create a booking link (server-to-server)

```http
POST /partner/v1/booking-links
Authorization: Bearer sk_your_key_here
Content-Type: application/json

{
  "serviceId": "uuid",
  "providerId": "uuid",
  "source": "leadsreach",
  "campaign": "q2",
  "ref": "lead_8821",
  "returnUrl": "https://leadsreach.app/thanks"
}
```

Response:

```json
{
  "url": "http://localhost:3002/book/john-smith/product-demo?org=demo-company&source=leadsreach&ref=lead_8821",
  "orgSlug": "demo-company",
  "serviceSlug": "product-demo",
  "providerSlug": "john-smith"
}
```

### List bookable pairs

```http
GET /partner/v1/booking-link-options?locationId=<uuid>
Authorization: Bearer sk_...
```

### Auth

- Header: `Authorization: Bearer sk_…` **or** `X-API-Key: sk_…`
- No CSRF cookie required on partner routes
- Keys are SHA-256 hashed at rest; revoke in admin anytime

## 4. Query parameters (simple / wizard links)

| Parameter | Description |
|-----------|-------------|
| `org` | Organization slug (default: `demo-company`) |
| `product` | Filters services by `productKey` |
| `source` | Your page or product identifier (stored on appointment) |
| `campaign` | Marketing campaign id |
| `returnUrl` | HTTPS URL to redirect after successful booking |

## 5. Webhooks

Slotwise POSTs JSON to your webhook URL when appointments change.

| Event | When |
|-------|------|
| `appointment.booked` | New booking confirmed |
| `appointment.cancelled` | Customer or admin cancels |
| `appointment.rescheduled` | Customer or admin changes date/time |
| `appointment.status_changed` | Admin changes status (e.g. checked in, completed) |

Example (`appointment.booked`):

```json
{
  "event": "appointment.booked",
  "timestamp": "2026-05-18T12:00:00.000Z",
  "data": {
    "appointmentId": "...",
    "status": "confirmed",
    "customerEmail": "user@example.com",
    "customerName": "Jane Doe",
    "serviceId": "...",
    "serviceName": "Product Demo",
    "providerId": "...",
    "providerName": "John Smith",
    "locationId": "...",
    "startUtc": "2026-05-20T10:00:00.000Z",
    "endUtc": "2026-05-20T10:30:00.000Z",
    "product": "crm",
    "campaign": "q2",
    "source": "leadsreach",
    "ref": "lead_8821_deal_9",
    "rescheduleCount": 0
  }
}
```

`ref` is set when booking from a partner session (Leads Reach). CRM uses it to attach timeline activities to the correct lead/deal.

`appointment.rescheduled` includes `previousStartUtc` (ISO string). Admin actions may include `rescheduledByAdmin` or `cancelledByAdmin`: true.

`appointment.status_changed` includes `previousStatus` and `newStatus` (e.g. `confirmed` → `completed`).

View links on every event (for CRM “Open in Slotwise”):

| Field | Description |
|-------|-------------|
| `manageToken` | Secret token for customer manage page |
| `manageUrl` | Full URL `{WEB_URL}/manage/{token}` — cancel/reschedule without admin login |
| `partnerViewUrl` | Same as `manageUrl` (preferred for partner UIs) |
| `adminViewUrl` | `{WEB_URL}/admin/appointments/{id}` — staff only |

Lookup by id: `GET /partner/v1/appointments/:appointmentId` (Bearer partner API key) returns the same `data` shape.

See [leadsreach-webhook-testing.md](./leadsreach-webhook-testing.md) for local testing with Leads Reach.

Configure in **Admin → Settings → Integrations → Outbound webhooks**:

1. Paste the partner’s **Webhook URL** (e.g. `https://crm.example.com/api/webhooks/appointments`).
2. Save — Slotwise **auto-generates** a signing secret (`whsec_…`) and shows it **once**.
3. Copy that secret into the partner app’s server env (e.g. Leads Reach `APPOINTMENT_WEBHOOK_SECRET`).
4. Use **Regenerate signing secret** if you rotate credentials (updates the partner app too).

Dev fallback (optional): `WEBHOOK_URL` + `WEBHOOK_SECRET` in `.env` if org settings are empty.

Verify with header `X-Webhook-Signature` (HMAC-SHA256 hex of the raw JSON body).

## 6. Customer accounts (optional)

Customers can register at `/register` and sign in at `/login` to see appointments at `/account`. Guest booking and magic-link manage links still work without an account.

## 7. Admin setup checklist

1. Create organization and location in admin (or seed).
2. Add services with `productKey` matching your product ids.
3. Set `allowedEmbedOrigins` for iframe embeds.
4. Set `webhookUrl` / `webhookSecret` for CRM sync.
5. Share booking URLs with product teams.
