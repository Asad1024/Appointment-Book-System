import { PrismaService } from '../prisma/prisma.service';

export function slugifyName(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return base || 'item';
}

export async function uniqueProviderSlug(
  prisma: PrismaService,
  organizationId: string,
  base: string,
  excludeId?: string,
): Promise<string> {
  let n = 0;
  while (true) {
    const slug = n === 0 ? base : `${base}-${n}`;
    const existing = await prisma.provider.findFirst({
      where: {
        organizationId,
        slug,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    });
    if (!existing) return slug;
    n++;
  }
}

export async function uniqueServiceSlug(
  prisma: PrismaService,
  organizationId: string,
  base: string,
  excludeId?: string,
): Promise<string> {
  let n = 0;
  while (true) {
    const slug = n === 0 ? base : `${base}-${n}`;
    const existing = await prisma.service.findFirst({
      where: {
        organizationId,
        slug,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    });
    if (!existing) return slug;
    n++;
  }
}

/** Unique per location — used as ?product= filter in integration booking URLs */
export async function uniqueProductKey(
  prisma: PrismaService,
  locationId: string,
  base: string,
  excludeId?: string,
): Promise<string> {
  let n = 0;
  while (true) {
    const productKey = n === 0 ? base : `${base}-${n}`;
    const existing = await prisma.service.findFirst({
      where: {
        locationId,
        productKey,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    });
    if (!existing) return productKey;
    n++;
  }
}
