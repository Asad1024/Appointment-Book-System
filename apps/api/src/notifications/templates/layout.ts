const BRAND_NAME = process.env.APP_NAME ?? 'Slotwise';
const BRAND_COLOR = '#2563eb';
const MUTED = '#64748b';

export function emailLayout(content: string): string {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${BRAND_NAME}</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,0.08);">
          <tr>
            <td style="background-color:${BRAND_COLOR};padding:24px 32px;text-align:center;">
              <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">${BRAND_NAME}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;color:#0f172a;font-size:15px;line-height:1.6;">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background-color:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0;font-size:12px;color:${MUTED};line-height:1.5;">
                &copy; ${year} ${BRAND_NAME}. All rights reserved.
              </p>
              <p style="margin:8px 0 0;font-size:12px;color:${MUTED};">
                You received this email because of activity on your account.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function emailButton(href: string, label: string): string {
  return `<p style="margin:24px 0 0;">
    <a href="${href}" style="display:inline-block;background-color:${BRAND_COLOR};color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:6px;">${label}</a>
  </p>`;
}

/** Calendly-style calendar links for customer emails. */
export function emailCalendarLinks(googleCalendarUrl: string, icsDownloadUrl: string): string {
  return `
    <p style="margin:24px 0 8px;font-size:14px;font-weight:600;color:#0f172a;">Add to your calendar</p>
    <p style="margin:0 0 12px;font-size:13px;color:#64748b;">Save this appointment so you get reminders.</p>
    <p style="margin:0;">
      <a href="${googleCalendarUrl}" style="display:inline-block;background-color:${BRAND_COLOR};color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:6px;">Add to Google Calendar</a>
    </p>
    <p style="margin:16px 0 0;font-size:13px;color:#64748b;">
      Using Outlook or Apple Calendar?
      <a href="${icsDownloadUrl}" style="color:${BRAND_COLOR};font-weight:600;">Download .ics file</a>
    </p>`;
}

export function emailParagraph(text: string): string {
  return `<p style="margin:0 0 16px;color:#334155;">${text}</p>`;
}

export function emailHeading(text: string): string {
  return `<h1 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#0f172a;">${text}</h1>`;
}
