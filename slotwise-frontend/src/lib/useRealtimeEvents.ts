'use client';

import { useEffect, useRef } from 'react';
import { getApiUrl } from '@/lib/api';

export type RealtimePayload = {
  type: string;
  appointmentId?: string;
  at?: string;
};

export function useRealtimeEvents(
  onEvent: (event: RealtimePayload) => void,
  enabled = true,
) {
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const url = `${getApiUrl()}/realtime/events`;
    const es = new EventSource(url, { withCredentials: true });

    es.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data) as RealtimePayload;
        if (data.type === 'ping') return;
        handlerRef.current(data);
      } catch {
        /* ignore malformed */
      }
    };

    return () => es.close();
  }, [enabled]);
}
