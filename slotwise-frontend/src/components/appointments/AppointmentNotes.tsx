'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Lock, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiAuth } from '@/lib/api';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { InitialsAvatar } from '@/components/shared/InitialsAvatar';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

export type AppointmentNoteItem = {
  id: string;
  content: string;
  editedAt: string | null;
  createdAt: string;
  author: { id: string; name: string; role: string };
};

const NOTE_MAX = 2000;

export function AppointmentNotes({
  appointmentId,
  initialNotes,
  currentUserId,
  currentUserRole,
}: {
  appointmentId: string;
  initialNotes: AppointmentNoteItem[];
  currentUserId: string;
  currentUserRole: string;
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const canManage = (note: AppointmentNoteItem) =>
    note.author.id === currentUserId ||
    currentUserRole === 'org_admin' ||
    currentUserRole === 'super_admin' ||
    currentUserRole === 'location_manager';

  async function addNote() {
    const content = draft.trim();
    if (!content) return;
    setLoading(true);
    const ghost: AppointmentNoteItem = {
      id: `ghost-${Date.now()}`,
      content,
      editedAt: null,
      createdAt: new Date().toISOString(),
      author: { id: currentUserId, name: 'You', role: currentUserRole },
    };
    setNotes((n) => [...n, ghost]);
    setDraft('');
    try {
      const created = await apiAuth<AppointmentNoteItem>(`/appointments/${appointmentId}/notes`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      });
      setNotes((n) => n.map((x) => (x.id === ghost.id ? created : x)));
      toast.success('Note added');
    } catch (e) {
      setNotes((n) => n.filter((x) => x.id !== ghost.id));
      toast.error(e instanceof Error ? e.message : 'Failed to add note');
    } finally {
      setLoading(false);
    }
  }

  async function saveEdit(noteId: string) {
    const content = editDraft.trim();
    if (!content) return;
    try {
      const updated = await apiAuth<AppointmentNoteItem>(`/appointments/${appointmentId}/notes/${noteId}`, {
        method: 'PATCH',
        body: JSON.stringify({ content }),
      });
      setNotes((n) => n.map((x) => (x.id === noteId ? updated : x)));
      setEditingId(null);
      toast.success('Note updated');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    }
  }

  async function removeNote(noteId: string) {
    try {
      await apiAuth(`/appointments/${appointmentId}/notes/${noteId}`, { method: 'DELETE' });
      setNotes((n) => n.filter((x) => x.id !== noteId));
      toast.success('Note deleted');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeleteId(null);
    }
  }

  return (
    <section className="mt-6 rounded-xl border border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="border-b border-slate-100 px-6 py-4 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-text-muted" />
          <h2 className="font-display text-lg font-semibold text-text-primary">Internal Notes</h2>
        </div>
        <p className="mt-0.5 text-xs text-text-muted">(not visible to customers)</p>
      </div>
      <div className="space-y-4 p-6">
        {notes.length === 0 ? (
          <p className="text-sm text-text-secondary">
            No notes yet. Use this space to leave context for your team — allergies, preferences, follow-up reminders.
          </p>
        ) : (
          notes.map((note) => (
            <article
              key={note.id}
              className="group flex gap-3 rounded-lg border border-slate-100 bg-surface-subtle p-4 dark:border-slate-800"
            >
              <InitialsAvatar name={note.author.name} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1 text-sm">
                  <span className="font-semibold text-text-primary">{note.author.name}</span>
                  <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] capitalize text-text-secondary dark:bg-slate-700">
                    {note.author.role.replace(/_/g, ' ')}
                  </span>
                  <span className="text-text-muted">·</span>
                  <time
                    className="text-text-muted"
                    dateTime={note.createdAt}
                    title={new Date(note.createdAt).toLocaleString()}
                  >
                    {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}
                  </time>
                  {note.editedAt && <span className="text-text-muted">· edited</span>}
                </div>
                {editingId === note.id ? (
                  <div className="mt-2 space-y-2">
                    <Textarea value={editDraft} onChange={(e) => setEditDraft(e.target.value)} rows={3} />
                    <div className="flex gap-2">
                      <Button type="button" size="sm" onClick={() => void saveEdit(note.id)}>
                        Save
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => setEditingId(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-text-primary">{note.content}</p>
                )}
                {canManage(note) && editingId !== note.id && (
                  <div className="mt-2 flex gap-1 opacity-0 transition group-hover:opacity-100">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-text-muted"
                      onClick={() => {
                        setEditingId(note.id);
                        setEditDraft(note.content);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-text-muted hover:text-red-600"
                      onClick={() => setDeleteId(note.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            </article>
          ))
        )}

        <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
          <Textarea
            placeholder="Add an internal note for your team (visible to staff only)"
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, NOTE_MAX))}
            rows={3}
          />
          <div className="mt-1 flex items-center justify-between">
            <span
              className={cn(
                'text-xs',
                draft.length > 1800 ? 'text-red-600' : 'text-text-muted',
              )}
            >
              {draft.length} / {NOTE_MAX}
            </span>
            <Button type="button" size="sm" disabled={!draft.trim() || loading} loading={loading} onClick={() => void addNote()}>
              Add Note
            </Button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Delete this note?"
        description="This cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => deleteId && void removeNote(deleteId)}
      />
    </section>
  );
}

