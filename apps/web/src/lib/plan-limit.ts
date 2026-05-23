'use client';

import { ApiError } from '@/lib/api';

export type PlanLimitResource = 'bookings' | 'staff' | 'locations' | 'services';

export type PlanLimitPromptPayload = {
  resource?: PlanLimitResource | string;
  message?: string;
};

const PLAN_LIMIT_PROMPT_EVENT = 'slotwise:plan-limit-prompt';

export function getPlanLimitPromptEventName() {
  return PLAN_LIMIT_PROMPT_EVENT;
}

export function openPlanLimitPrompt(payload: PlanLimitPromptPayload) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<PlanLimitPromptPayload>(PLAN_LIMIT_PROMPT_EVENT, { detail: payload }),
  );
}

export function extractPlanLimitPayload(error: unknown): PlanLimitPromptPayload | null {
  if (error instanceof ApiError) {
    if (error.code === 'PLAN_LIMIT_REACHED') {
      return {
        resource: error.resource,
        message: error.message,
      };
    }
    if (error.status === 400 && /limit reached/i.test(error.message)) {
      return { message: error.message };
    }
  }
  if (error instanceof Error && /limit reached/i.test(error.message)) {
    return { message: error.message };
  }
  return null;
}

export function handlePlanLimitError(error: unknown): boolean {
  const payload = extractPlanLimitPayload(error);
  if (!payload) return false;
  openPlanLimitPrompt(payload);
  return true;
}
