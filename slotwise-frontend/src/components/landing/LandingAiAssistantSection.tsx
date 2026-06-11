'use client';

import { motion } from 'framer-motion';
import { Bot, MessageCircle, Mic, Send, Sparkles } from 'lucide-react';
import { PLATFORM } from '@/lib/brand';

const sampleMessages = [
  {
    role: 'assistant' as const,
    text: 'Hi. I can help you choose a service, find open slots, and book in a few messages.',
  },
  {
    role: 'user' as const,
    text: 'Do you have anything tomorrow afternoon for a consultation?',
  },
  {
    role: 'assistant' as const,
    text: 'Yes — I found 3 available times with Dr. Nadia. Tap a slot to continue.',
  },
];

export function LandingAiAssistantSection() {
  return (
    <section
      id="ai-assistant"
      className="scroll-mt-28 border-y border-slate-200/80 bg-gradient-to-b from-brand-50/40 via-white to-slate-50/80 py-14 sm:py-16 dark:border-slate-800 dark:from-brand-950/30 dark:via-slate-950 dark:to-slate-900/50"
    >
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 sm:px-6 lg:grid-cols-[1fr_1.05fr] lg:gap-14">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.4 }}
        >
          <p className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-brand-700 dark:border-brand-800/60 dark:bg-brand-950/50 dark:text-brand-300">
            <Sparkles className="h-3.5 w-3.5" />
            AI booking assistant
          </p>
          <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
            Let customers book by conversation
          </h2>
          <p className="mt-4 text-base leading-relaxed text-text-secondary">
            {PLATFORM.name} includes a built-in AI chat on your booking pages. Visitors ask in plain
            language, pick services and times from suggested actions, and complete details without
            hunting through forms.
          </p>
          <ul className="mt-6 space-y-3 text-sm text-text-secondary">
            {[
              'Answers questions about services, hours, and policies',
              'Surfaces real availability — no fake slots',
              'Collects name, email, and phone when they are ready to book',
              'Works on your public booking and partner flows',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <Bot className="mt-0.5 h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.45, delay: 0.08 }}
          className="relative"
        >
          <div className="pointer-events-none absolute -right-6 -top-6 h-32 w-32 rounded-full bg-cyan-200/40 blur-3xl dark:bg-cyan-900/25" />
          <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_32px_80px_-48px_rgba(15,23,42,0.45)] dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/90 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/90">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-white">
                  <MessageCircle className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-text-primary">Booking assistant</p>
                  <p className="text-xs text-text-muted">Powered by {PLATFORM.name}</p>
                </div>
              </div>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                Live on your site
              </span>
            </div>

            <div className="space-y-3 bg-slate-50/50 p-4 dark:bg-slate-950/40">
              {sampleMessages.map((message, index) => (
                <div
                  key={index}
                  className={
                    message.role === 'user' ? 'flex justify-end' : 'flex justify-start'
                  }
                >
                  <div
                    className={
                      message.role === 'user'
                        ? 'max-w-[85%] rounded-2xl rounded-br-md bg-brand-600 px-3 py-2 text-sm text-white'
                        : 'max-w-[85%] rounded-2xl rounded-bl-md border border-slate-200 bg-white px-3 py-2 text-sm text-text-primary shadow-sm dark:border-slate-700 dark:bg-slate-900'
                    }
                  >
                    {message.text}
                  </div>
                </div>
              ))}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {['Tomorrow 2:30 PM', 'Thursday morning', 'See all services'].map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full border border-brand-200 bg-white px-2.5 py-1 text-xs font-medium text-brand-700 dark:border-brand-800 dark:bg-slate-900 dark:text-brand-300"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 border-t border-slate-100 bg-white px-3 py-3 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-text-muted dark:border-slate-700 dark:bg-slate-950">
                Ask about services or availability…
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-text-muted dark:border-slate-700">
                <Mic className="h-4 w-4" />
              </span>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white">
                <Send className="h-4 w-4" />
              </span>
            </div>
          </div>

          <div className="absolute -bottom-4 -left-2 hidden rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-lg dark:border-slate-700 dark:bg-slate-900 sm:block">
            <p className="text-xs font-medium text-text-primary">Floating chat on every booking page</p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
