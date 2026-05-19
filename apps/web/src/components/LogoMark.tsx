import { cn } from '@/lib/cn';

/** SVG logo mark — calendar + check */
export function LogoMark({
  className,
  size = 36,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('shrink-0', className)}
      aria-hidden
    >
      <rect width="40" height="40" rx="10" fill="url(#slotwise-gradient)" />
      <path
        d="M12 14h16v14a2 2 0 01-2 2H14a2 2 0 01-2-2V14z"
        fill="white"
        fillOpacity="0.95"
      />
      <path d="M14 11h2.5v3H14v-3zm9.5 0H26v3h-2.5v-3z" fill="white" fillOpacity="0.85" />
      <path d="M12 17h16" stroke="#4f46e5" strokeWidth="1.5" strokeOpacity="0.35" />
      <path
        d="M18 24l2.5 2.5L26 21"
        stroke="#4f46e5"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <defs>
        <linearGradient id="slotwise-gradient" x1="8" y1="4" x2="34" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6366f1" />
          <stop offset="1" stopColor="#4338ca" />
        </linearGradient>
      </defs>
    </svg>
  );
}
