import { LegalPage, Section } from '@/components/legal/LegalPage';

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="May 18, 2026">
      <Section title="Agreement">
        <p>
          By accessing Slotwise or booking an appointment through an organization that uses Slotwise, you
          agree to these Terms. If you do not agree, do not use the service.
        </p>
      </Section>
      <Section title="The service">
        <p>
          Slotwise provides online appointment scheduling, staff administration tools, and related
          notifications. Features may change; we aim to give reasonable notice for material changes.
        </p>
      </Section>
      <Section title="Accounts">
        <p>
          You are responsible for your account credentials. Staff accounts must be used only by authorized
          personnel. Customers must provide accurate contact information so confirmations and reminders
          reach them.
        </p>
      </Section>
      <Section title="Bookings">
        <p>
          Appointment times are shown in the organization&apos;s timezone and your local timezone where
          displayed. Cancellation and reschedule rules are set by each organization. No-shows may be subject
          to the organization&apos;s policies.
        </p>
      </Section>
      <Section title="Organization subscriptions">
        <p>
          Organizations may subscribe to paid plans with monthly appointment limits. Demo billing does not
          charge real cards today; production billing will be processed through a payment provider. Fees
          and limits are shown in admin settings.
        </p>
      </Section>
      <Section title="Acceptable use">
        <p>
          Do not misuse the platform (spam, abuse, automated scraping, interference with other users, or
          unlawful content). We may suspend access for violations.
        </p>
      </Section>
      <Section title="Disclaimer">
        <p>
          The service is provided &quot;as is&quot; without warranties of uninterrupted availability.
          Organizations are responsible for their own services, advice, and compliance with applicable laws
          (including healthcare or professional regulations where relevant).
        </p>
      </Section>
      <Section title="Limitation of liability">
        <p>
          To the maximum extent permitted by law, Slotwise is not liable for indirect or consequential damages
          arising from use of the service. Our total liability is limited to fees paid to us in the twelve
          months before the claim, or one hundred US dollars if none were paid.
        </p>
      </Section>
      <Section title="Contact">
        <p>
          For questions about these Terms, contact your organization administrator or email{' '}
          <a href="mailto:legal@slotwise.app" className="text-brand-600 hover:underline">
            legal@slotwise.app
          </a>
          .
        </p>
      </Section>
    </LegalPage>
  );
}
