import { PrismaClient } from '@prisma/client';
import { PLATFORM_ORG_SLUG, UserRole } from '@pkg/shared-types';
import * as bcrypt from 'bcryptjs';

const SUPER_ADMIN_EMAIL =
  process.env.SEED_SUPER_ADMIN_EMAIL ?? 'admin@sparkai.com';
const SUPER_ADMIN_PASSWORD =
  process.env.SEED_SUPER_ADMIN_PASSWORD ?? 'xyz200099!';
const SUPER_ADMIN_NAME =
  process.env.SEED_SUPER_ADMIN_NAME ?? 'Platform Super Admin';

const prisma = new PrismaClient();

async function main() {
  const platformOrg = await prisma.organization.upsert({
    where: { slug: PLATFORM_ORG_SLUG },
    update: { isActive: true },
    create: {
      name: 'SparkAI Platform',
      slug: PLATFORM_ORG_SLUG,
      primaryColor: '#2563eb',
      bookingCurrency: 'aed',
      isActive: true,
    },
  });

  const passwordHash = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 10);

  await prisma.user.upsert({
    where: { email: SUPER_ADMIN_EMAIL },
    update: {
      organizationId: platformOrg.id,
      passwordHash,
      name: SUPER_ADMIN_NAME,
      role: UserRole.SUPER_ADMIN,
      emailVerified: true,
      isActive: true,
      providerId: null,
    },
    create: {
      organizationId: platformOrg.id,
      email: SUPER_ADMIN_EMAIL,
      passwordHash,
      name: SUPER_ADMIN_NAME,
      role: UserRole.SUPER_ADMIN,
      emailVerified: true,
      isActive: true,
    },
  });

  console.log('Seed complete.');
  console.log(`Super admin: ${SUPER_ADMIN_EMAIL}`);
  console.log(`Password: ${SUPER_ADMIN_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
