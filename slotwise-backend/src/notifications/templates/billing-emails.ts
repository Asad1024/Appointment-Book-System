import { emailButton, emailHeading, emailLayout, emailParagraph } from './layout';

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

export function billingPaymentSuccessEmail(data: {
  organizationName: string;
  planName?: string;
  renewsOn: Date;
  manageUrl: string;
}): { subject: string; html: string } {
  const planName = data.planName?.trim() || 'paid';
  const body = [
    emailHeading('Payment received'),
    emailParagraph(
      `Your ${data.organizationName} <strong>${planName}</strong> subscription is now active.`,
    ),
    emailParagraph(`Activated plan: <strong>${planName}</strong>`),
    emailParagraph(`Next renewal date: <strong>${formatDate(data.renewsOn)}</strong>`),
    emailButton(data.manageUrl, 'Manage billing'),
  ].join('');

  return {
    subject: `${planName} plan activated - ${data.organizationName}`,
    html: emailLayout(body),
  };
}

export function billingPastDueEmail(data: {
  organizationName: string;
  graceEndsOn: Date;
  renewUrl: string;
}): { subject: string; html: string } {
  const body = [
    emailHeading('Payment overdue'),
    emailParagraph(`Your ${data.organizationName} subscription payment could not be collected.`),
    emailParagraph(
      `Grace period is active until <strong>${formatDate(data.graceEndsOn)}</strong>. Renew now to avoid booking interruptions.`,
    ),
    emailButton(data.renewUrl, 'Renew now'),
  ].join('');

  return {
    subject: `Action needed: renew ${data.organizationName} subscription`,
    html: emailLayout(body),
  };
}

export function billingGraceEndedEmail(data: {
  organizationName: string;
  graceEndedOn: Date;
  renewUrl: string;
}): { subject: string; html: string } {
  const body = [
    emailHeading('Grace period ended'),
    emailParagraph(
      `The grace period for ${data.organizationName} ended on <strong>${formatDate(data.graceEndedOn)}</strong>.`,
    ),
    emailParagraph('New bookings are paused until payment is renewed. Your staff and data remain safe.'),
    emailButton(data.renewUrl, 'Reactivate subscription'),
  ].join('');

  return {
    subject: `Subscription paused for ${data.organizationName}`,
    html: emailLayout(body),
  };
}

export function billingDowngradedEmail(data: {
  organizationName: string;
  downgradedOn: Date;
  upgradeUrl: string;
}): { subject: string; html: string } {
  const body = [
    emailHeading('Plan downgraded'),
    emailParagraph(
      `Your ${data.organizationName} subscription was downgraded to Free on <strong>${formatDate(data.downgradedOn)}</strong>.`,
    ),
    emailParagraph(
      'Your data is still available. Some limits may apply until you upgrade again.',
    ),
    emailButton(data.upgradeUrl, 'Upgrade plan'),
  ].join('');

  return {
    subject: `Plan downgraded - ${data.organizationName}`,
    html: emailLayout(body),
  };
}
