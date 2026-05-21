/** Short secure booking links — top-aligned, no marketing chrome. */
export default function ShortBookingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-b from-slate-50 to-slate-100/80 px-4 py-6 dark:from-slate-950 dark:to-slate-900 sm:px-8 sm:py-8">
      <div className="mx-auto w-full max-w-6xl sm:max-w-7xl">{children}</div>
    </div>
  );
}
