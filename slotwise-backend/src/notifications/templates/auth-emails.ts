import { emailButton, emailHeading, emailLayout, emailParagraph } from './layout';

export function emailVerificationEmail(data: {
  name: string;
  verifyUrl: string;
}): { subject: string; html: string } {
  const body = [
    emailHeading('Verify your email'),
    emailParagraph(`Hi ${data.name},`),
    emailParagraph('Please confirm your email address to finish setting up your account.'),
    emailButton(data.verifyUrl, 'Verify email'),
    emailParagraph(
      '<span style="color:#64748b;font-size:13px;">This link expires in 24 hours.</span>',
    ),
  ].join('');

  return { subject: 'Verify your Slotwise email', html: emailLayout(body) };
}

export function passwordResetEmail(data: {
  resetUrl: string;
}): { subject: string; html: string } {
  const body = [
    emailHeading('Reset your password'),
    emailParagraph('We received a request to reset your password.'),
    emailButton(data.resetUrl, 'Reset password'),
    emailParagraph(
      '<span style="color:#64748b;font-size:13px;">This link expires in 1 hour. If you did not request a reset, you can ignore this email.</span>',
    ),
  ].join('');

  return { subject: 'Reset your Slotwise password', html: emailLayout(body) };
}

function inviteRoleLabel(role: string): string {
  if (role === 'provider') return 'Staff';
  if (role === 'org_admin') return 'Admin';
  if (role === 'location_manager') return 'Staff';
  if (role === 'super_admin') return 'Super Admin';
  return role
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function teamInviteEmail(data: {
  organizationName: string;
  role: string;
  acceptUrl: string;
  expiresAt: string;
}): { subject: string; html: string } {
  const roleLabel = inviteRoleLabel(data.role);
  const body = [
    emailHeading(`Join ${data.organizationName}`),
    emailParagraph('You have been invited to join the team on Slotwise.'),
    emailParagraph(`Role: <strong>${roleLabel}</strong>`),
    emailButton(data.acceptUrl, 'Accept invitation'),
    emailParagraph(
      `<span style="color:#64748b;font-size:13px;">This invitation expires on ${data.expiresAt}.</span>`,
    ),
  ].join('');

  return {
    subject: `You've been invited to join ${data.organizationName} on Slotwise`,
    html: emailLayout(body),
  };
}
