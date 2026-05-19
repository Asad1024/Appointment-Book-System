export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-white dark:bg-slate-950">
      <div className="mx-auto w-full max-w-[420px] px-3 py-4">{children}</div>
    </div>
  );
}
