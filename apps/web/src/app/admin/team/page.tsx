'use client';

import { useEffect, useMemo, useState } from 'react';
import { Clock3, Copy, Link2, ShieldCheck, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { api, apiAuth } from '@/lib/api';
import { useAdminLocation } from '@/lib/admin-location-context';
import { PageTransition } from '@/components/motion/PageTransition';
import { EmptyState } from '@/components/admin/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { InitialsAvatar } from '@/components/shared/InitialsAvatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

const STAFF_ROLES = [
  { value: 'org_admin', label: 'Admin - full access' },
  { value: 'location_manager', label: 'Manager - schedules & reports' },
  { value: 'provider', label: 'Provider - own appointments only' },
];

const ROLE_META: Record<string, { label: string; badgeClass: string }> = {
  org_admin: {
    label: 'Admin',
    badgeClass:
      'border border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-700 dark:bg-violet-900/30 dark:text-violet-200',
  },
  location_manager: {
    label: 'Manager',
    badgeClass:
      'border border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-700 dark:bg-sky-900/30 dark:text-sky-200',
  },
  provider: {
    label: 'Provider',
    badgeClass:
      'border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200',
  },
};

type Member = {
  id: string;
  email: string;
  name: string;
  role: string;
  provider?: { name: string } | null;
};

type Invite = {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  invitedBy: { name: string };
};

type Provider = { id: string; name: string };
type InviteResult = { acceptUrl: string; email: string; role: string };

function formatRoleLabel(role: string) {
  return ROLE_META[role]?.label ?? role.replace(/_/g, ' ');
}

function roleBadgeClass(role: string) {
  return ROLE_META[role]?.badgeClass ?? '';
}

export default function AdminTeamPage() {
  const { locationId } = useAdminLocation();
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('location_manager');
  const [providerId, setProviderId] = useState('');
  const [lastLink, setLastLink] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [revokeId, setRevokeId] = useState<string | null>(null);

  const summary = useMemo(() => {
    const admins = members.filter((m) => m.role === 'org_admin').length;
    const managers = members.filter((m) => m.role === 'location_manager').length;
    const providerUsers = members.filter((m) => m.role === 'provider').length;
    return { total: members.length, invites: invites.length, admins, managers, providerUsers };
  }, [members, invites]);

  async function loadAll() {
    if (!locationId) return;
    setLoading(true);
    try {
      const [m, i, p] = await Promise.all([
        apiAuth<Member[]>('/team/members'),
        apiAuth<Invite[]>('/team/invites'),
        api<Provider[]>(`/catalog/locations/${locationId}/providers`),
      ]);
      setMembers(m);
      setInvites(i);
      setProviders(p);
      setProviderId((prev) => {
        if (prev && p.some((x) => x.id === prev)) return prev;
        return p[0]?.id ?? '';
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load team data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (locationId) {
      void loadAll();
      return;
    }
    setMembers([]);
    setInvites([]);
    setProviders([]);
    setLoading(false);
  }, [locationId]);

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    if (role === 'provider' && !providerId) {
      toast.error('Please select a provider profile');
      return;
    }
    setSubmitting(true);
    setLastLink('');
    try {
      const body: Record<string, string> = { email, role };
      if (role === 'provider') body.providerId = providerId;
      const result = await apiAuth<InviteResult>('/team/invites', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setLastLink(result.acceptUrl);
      setEmail('');
      toast.success('Invite link generated');
      await loadAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Invite failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function revoke() {
    if (!revokeId) return;
    try {
      await apiAuth(`/team/invites/${revokeId}`, { method: 'DELETE' });
      toast.success('Invite revoked');
      await loadAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to revoke invite');
    } finally {
      setRevokeId(null);
    }
  }

  if (loading) {
    return (
      <PageTransition>
        <div className="-mx-4 -mt-4 sm:-mx-8 sm:-mt-8">
          <div className="mb-5 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
            <div className="space-y-3 px-4 py-4 sm:px-5 lg:px-6">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-10 w-64" />
              <Skeleton className="h-4 w-96 max-w-full" />
              <div className="grid gap-3 sm:grid-cols-3">
                <Skeleton className="h-20 rounded-xl" />
                <Skeleton className="h-20 rounded-xl" />
                <Skeleton className="h-20 rounded-xl" />
              </div>
            </div>
          </div>
          <div className="grid gap-6 px-4 pb-6 xl:grid-cols-[360px_minmax(0,1fr)] sm:px-5 lg:px-6">
            <Skeleton className="h-[480px] rounded-2xl" />
            <div className="space-y-6">
              <Skeleton className="h-56 rounded-2xl" />
              <Skeleton className="h-72 rounded-2xl" />
            </div>
          </div>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="-mx-4 -mt-4 sm:-mx-8 sm:-mt-8">
        <div className="mb-5 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <div className="px-4 py-4 sm:px-5 lg:px-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-600 dark:text-brand-300">
                  Access Control
                </p>
                <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-text-primary">
                  Team Workspace
                </h1>
                <p className="mt-1 text-sm text-text-secondary">
                  Invite staff, assign secure roles, and keep permission management organized.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-right dark:border-slate-800 dark:bg-slate-900">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                  Total seats
                </p>
                <p className="mt-1 text-lg font-semibold text-text-primary">{summary.total}</p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Card className="border-slate-200 dark:border-slate-800">
                <CardBody className="p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Pending invites</p>
                  <p className="mt-2 font-display text-3xl font-bold text-text-primary">{summary.invites}</p>
                  <p className="mt-1 text-xs text-text-muted">Awaiting acceptance</p>
                </CardBody>
              </Card>
              <Card className="border-slate-200 dark:border-slate-800">
                <CardBody className="p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Managers</p>
                  <p className="mt-2 font-display text-3xl font-bold text-text-primary">{summary.managers}</p>
                  <p className="mt-1 text-xs text-text-muted">Location operations</p>
                </CardBody>
              </Card>
              <Card className="border-slate-200 dark:border-slate-800">
                <CardBody className="p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Providers</p>
                  <p className="mt-2 font-display text-3xl font-bold text-text-primary">{summary.providerUsers}</p>
                  <p className="mt-1 text-xs text-text-muted">Delivery accounts</p>
                </CardBody>
              </Card>
            </div>
          </div>
        </div>

        <div className="px-4 pb-6 sm:px-5 lg:px-6">
          <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
            <Card className="border border-slate-200 bg-gradient-to-br from-white via-white to-slate-50/70 shadow-sm dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800/70">
              <CardBody className="p-5">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-brand-100 bg-brand-50 text-brand-700 dark:border-brand-700 dark:bg-brand-900/35 dark:text-brand-200">
                    <UserPlus className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="font-display text-xl font-semibold text-text-primary">Invite Member</h2>
                    <p className="text-xs text-text-secondary">Generate secure access links for your team.</p>
                  </div>
                </div>

                <form className="space-y-4" onSubmit={sendInvite}>
                  <div>
                    <Label htmlFor="invite-email">Work email</Label>
                    <Input
                      id="invite-email"
                      type="email"
                      required
                      placeholder="colleague@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Role</Label>
                    <Select value={role} onValueChange={setRole}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STAFF_ROLES.map((r) => (
                          <SelectItem key={r.value} value={r.value}>
                            {r.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {role === 'provider' && (
                    <div>
                      <Label>Provider profile</Label>
                      <Select value={providerId} onValueChange={setProviderId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select provider" />
                        </SelectTrigger>
                        <SelectContent>
                          {providers.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <Button
                    type="submit"
                    disabled={submitting || !email.trim() || (role === 'provider' && !providerId)}
                    loading={submitting}
                    className="w-full"
                  >
                    Generate invite link
                  </Button>
                </form>

                {lastLink && (
                  <div className="mt-5 rounded-xl border border-brand-200 bg-brand-50/80 p-4 dark:border-brand-700 dark:bg-brand-900/25">
                    <div className="flex items-center gap-2">
                      <Link2 className="h-4 w-4 text-brand-700 dark:text-brand-200" />
                      <p className="text-sm font-semibold text-brand-900 dark:text-brand-200">Share Invite Link</p>
                    </div>
                    <p className="mt-2 break-all rounded-lg bg-white/80 px-3 py-2 font-mono text-[11px] text-brand-900 dark:bg-slate-950/60 dark:text-brand-200">
                      {lastLink}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-3 border-brand-200 text-brand-800 hover:bg-brand-100 dark:border-brand-700 dark:text-brand-200 dark:hover:bg-brand-900/35"
                      onClick={() => {
                        if (typeof navigator !== 'undefined') {
                          void navigator.clipboard.writeText(lastLink);
                        }
                        toast.success('Copied to clipboard');
                      }}
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      Copy link
                    </Button>
                  </div>
                )}
              </CardBody>
            </Card>

            <div className="space-y-6">
              <Card className="border-slate-200 dark:border-slate-800">
                <CardBody className="p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-sky-100 bg-sky-50 text-sky-700 dark:border-sky-700 dark:bg-sky-900/30 dark:text-sky-200">
                      <Clock3 className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="font-display text-xl font-semibold text-text-primary">Pending Invites</h2>
                      <p className="text-xs text-text-secondary">Track and revoke unaccepted invites.</p>
                    </div>
                  </div>

                  {invites.length === 0 ? (
                    <EmptyState icon={UserPlus} title="No pending invites" className="py-12" />
                  ) : (
                    <ul className="mt-4 space-y-3">
                      {invites.map((inv) => (
                        <li
                          key={inv.id}
                          className="rounded-xl border border-slate-200 bg-surface-subtle p-4 dark:border-slate-800 dark:bg-slate-900/60"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-text-primary">{inv.email}</p>
                              <p className="mt-1 text-xs text-text-secondary">
                                Invited by {inv.invitedBy.name}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge className={cn('font-semibold', roleBadgeClass(inv.role))}>
                                {formatRoleLabel(inv.role)}
                              </Badge>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                                onClick={() => setRevokeId(inv.id)}
                              >
                                Revoke
                              </Button>
                            </div>
                          </div>
                          <p className="mt-2 flex items-center gap-1.5 text-xs text-text-muted">
                            <Clock3 className="h-3.5 w-3.5" />
                            Expires on {new Date(inv.expiresAt).toLocaleDateString()}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardBody>
              </Card>

              <Card className="border-slate-200 dark:border-slate-800">
                <CardBody className="p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">
                      <Users className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="font-display text-xl font-semibold text-text-primary">Team Directory</h2>
                      <p className="text-xs text-text-secondary">All members with their current access level.</p>
                    </div>
                  </div>

                  {members.length === 0 ? (
                    <EmptyState icon={Users} title="No team members" className="py-12" />
                  ) : (
                    <ul className="mt-4 grid gap-3 md:grid-cols-2">
                      {members.map((m) => (
                        <li
                          key={m.id}
                          className="rounded-xl border border-slate-200 bg-surface-subtle p-4 dark:border-slate-800 dark:bg-slate-900/60"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <InitialsAvatar
                                name={m.name}
                                className="h-10 w-10 bg-brand-100 text-xs text-brand-700 dark:bg-brand-900/35 dark:text-brand-200"
                              />
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-text-primary">{m.name}</p>
                                <p className="truncate text-xs text-text-secondary">{m.email}</p>
                              </div>
                            </div>
                            <Badge className={cn('shrink-0 font-semibold', roleBadgeClass(m.role))}>
                              {formatRoleLabel(m.role)}
                            </Badge>
                          </div>

                          <div className="mt-3 flex items-center gap-2 text-xs text-text-muted">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            <span>{m.role.replace(/_/g, ' ')}</span>
                          </div>

                          {m.provider?.name && (
                            <p className="mt-1 text-xs text-text-muted">Provider profile: {m.provider.name}</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardBody>
              </Card>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={!!revokeId}
        onOpenChange={(o) => !o && setRevokeId(null)}
        title="Revoke invite?"
        description="The invite link will no longer work."
        confirmLabel="Revoke"
        variant="destructive"
        onConfirm={() => void revoke()}
      />
    </PageTransition>
  );
}
