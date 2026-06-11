import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

export function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function InitialsAvatar({
  name,
  src,
  className,
}: {
  name: string;
  src?: string | null;
  className?: string;
}) {
  const normalizedSrc =
    typeof src === 'string' && src.trim()
      ? src.trim().startsWith('//')
        ? `https:${src.trim()}`
        : src.trim()
      : undefined;

  return (
    <Avatar className={cn('h-10 w-10 shrink-0', className)} aria-hidden>
      {normalizedSrc ? (
        <AvatarImage
          src={normalizedSrc}
          alt={name}
          className="object-cover"
          referrerPolicy="no-referrer"
        />
      ) : null}
      <AvatarFallback
        className={cn(
          'bg-brand-100 text-sm font-semibold text-brand-700',
          className,
        )}
      >
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
