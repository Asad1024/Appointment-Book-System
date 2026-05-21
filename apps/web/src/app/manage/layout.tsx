/** Manage appointment — no site marketing nav (partner + email links). */
export default function ManageLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-100/80 dark:bg-slate-950">
      <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-10 lg:px-10">{children}</div>
    </div>
  );
}
