'use client';

import { Search } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

export type ResourceToolbarFilter = {
  id: string;
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
};

type ResourceListToolbarProps = {
  searchValue: string;
  onSearchValueChange: (value: string) => void;
  searchPlaceholder: string;
  showArchived: boolean;
  onShowArchivedChange: (value: boolean) => void;
  summary: string;
  filters?: ResourceToolbarFilter[];
};

export function ResourceListToolbar({
  searchValue,
  onSearchValueChange,
  searchPlaceholder,
  showArchived,
  onShowArchivedChange,
  summary,
  filters = [],
}: ResourceListToolbarProps) {
  return (
    <Card className="mb-4 border-slate-200 shadow-sm dark:border-slate-800">
      <CardBody className="p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="min-w-0 flex-1">
            <Label htmlFor="resource-search" className="mb-1.5 block">
              Search
            </Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <Input
                id="resource-search"
                value={searchValue}
                onChange={(e) => onSearchValueChange(e.target.value)}
                placeholder={searchPlaceholder}
                className="pl-9"
              />
            </div>
          </div>

          {filters.map((filter) => (
            <div key={filter.id} className="w-full lg:w-48">
              <Label className="mb-1.5 block">{filter.label}</Label>
              <Select value={filter.value} onValueChange={filter.onValueChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {filter.options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2.5 text-sm font-medium text-text-secondary">
            <Switch checked={showArchived} onCheckedChange={onShowArchivedChange} />
            Show archived
          </label>
          <p className="text-sm text-text-muted">{summary}</p>
        </div>
      </CardBody>
    </Card>
  );
}
