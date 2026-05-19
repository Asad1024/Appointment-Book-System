# Product integration guide

Connect other company products to this booking system so users can book demos without leaving your funnel.

## Quick links (local dev)

| Use case | URL |
|----------|-----|
| Full-page booking | `http://localhost:3000/book?product=demo&source=pricing` |
| Return after booking | Add `&returnUrl=https://your-product.com/thanks` |
| Embedded iframe | `http://localhost:3000/embed/book?product=demo&source=footer` |
| Integration context API | `GET http://localhost:3001/integration/context?org=demo-company&product=demo` |

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

## 3. Query parameters

| Parameter | Description |
|-----------|-------------|
| `org` | Organization slug (default: `demo-company`) |
| `product` | Filters services by `productKey` |
| `source` | Your page or product identifier (stored on appointment) |
| `campaign` | Marketing campaign id |
| `returnUrl` | HTTPS URL to redirect after successful booking |

## 4. Webhooks

When an appointment is booked, the API can POST to your webhook:

```json
{
  "event": "appointment.booked",
  "timestamp": "2026-05-18T12:00:00.000Z",
  "data": {
    "id": "...",
    "product": "crm",
    "campaign": "q2",
    "source": "pricing",
    "customerEmail": "user@example.com",
    "startUtc": "..."
  }
}
```

Configure per organization (`webhookUrl`, `webhookSecret`) or globally via `.env`:

```
WEBHOOK_URL=https://your-product.com/api/webhooks/appointments
WEBHOOK_SECRET=your-hmac-secret
```

Verify with header `X-Webhook-Signature` (HMAC-SHA256 of the raw body).

## 5. Customer accounts (optional)

Customers can register at `/register` and sign in at `/login` to see appointments at `/account`. Guest booking and magic-link manage links still work without an account.

## 6. Admin setup checklist

1. Create organization and location in admin (or seed).
2. Add services with `productKey` matching your product ids.
3. Set `allowedEmbedOrigins` for iframe embeds.
4. Set `webhookUrl` / `webhookSecret` for CRM sync.
5. Share booking URLs with product teams.
