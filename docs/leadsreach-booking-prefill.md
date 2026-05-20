# Leads Reach — pass lead details into Slotwise booking

Slotwise accepts these **query parameters** on partner booking URLs:

| Parameter | Aliases | Example |
|-----------|---------|---------|
| `name` | `customerName`, or `firstName` + `lastName` | `Jane Doe` |
| `email` | `customerEmail` | `jane@acme.com` |
| `phone` | `customerPhone` | `+971501234567` |
| `ref` | — | `lead_7377_deal_9` (already used) |
| `partner` | — | `1` (minimal chrome on `/book/event` links) |

Example picker URL:

```
http://localhost:3002/partner/book?org=demo-company&source=leadsreach&ref=lead_7377_deal_9&returnUrl=...&name=Jane%20Doe&email=jane%40acme.com&phone=%2B971501234567
```

## Leads Reach backend changes

Apply in **`AiSalesCopilot-Backend`** (`appointmentBooking.service.ts`).

### 1. Helper — append lead prefill to any booking URL

```typescript
import type { Lead } from "@models/lead";

export function appendLeadPrefillToBookingUrl(url: string, lead: Lead): string {
  const u = new URL(url);
  const name = [lead.first_name, lead.last_name].filter(Boolean).join(" ").trim();
  if (name) u.searchParams.set("name", name);
  const email = lead.email?.trim();
  if (email) u.searchParams.set("email", email);
  const phone = lead.phone?.trim();
  if (phone) u.searchParams.set("phone", phone);
  return u.toString();
}
```

### 2. Update `buildPartnerPickerUrl` — accept lead

```typescript
export function buildPartnerPickerUrl(params: {
  leadId: number;
  baseId: number;
  dealId?: number;
  orgSlug: string;
  returnPath?: string;
  lead: Pick<Lead, "first_name" | "last_name" | "email" | "phone">;
}): string {
  const returnUrl = params.returnPath
    ? `${getFrontendUrl()}${params.returnPath.startsWith("/") ? params.returnPath : `/${params.returnPath}`}`
    : `${getFrontendUrl()}/bases/${params.baseId}/leads`;

  const q = new URLSearchParams({
    org: params.orgSlug,
    source: "leadsreach",
    ref: buildBookingRef(params.leadId, params.dealId),
    returnUrl,
  });

  const base = `${getAppointmentWebUrl()}/partner/book?${q.toString()}`;
  return appendLeadPrefillToBookingUrl(base, params.lead as Lead);
}
```

### 3. Update `resolveAppointmentBookingOpen` — pass lead into picker

```typescript
export async function resolveAppointmentBookingOpen(
  params: {
    leadId: number;
    baseId: number;
    dealId?: number;
    returnPath?: string;
    serviceId?: string;
    providerId?: string;
    lead: Pick<Lead, "first_name" | "last_name" | "email" | "phone">;
  },
  conn: AppointmentConnection
): Promise<AppointmentBookingOpenResult> {
  // ... existing direct_link branch ...

  return {
    url: buildPartnerPickerUrl({
      leadId: params.leadId,
      baseId: params.baseId,
      dealId: params.dealId,
      orgSlug: conn.orgSlug,
      returnPath: params.returnPath,
      lead: params.lead,
    }),
    mode: "picker",
  };
}
```

### 4. Update `appointmentIntegration.ts` route — pass lead row

```typescript
const result = await resolveAppointmentBookingOpen(
  {
    leadId,
    baseId,
    dealId,
    returnPath,
    serviceId,
    providerId,
    lead, // Sequelize lead instance from findOne above
  },
  conn
);
```

### 5. Direct booking links — append prefill + `partner=1`

In `createDirectBookingLink`, after you get `url` from the appointment API:

```typescript
let url = /* existing url from response */;
url = appendLeadPrefillToBookingUrl(url, lead);
const u = new URL(url);
u.searchParams.set("partner", "1");
return u.toString();
```

Pass `lead` into `createDirectBookingLink` params from the route (same `Lead` row you already load).

---

Restart **Leads Reach backend** after edits. Slotwise web picks up prefill on refresh (no API change required).
