import { LegalPage, Section } from '@/components/legal/LegalPage';

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="May 18, 2026">
      <Section title="Overview">
        <p>
          Slotwise (&quot;we&quot;, &quot;our&quot;, &quot;the platform&quot;) helps organizations schedule
          appointments with their customers. This policy explains what personal data we process when you
          use our website, booking flows, and staff tools.
        </p>
      </Section>
      <Section title="Data we collect">
        <ul className="list-disc space-y-2 pl-5">
          <li>Account data: name, email, password (stored hashed), and role for staff and customers.</li>
          <li>Booking data: contact details, appointment times, service choices, and optional notes.</li>
          <li>Technical data: cookies for authentication and CSRF protection; standard server logs.</li>
          <li>Billing data (organizations): card last four digits and brand when you subscribe (demo mode today).</li>
        </ul>
      </Section>
      <Section title="How we use data">
        <p>
          We use data to provide scheduling, send confirmations and reminders by email, operate staff
          dashboards, prevent abuse, and improve reliability. We do not sell personal data to third parties.
        </p>
      </Section>
      <Section title="Sharing">
        <p>
          Data may be processed by infrastructure providers (hosting, email delivery) under contract. Your
          organization&apos;s administrators and assigned providers can see bookings relevant to their role.
          Webhooks configured by your organization may receive booking events.
        </p>
      </Section>
      <Section title="Retention">
        <p>
          We retain account and appointment records while your organization uses the service and as needed
          for legal or operational purposes. You may request deletion of your customer account by contacting
          your provider or organization admin.
        </p>
      </Section>
      <Section title="Your rights">
        <p>
          Depending on your location, you may have rights to access, correct, delete, or export your data,
          and to object to certain processing. Contact us to exercise these rights.
        </p>
      </Section>
      <Section title="Security">
        <p>
          We use encrypted sessions (httpOnly cookies), CSRF protection, and industry-standard password
          hashing. No system is perfectly secure; report concerns to the contact below.
        </p>
      </Section>
    </LegalPage>
  );
}
