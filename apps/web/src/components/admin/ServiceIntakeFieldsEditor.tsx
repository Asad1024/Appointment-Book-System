'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiAuth } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

type IntakeField = {
  id: string;
  label: string;
  helpText?: string | null;
  type: string;
  options?: string[] | null;
  required: boolean;
  order: number;
};

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'textarea', label: 'Long Text' },
  { value: 'select', label: 'Dropdown' },
  { value: 'checkbox', label: 'Checkboxes' },
  { value: 'number', label: 'Number' },
];

const emptyForm = {
  label: '',
  helpText: '',
  type: 'text',
  options: [] as string[],
  required: false,
};

function SortableField({
  field,
  onEdit,
  onDelete,
}: {
  field: IntakeField;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: field.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="flex items-center gap-2 rounded-lg border border-slate-100 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
    >
      <button type="button" className="cursor-grab text-text-muted" {...attributes} {...listeners}>
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-text-primary">{field.label}</p>
        <p className="text-xs text-text-secondary capitalize">
          {field.type.replace('_', ' ')}
          {field.required && ' · Required'}
        </p>
      </div>
      <Button type="button" variant="ghost" size="icon" onClick={onEdit}>
        <Pencil className="h-4 w-4" />
      </Button>
      <Button type="button" variant="ghost" size="icon" className="text-red-600" onClick={onDelete}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </li>
  );
}

export function ServiceIntakeFieldsEditor({ serviceId }: { serviceId: string }) {
  const [fields, setFields] = useState<IntakeField[]>([]);
  const [loading, setLoading] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState<IntakeField | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [optionInput, setOptionInput] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setFields(await apiAuth<IntakeField[]>(`/catalog/services/${serviceId}/intake-fields`));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load intake fields');
    } finally {
      setLoading(false);
    }
  }, [serviceId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveField() {
    if (!form.label.trim()) {
      toast.error('Label is required');
      return;
    }
    if ((form.type === 'select' || form.type === 'checkbox') && form.options.length < 2) {
      toast.error('Add at least 2 options');
      return;
    }
    try {
      if (editing) {
        await apiAuth(`/catalog/intake-fields/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            label: form.label,
            helpText: form.helpText || null,
            type: form.type,
            options: form.type === 'select' || form.type === 'checkbox' ? form.options : null,
            required: form.required,
          }),
        });
        toast.success('Question updated');
      } else {
        await apiAuth(`/catalog/services/${serviceId}/intake-fields`, {
          method: 'POST',
          body: JSON.stringify({
            label: form.label,
            helpText: form.helpText || null,
            type: form.type,
            options: form.type === 'select' || form.type === 'checkbox' ? form.options : null,
            required: form.required,
            order: fields.length,
          }),
        });
        toast.success('Question added');
      }
      setPanelOpen(false);
      setEditing(null);
      setForm(emptyForm);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    }
  }

  async function deleteField(id: string) {
    try {
      await apiAuth(`/catalog/intake-fields/${id}`, { method: 'DELETE' });
      toast.success('Question removed');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  async function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = fields.findIndex((f) => f.id === active.id);
    const newIndex = fields.findIndex((f) => f.id === over.id);
    const reordered = arrayMove(fields, oldIndex, newIndex);
    setFields(reordered);
    try {
      await apiAuth(`/catalog/services/${serviceId}/intake-fields/reorder`, {
        method: 'POST',
        body: JSON.stringify({ orderedIds: reordered.map((f) => f.id) }),
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Reorder failed');
      await load();
    }
  }

  function openEdit(f: IntakeField) {
    setEditing(f);
    setForm({
      label: f.label,
      helpText: f.helpText ?? '',
      type: f.type,
      options: f.options ?? [],
      required: f.required,
    });
    setPanelOpen(true);
  }

  function addOption() {
    const v = optionInput.trim();
    if (!v) return;
    setForm((f) => ({ ...f, options: [...f.options, v] }));
    setOptionInput('');
  }

  const needsOptions = form.type === 'select' || form.type === 'checkbox';

  return (
    <div className="space-y-4">
      {loading ? (
        <p className="text-sm text-text-secondary">Loading…</p>
      ) : fields.length === 0 && !panelOpen ? (
        <p className="text-sm text-text-secondary">
          No intake questions yet. Add one to collect information from customers before they book.
        </p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => void onDragEnd(e)}>
          <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
            <ul className="space-y-2">
              {fields.map((f) => (
                <SortableField key={f.id} field={f} onEdit={() => openEdit(f)} onDelete={() => void deleteField(f.id)} />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      {!panelOpen && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setEditing(null);
            setForm(emptyForm);
            setPanelOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Question
        </Button>
      )}

      {panelOpen && (
        <div className="rounded-xl border border-slate-200 bg-surface-subtle p-4 dark:border-slate-700">
          <div className="space-y-3">
            <div>
              <Label>Label</Label>
              <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} required />
            </div>
            <div>
              <Label>Help text (optional)</Label>
              <Input value={form.helpText} onChange={(e) => setForm({ ...form, helpText: e.target.value })} />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v, options: [] })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={form.required} onCheckedChange={(c) => setForm({ ...form, required: c })} />
              Required
            </label>
            {needsOptions && (
              <div>
                <Label>Options (min 2)</Label>
                <div className="mt-2 flex flex-wrap gap-1">
                  {form.options.map((o) => (
                    <span
                      key={o}
                      className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2 py-0.5 text-xs dark:bg-brand-900"
                    >
                      {o}
                      <button
                        type="button"
                        className="text-brand-700"
                        onClick={() => setForm((f) => ({ ...f, options: f.options.filter((x) => x !== o) }))}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="mt-2 flex gap-2">
                  <Input
                    value={optionInput}
                    placeholder="Type option, press Enter"
                    onChange={(e) => setOptionInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addOption();
                      }
                    }}
                  />
                  <Button type="button" variant="outline" onClick={addOption}>
                    Add
                  </Button>
                </div>
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <Button type="button" onClick={() => void saveField()}>
                {editing ? 'Save changes' : 'Add Question'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setPanelOpen(false);
                  setEditing(null);
                  setForm(emptyForm);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
