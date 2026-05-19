'use client';

import { useCallback, useEffect, useState } from 'react';
import { Calendar, Link2, Unlink } from 'lucide-react';
import { toast } from 'sonner';
import { apiAuth, getApiUrl } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';

type Status = {
  connected: boolean;
  calendarType: string | null;
  connectedAt: string | null;
};

export function GoogleCalendarConnect() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStatus(await apiAuth<Status>('/integrations/google/status'));
    } catch {
      setStatus({ connected: false, calendarType: null, connectedAt: null });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get('calendar');
    if (result === 'connected') {
      toast.success('Google Calendar connected');
      void load();
    } else if (result === 'error') {
      toast.error('Could not connect Google Calendar. Try again.');
    }
    if (result) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [load]);

  function connect() {
    window.location.href = `${getApiUrl()}/integrations/google/connect`;
  }

  async function disconnect() {
    setDisconnecting(true);
    try {
      await apiAuth('/integrations/google/disconnect', { method: 'DELETE' });
      toast.success('Google Calendar disconnected');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Disconnect failed');
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <Card className="mb-8">
      <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 text-primary-600 dark:bg-primary-950 dark:text-primary-400">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <p className="font-medium text-text-primary">Google Calendar</p>
            <p className="text-sm text-text-secondary">
              {loading
                ? 'Checking connection…'
                : status?.connected
                  ? 'New bookings sync to your Google Calendar automatically.'
                  : 'Connect so appointments from this site appear on your calendar.'}
            </p>
          </div>
        </div>
        {loading ? null : status?.connected ? (
          <Button variant="outline" size="sm" loading={disconnecting} onClick={() => void disconnect()}>
            <Unlink className="mr-2 h-4 w-4" />
            Disconnect
          </Button>
        ) : (
          <Button size="sm" onClick={connect}>
            <Link2 className="mr-2 h-4 w-4" />
            Connect Google Calendar
          </Button>
        )}
      </CardBody>
    </Card>
  );
}
