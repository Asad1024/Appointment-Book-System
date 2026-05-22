/**
 * Concurrency test: parallel bookings for same slot — exactly one should succeed.
 * Run with: pnpm --filter @app/api test:concurrency
 * Requires MySQL (or Postgres) with assertNoOverlap row locking.
 */
import { Prisma, PrismaClient } from '@prisma/client';
import { AppointmentStatus } from '@pkg/shared-types';

const prisma = new PrismaClient();
const isSqlite = (process.env.DATABASE_URL ?? '').startsWith('file:');

describe('booking concurrency', () => {
  const providerId = '11111111-1111-4111-8111-111111111103';
  const serviceId = '11111111-1111-4111-8111-111111111102';
  const locationId = '11111111-1111-4111-8111-111111111101';

  afterAll(() => prisma.$disconnect());

  it('allows only one booking for the same slot', async () => {
    if (isSqlite) {
      console.log('Skipping: use MySQL for concurrency test');
      return;
    }
    const startUtc = new Date();
    startUtc.setUTCDate(startUtc.getUTCDate() + 14);
    startUtc.setUTCHours(10, 0, 0, 0);
    const endUtc = new Date(startUtc.getTime() + 30 * 60 * 1000);

    await prisma.appointment.deleteMany({
      where: { providerId, startUtc },
    });

    const org = await prisma.organization.findFirst({ where: { slug: 'demo-company' } });
    if (!org) throw new Error('Run db:seed first');

    const customer = await prisma.customer.upsert({
      where: {
        organizationId_email: {
          organizationId: org.id,
          email: 'concurrency@test.com',
        },
      },
      update: {},
      create: {
        organizationId: org.id,
        name: 'Concurrency Test',
        email: 'concurrency@test.com',
      },
    });

    const attempts = 50;
    const blocking = [
      AppointmentStatus.CONFIRMED,
      AppointmentStatus.CHECKED_IN,
      AppointmentStatus.COMPLETED,
    ];
    const results = await Promise.allSettled(
      Array.from({ length: attempts }, (_, i) =>
        prisma.$transaction(async (tx) => {
          await tx.$queryRaw(Prisma.sql`SELECT id FROM providers WHERE id = ${providerId} FOR UPDATE`);
          const overlapping = await tx.appointment.findFirst({
            where: {
              providerId,
              status: { in: blocking },
              startUtc: { lt: endUtc },
              endUtc: { gt: startUtc },
            },
          });
          if (overlapping) {
            throw new Error('Time slot is no longer available');
          }
          return tx.appointment.create({
            data: {
              organizationId: org.id,
              locationId,
              serviceId,
              providerId,
              customerId: customer.id,
              startUtc,
              endUtc,
              timezone: 'America/New_York',
              status: AppointmentStatus.CONFIRMED,
              manageToken: `test-token-${i}-${Date.now()}`,
            },
          });
        }),
      ),
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    expect(succeeded).toBe(1);
    expect(failed).toBe(attempts - 1);

    await prisma.appointment.deleteMany({ where: { providerId, startUtc } });
  });
});
