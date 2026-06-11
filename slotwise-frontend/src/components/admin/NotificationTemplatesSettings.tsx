'use client';

import '@uiw/react-md-editor/markdown-editor.css';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import { Edit3, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { apiAuth } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

const MDEditor = dynamic(() => import('@uiw/react-md-editor'), {
  ssr: false,
  loading: () => <Skeleton className="h-[360px] w-full rounded-xl" />,
});

type TemplateChannel = 'email' | 'whatsapp';
type TemplateAudience = 'customer' | 'provider';
type TemplateEventType = 'booking_confirmation' | 'reminder' | 'rescheduled' | 'cancelled';

type NotificationTemplateRecord = {
  id: string;
  name: string;
  subject: string | null;
  body: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

type TemplateSlot = {
  key: string;
  channel: TemplateChannel;
  audience: TemplateAudience;
  eventType: TemplateEventType;
  label: string;
  description: string;
  supportsSubject: boolean;
  systemDefault: {
    subject: string | null;
    body: string;
  };
  activeSource: 'custom' | 'system';
  activeTemplateId: string | null;
  customTemplates: NotificationTemplateRecord[];
};

type TemplateListResponse = {
  supportedTokens: string[];
  templates: TemplateSlot[];
};

type TemplateForm = {
  subject: string;
  body: string;
};

const SAMPLE_TOKEN_VALUES: Record<string, string> = {
  customer_name: 'John Carter',
  customer_email: 'john.carter@example.com',
  customer_phone: '+1 202 555 0123',
  service_name: 'Premium consultation',
  provider_name: 'Hashmi Khan',
  location_name: 'Main Office',
  appointment_when_html: 'Tuesday, Jun 2, 2026 - 4:30 PM (Asia/Dubai)',
  appointment_when_plain: 'Tuesday, Jun 2, 2026 - 4:30 PM (Asia/Dubai)',
  manage_url: 'https://eci.slotwise.com/manage/abc123',
  google_calendar_url: 'https://calendar.google.com/...',
  ics_download_url: 'https://api.slotwise.com/appointments/abc/calendar.ics',
  admin_appointment_url: 'https://slotwise.com/admin/appointments/abc123',
  reminder_label: 'in 1 hour',
};

function formatAudience(audience: TemplateAudience): string {
  return audience === 'customer' ? 'Customer' : 'Staff';
}

function formatEvent(eventType: TemplateEventType): string {
  if (eventType === 'booking_confirmation') return 'Booking confirmation';
  if (eventType === 'rescheduled') return 'Rescheduled';
  if (eventType === 'cancelled') return 'Cancelled';
  return 'Reminder';
}

function renderPreview(text: string, tokens: Record<string, string>): string {
  return text.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (full, tokenName) => {
    const key = String(tokenName ?? '').toLowerCase();
    return tokens[key] ?? full;
  });
}

function resolveActiveTemplate(slot: TemplateSlot): {
  source: 'custom' | 'system';
  name: string;
  subject: string | null;
  body: string;
} {
  const activeCustom =
    slot.customTemplates.find((item) => item.id === slot.activeTemplateId) ?? null;
  if (slot.activeSource === 'custom' && activeCustom) {
    return {
      source: 'custom',
      name: activeCustom.name,
      subject: activeCustom.subject,
      body: activeCustom.body,
    };
  }
  return {
    source: 'system',
    name: 'System default',
    subject: slot.systemDefault.subject,
    body: slot.systemDefault.body,
  };
}

function snippet(value: string, max = 170): string {
  const compact = value.replace(/\s+/g, ' ').trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max - 1)}...`;
}

function TemplateRichEditor({
  value,
  onChange,
  tokens,
}: {
  value: string;
  onChange: (value: string) => void;
  tokens: string[];
}) {
  const { resolvedTheme } = useTheme();
  const editorRootRef = useRef<HTMLDivElement | null>(null);

  const insertToken = useCallback(
    (token: string) => {
      const editor = editorRootRef.current?.querySelector(
        'textarea.w-md-editor-text-input',
      ) as HTMLTextAreaElement | null;
      if (!editor) {
        onChange(`${value}${value && !value.endsWith('\n') ? '\n' : ''}${token}`);
        return;
      }
      const start = editor.selectionStart ?? value.length;
      const end = editor.selectionEnd ?? value.length;
      const next = `${value.slice(0, start)}${token}${value.slice(end)}`;
      onChange(next);
      requestAnimationFrame(() => {
        editor.focus();
        const cursor = start + token.length;
        editor.setSelectionRange(cursor, cursor);
      });
    },
    [onChange, value],
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/60">
      <div className="border-b border-slate-200 p-2 dark:border-slate-700">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
          Insert token
        </p>
        <div className="flex max-h-24 flex-wrap gap-1.5 overflow-auto pr-1">
          {tokens.map((token) => (
            <button
              key={token}
              type="button"
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-text-secondary transition hover:border-brand-300 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-950 dark:hover:border-brand-700 dark:hover:text-brand-300"
              onClick={() => insertToken(token)}
            >
              {token}
            </button>
          ))}
        </div>
      </div>
      <div data-color-mode={resolvedTheme === 'dark' ? 'dark' : 'light'}>
        <div ref={editorRootRef}>
          <MDEditor
            value={value}
            onChange={(next) => onChange(next ?? '')}
            preview="edit"
            height={360}
            visibleDragbar={false}
            textareaProps={{
              placeholder: 'Write your template here...',
            }}
          />
        </div>
      </div>
    </div>
  );
}

export function NotificationTemplatesSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<TemplateListResponse | null>(null);
  const [channel, setChannel] = useState<TemplateChannel>('email');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<TemplateSlot | null>(null);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [form, setForm] = useState<TemplateForm>({ subject: '', body: '' });

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiAuth<TemplateListResponse>('/settings/notification-templates');
      setData(response);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load templates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const emailSlots = useMemo(
    () => (data?.templates ?? []).filter((slot) => slot.channel === 'email'),
    [data],
  );
  const whatsappSlots = useMemo(
    () => (data?.templates ?? []).filter((slot) => slot.channel === 'whatsapp'),
    [data],
  );

  const editorPreview = useMemo(() => {
    if (!editingSlot) return { subject: null as string | null, body: '' };
    return {
      subject: editingSlot.supportsSubject
        ? renderPreview(form.subject || editingSlot.systemDefault.subject || '', SAMPLE_TOKEN_VALUES)
        : null,
      body: renderPreview(form.body || editingSlot.systemDefault.body, SAMPLE_TOKEN_VALUES),
    };
  }, [editingSlot, form.subject, form.body]);

  const openEditor = useCallback((slot: TemplateSlot) => {
    const activeCustom =
      slot.customTemplates.find((item) => item.id === slot.activeTemplateId) ?? null;
    setEditingSlot(slot);
    setEditingTemplateId(activeCustom?.id ?? null);
    setForm({
      subject: activeCustom?.subject ?? slot.systemDefault.subject ?? '',
      body: activeCustom?.body ?? slot.systemDefault.body,
    });
    setDialogOpen(true);
  }, []);

  async function saveTemplate(e: React.FormEvent) {
    e.preventDefault();
    if (!editingSlot) return;

    const trimmedBody = form.body.trim();
    const trimmedSubject = form.subject.trim();

    if (!trimmedBody) {
      toast.error('Template body is required');
      return;
    }
    if (editingSlot.supportsSubject && !trimmedSubject) {
      toast.error('Template subject is required');
      return;
    }

    setSaving(true);
    try {
      if (editingTemplateId) {
        await apiAuth(`/settings/notification-templates/${editingTemplateId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            subject: editingSlot.supportsSubject ? trimmedSubject : null,
            body: trimmedBody,
            setAsDefault: true,
          }),
        });
      } else {
        await apiAuth('/settings/notification-templates', {
          method: 'POST',
          body: JSON.stringify({
            channel: editingSlot.channel,
            audience: editingSlot.audience,
            eventType: editingSlot.eventType,
            name: `Custom ${editingSlot.label}`,
            subject: editingSlot.supportsSubject ? trimmedSubject : null,
            body: trimmedBody,
            setAsDefault: true,
          }),
        });
      }

      toast.success('Template saved');
      setDialogOpen(false);
      await loadTemplates();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save template');
    } finally {
      setSaving(false);
    }
  }

  async function restoreDefault(slot: TemplateSlot) {
    const templateId =
      slot.activeTemplateId ??
      slot.customTemplates.find((item) => item.isDefault)?.id ??
      null;
    if (!templateId) {
      toast.message('Already using system default');
      return;
    }
    try {
      await apiAuth(`/settings/notification-templates/${templateId}/restore-system`, {
        method: 'POST',
      });
      toast.success('System default restored');
      await loadTemplates();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not restore template');
    }
  }

  function renderCards(slots: TemplateSlot[]) {
    if (slots.length === 0) {
      return (
        <div className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-text-secondary dark:border-slate-700">
          No templates in this channel.
        </div>
      );
    }

    return (
      <div className="grid auto-rows-fr gap-4 md:grid-cols-2 xl:grid-cols-3">
        {slots.map((slot) => {
          const active = resolveActiveTemplate(slot);
          const previewSubject = active.subject
            ? renderPreview(active.subject, SAMPLE_TOKEN_VALUES)
            : null;
          const previewBody = renderPreview(active.body, SAMPLE_TOKEN_VALUES);

          return (
            <Card key={slot.key} className="h-full border-slate-200 dark:border-slate-800">
              <CardBody className="flex h-full flex-col p-4">
                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-text-primary">{slot.label}</p>
                    <span
                      className={cn(
                        'rounded-md border px-2 py-1 text-[11px] font-medium',
                        active.source === 'custom'
                          ? 'border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-700 dark:bg-brand-900/30 dark:text-brand-200'
                          : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200',
                      )}
                    >
                      {active.source === 'custom' ? 'Custom' : 'System'}
                    </span>
                  </div>
                  <p className="mb-3 text-xs text-text-secondary">{slot.description}</p>
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-text-secondary dark:border-slate-700 dark:bg-slate-900">
                      {formatAudience(slot.audience)}
                    </span>
                    <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-text-secondary dark:border-slate-700 dark:bg-slate-900">
                      {formatEvent(slot.eventType)}
                    </span>
                  </div>
                  {previewSubject ? (
                    <p className="mb-1 text-xs text-text-secondary">
                      Subject:{' '}
                      <span className="font-medium text-text-primary">
                        {snippet(previewSubject, 60)}
                      </span>
                    </p>
                  ) : null}
                  <p className="text-xs text-text-secondary">{snippet(previewBody, 180)}</p>
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <Button type="button" size="sm" onClick={() => openEditor(slot)}>
                    <Edit3 className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void restoreDefault(slot)}
                    disabled={active.source !== 'custom'}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Restore default
                  </Button>
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!data) {
    return (
      <Card className="border-slate-200 dark:border-slate-800">
        <CardBody className="p-5 sm:p-6">
          <p className="text-sm text-text-secondary">Could not load templates.</p>
          <Button
            type="button"
            variant="outline"
            className="mt-3"
            onClick={() => void loadTemplates()}
          >
            Retry
          </Button>
        </CardBody>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-slate-200 dark:border-slate-800">
        <CardBody className="p-5 sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold text-text-primary">Templates</h2>
              <p className="text-sm text-text-secondary">
                Edit notification templates channel by channel.
              </p>
            </div>
          </div>

          <Tabs
            value={channel}
            onValueChange={(value) => setChannel(value as TemplateChannel)}
            className="space-y-4"
          >
            <TabsList className="h-11 rounded-xl border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <TabsTrigger
                value="email"
                className="rounded-lg px-4 data-[state=active]:bg-brand-600 data-[state=active]:text-white"
              >
                Email
              </TabsTrigger>
              <TabsTrigger
                value="whatsapp"
                className="rounded-lg px-4 data-[state=active]:bg-brand-600 data-[state=active]:text-white"
              >
                WhatsApp
              </TabsTrigger>
            </TabsList>

            <TabsContent value="email" className="mt-0">
              {renderCards(emailSlots)}
            </TabsContent>
            <TabsContent value="whatsapp" className="mt-0">
              {renderCards(whatsappSlots)}
            </TabsContent>
          </Tabs>
        </CardBody>
      </Card>

      <Card className="mt-6 border-slate-200 dark:border-slate-800">
        <CardBody className="p-5 sm:p-6">
          <p className="text-sm font-semibold text-text-primary">Available tokens</p>
          <p className="mt-1 text-xs text-text-secondary">
            Click tokens in editor to insert at cursor.
          </p>
          <div className="mt-3 flex max-h-36 flex-wrap gap-2 overflow-auto pr-1">
            {data.supportedTokens.map((token) => (
              <code
                key={token}
                className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-text-secondary dark:border-slate-700 dark:bg-slate-900"
              >
                {token}
              </code>
            ))}
          </div>
        </CardBody>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="grid h-[92vh] w-[min(96vw,1180px)] max-w-none grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:h-[90vh]">
          <DialogHeader className="border-b border-slate-200 px-6 py-4 pr-12 dark:border-slate-800">
            <DialogTitle>{editingSlot?.label ?? 'Edit template'}</DialogTitle>
            <DialogDescription>
              {editingSlot?.description ?? 'Update template text'}
            </DialogDescription>
          </DialogHeader>

          {editingSlot ? (
            <form
              className="flex min-h-0 flex-col overflow-hidden"
              onSubmit={saveTemplate}
            >
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
                {editingSlot.supportsSubject ? (
                  <div>
                    <Label htmlFor="template-subject">Subject</Label>
                    <Input
                      id="template-subject"
                      value={form.subject}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, subject: e.target.value }))
                      }
                      placeholder="Subject"
                      required
                    />
                  </div>
                ) : null}

                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <Label htmlFor="template-body">Template editor</Label>
                    <TemplateRichEditor
                      value={form.body}
                      onChange={(body) => setForm((prev) => ({ ...prev, body }))}
                      tokens={data.supportedTokens}
                    />
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/60">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                      Live preview (sample data)
                    </p>
                    {editingSlot.channel === 'email' ? (
                      <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-950">
                        {editingSlot.supportsSubject ? (
                          <>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                              Subject
                            </p>
                            <p className="mt-1 text-sm font-medium text-text-primary">
                              {editorPreview.subject || '(No subject)'}
                            </p>
                          </>
                        ) : null}
                        <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                          Body
                        </p>
                        <pre className="mt-1 max-h-72 overflow-auto whitespace-pre-wrap text-xs text-text-secondary">
                          {editorPreview.body}
                        </pre>
                      </div>
                    ) : (
                      <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 dark:border-emerald-800 dark:bg-emerald-950/20">
                        <p className="whitespace-pre-wrap text-sm text-text-primary">
                          {editorPreview.body}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <DialogFooter className="gap-2 border-t border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-900 sm:gap-0">
                {editingSlot.activeSource === 'custom' ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void restoreDefault(editingSlot)}
                  >
                    <RotateCcw className="h-4 w-4" />
                    Restore default
                  </Button>
                ) : null}
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" loading={saving}>
                  Save template
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
