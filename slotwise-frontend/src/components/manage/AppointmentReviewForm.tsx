'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Label } from '@/components/ui/Label';
import { cn } from '@/lib/utils';

type ReviewState = {
  canReview: boolean;
  review: { rating: number; comment: string | null; customerName: string; createdAt: string } | null;
};

export function AppointmentReviewForm({
  manageToken,
  customerName,
  initial,
  onSubmitted,
}: {
  manageToken: string;
  customerName: string;
  initial: ReviewState;
  onSubmitted: () => void;
}) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(initial.review);

  if (submitted) {
    return (
      <div id="review-section" className="mt-6 rounded-xl border border-slate-200 bg-surface-muted p-5 dark:border-slate-700">
        <p className="text-sm font-medium text-text-primary">Thank you for your feedback!</p>
        <div className="mt-2 flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <Star
              key={n}
              className={cn(
                'h-5 w-5',
                n <= submitted.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600',
              )}
            />
          ))}
        </div>
        {submitted.comment && (
          <p className="mt-2 text-sm text-text-secondary">{submitted.comment}</p>
        )}
      </div>
    );
  }

  if (!initial.canReview) return null;

  async function submit() {
    setBusy(true);
    try {
      const review = await api<ReviewState['review']>(`/reviews/manage/${manageToken}`, {
        method: 'POST',
        body: JSON.stringify({ rating, comment: comment.trim() || undefined, customerName }),
      });
      setSubmitted(review);
      toast.success('Review submitted');
      onSubmitted();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not submit review');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div id="review-section" className="mt-6 rounded-xl border border-slate-200 bg-surface-subtle p-5 dark:border-slate-700">
      <h2 className="font-semibold text-text-primary">How was your visit?</h2>
      <p className="mt-1 text-sm text-text-secondary">Rate your appointment experience.</p>
      <div className="mt-4">
        <Label className="sr-only">Rating</Label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-label={`${n} star${n > 1 ? 's' : ''}`}
              className="rounded p-1 transition hover:scale-110"
              onClick={() => setRating(n)}
            >
              <Star
                className={cn(
                  'h-8 w-8',
                  n <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600',
                )}
              />
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4">
        <Label htmlFor="review-comment">Comments (optional)</Label>
        <textarea
          id="review-comment"
          rows={3}
          className="input-field mt-1 resize-none"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Tell us what went well or what we can improve"
        />
      </div>
      <Button className="mt-4 w-full" disabled={busy} onClick={() => void submit()}>
        {busy ? 'Submitting…' : 'Submit review'}
      </Button>
    </div>
  );
}
