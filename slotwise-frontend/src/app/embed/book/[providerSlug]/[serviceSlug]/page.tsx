import { FilledBookingBySlugPage } from '@/components/booking/FilledBookingBySlugPage';

type Props = {
  params: Promise<{ providerSlug: string; serviceSlug: string }>;
};

export default async function EmbedBookBySlugPage({ params }: Props) {
  const { providerSlug, serviceSlug } = await params;
  return (
    <FilledBookingBySlugPage
      providerSlug={decodeURIComponent(providerSlug)}
      serviceSlug={decodeURIComponent(serviceSlug)}
      embed
    />
  );
}
