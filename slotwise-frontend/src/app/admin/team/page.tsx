'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  Filter,
  Link2,
  Mail,
  MoreHorizontal,
  Pause,
  Play,
  Send,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiAuth } from '@/lib/api';
import { handlePlanLimitError } from '@/lib/plan-limit';
import { useAdminLocation } from '@/lib/admin-location-context';
import { useStaffSession } from '@/lib/useStaffSession';
import { AdminBookAppointmentHeadingButton } from '@/components/appointments/AdminBookAppointmentHeadingButton';
import { PageTransition } from '@/components/motion/PageTransition';
import { SlideOver } from '@/components/admin/SlideOver';
import { ResourceListToolbar } from '@/components/admin/ResourceListToolbar';
import { CatalogStatusBadge } from '@/components/admin/CatalogStatusBadge';
import { EmptyState } from '@/components/admin/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { InitialsAvatar } from '@/components/shared/InitialsAvatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

const STAFF_ROLES = [
  { value: 'org_admin', label: 'Admin - full access' },
  { value: 'location_manager', label: 'Manager - schedules & reports' },
];

const MANAGER_ONLY_INVITE_ROLES = [
  { value: 'location_manager', label: 'Manager - schedules & reports' },
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
};

type Member = {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  isOwner?: boolean;
  planSuspended?: boolean;
};

type Invite = {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  createdAt?: string;
  invitedBy: { name: string };
};
type InviteResult = { acceptUrl: string; email: string; role: string; inviteEmailSent?: boolean };

function formatRoleLabel(role: string) {
  return ROLE_META[role]?.label ?? role.replace(/_/g, ' ');
}

function roleBadgeClass(role: string) {
  return ROLE_META[role]?.badgeClass ?? '';
}

function matchesRoleFilter(role: string, roleFilter: string) {
  return roleFilter === 'all' ? true : role === roleFilter;
}

const tabTriggerClass =
  'rounded-lg px-4 data-[state=active]:bg-brand-600 data-[state=active]:text-white dark:data-[state=active]:bg-brand-600 dark:data-[state=active]:text-white data-[state=inactive]:text-text-secondary';

export default function AdminTeamPage() {
  const { locationId } = useAdminLocation();
  const { user } = useStaffSession({ redirectToLogin: false });
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('location_manager');
  const [lastLink, setLastLink] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resendingInviteId, setResendingInviteId] = useState<string | null>(null);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [memberAction, setMemberAction] = useState<{ id: string; name: string } | null>(null);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [selectedInvite, setSelectedInvite] = useState<Invite | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused'>('all');
  const [activeTab, setActiveTab] = useState<'members' | 'invites'>('members');

  const loadAll = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const [m, i] = await Promise.all([
        apiAuth<Member[]>('/team/members'),
        apiAuth<Invite[]>('/team/invites'),
      ]);
      setMembers(m);
      setInvites(i);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load team data');
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    if (locationId) {
      void loadAll();
      return;
    }
    setMembers([]);
    setInvites([]);
    setLoading(false);
  }, [locationId, loadAll]);

  const totalMembersCount = members.length;
  const pendingInvitesCount = invites.length;
  const activeMembersCount = useMemo(
    () => members.filter((m) => m.isActive).length,
    [members],
  );

  const filteredMembers = useMemo(() => {
    const q = searchValue.trim().toLowerCase();
    return members.filter((member) => {
      const matchesSearch =
        q.length === 0
          ? true
          : [member.name, member.email]
              .join(' ')
              .toLowerCase()
              .includes(q);
      const matchesStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === 'active'
            ? member.isActive
            : !member.isActive;
      return matchesSearch && matchesRoleFilter(member.role, roleFilter) && matchesStatus;
    });
  }, [members, roleFilter, searchValue, statusFilter]);

  const filteredInvites = useMemo(() => {
    const q = searchValue.trim().toLowerCase();
    return invites.filter((invite) => {
      const matchesSearch =
        q.length === 0
          ? true
          : [invite.email, invite.invitedBy.name]
              .join(' ')
              .toLowerCase()
              .includes(q);
      return matchesSearch && matchesRoleFilter(invite.role, roleFilter);
    });
  }, [invites, roleFilter, searchValue]);

  const inviteRoleOptions = user?.isOwner ? STAFF_ROLES : MANAGER_ONLY_INVITE_ROLES;

  function closeInvitePanel() {
    setPanelOpen(false);
    setInviteEmail('');
    setInviteRole('location_manager');
    setLastLink('');
    setOpenMenuId(null);
  }

  function openInvitePanel() {
    setOpenMenuId(null);
    setInviteEmail('');
    setInviteRole('location_manager');
    setLastLink('');
    setPanelOpen(true);
  }

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setLastLink('');
    try {
      const body: Record<string, string> = { email: inviteEmail, role: inviteRole };
      const result = await apiAuth<InviteResult>('/team/invites', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setLastLink(result.acceptUrl);
      setInviteEmail('');
      toast.success('Invite link generated');
      setActiveTab('invites');
      await loadAll();
    } catch (err) {
      if (handlePlanLimitError(err)) return;
      toast.error(err instanceof Error ? err.message : 'Invite failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function revoke() {
    if (!revokeId) return;
    try {
      await apiAuth(`/team/invites/${revokeId}`, { method: 'DELETE' });
      toast.success('Invite deleted');
      setSelectedInvite((current) => (current?.id === revokeId ? null : current));
      await loadAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete invite');
    } finally {
      setRevokeId(null);
    }
  }

  async function resendInvite(inv: Invite) {
    setResendingInviteId(inv.id);
    try {
      const result = await apiAuth<InviteResult>(`/team/invites/${inv.id}/resend`, {
        method: 'POST',
      });
      setLastLink(result.acceptUrl);
      toast.success(result.inviteEmailSent === false ? 'Invite link regenerated' : 'Invite resent');
      await loadAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to resend invite');
    } finally {
      setResendingInviteId(null);
    }
  }

  async function toggleMemberActive(m: Member) {
    try {
      await apiAuth(`/team/members/${m.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !m.isActive }),
      });
      toast.success(m.isActive ? 'Member deactivated' : 'Member activated');
      await loadAll();
    } catch (e) {
      if (handlePlanLimitError(e)) return;
      toast.error(e instanceof Error ? e.message : 'Update failed');
    }
  }

  async function removeMember() {
    if (!memberAction) return;
    try {
      await apiAuth(`/team/members/${memberAction.id}`, { method: 'DELETE' });
      toast.success('Member removed');
      await loadAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to remove member');
    } finally {
      setMemberAction(null);
    }
  }

  function canManageMember(m: Member) {
    if (!user) return false;
    if (m.id === user.id) return false;
    if (m.isOwner) return false;
    return true;
  }

  function openMemberDetails(m: Member) {
    setOpenMenuId(null);
    setSelectedMember(m);
  }

  function openInviteDetails(inv: Invite) {
    setOpenMenuId(null);
    setSelectedInvite(inv);
  }

  function renderMemberActions(m: Member, scope: 'desktop' | 'mobile') {
    if (!canManageMember(m)) return null;

    const menuItemClass =
      'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-text-primary transition hover:bg-surface-muted';
    const iconClass = 'h-4 w-4 shrink-0 text-text-secondary';
    const menuKey = `member:${scope}:${m.id}`;

    return (
      <Popover
        open={openMenuId === menuKey}
        onOpenChange={(open) => setOpenMenuId(open ? menuKey : null)}
      >
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-lg text-text-secondary hover:bg-surface-muted hover:text-text-primary data-[state=open]:bg-surface-muted"
          >
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Open member actions</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-48 rounded-xl border border-slate-200 p-2 shadow-lg dark:border-slate-700">
          <button
            type="button"
            className={menuItemClass}
            onClick={() => {
              setOpenMenuId(null);
              void toggleMemberActive(m);
            }}
          >
            {m.isActive ? <Pause className={iconClass} /> : <Play className={iconClass} />}
            {m.isActive ? 'Deactivate' : 'Activate'}
          </button>
          <button
            type="button"
            className={`${menuItemClass} text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30`}
            onClick={() => {
              setOpenMenuId(null);
              setMemberAction({ id: m.id, name: m.name });
            }}
          >
            <Trash2 className="h-4 w-4 shrink-0 text-red-500" />
            Delete
          </button>
        </PopoverContent>
      </Popover>
    );
  }

  function renderInviteActions(inv: Invite, scope: 'desktop' | 'mobile') {
    const menuItemClass =
      'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-text-primary transition hover:bg-surface-muted';
    const menuKey = `invite:${scope}:${inv.id}`;

    return (
      <Popover
        open={openMenuId === menuKey}
        onOpenChange={(open) => setOpenMenuId(open ? menuKey : null)}
      >
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-lg text-text-secondary hover:bg-surface-muted hover:text-text-primary data-[state=open]:bg-surface-muted"
          >
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Open invite actions</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-48 rounded-xl border border-slate-200 p-2 shadow-lg dark:border-slate-700">
          <button
            type="button"
            className={menuItemClass}
            disabled={resendingInviteId === inv.id}
            onClick={() => {
              setOpenMenuId(null);
              void resendInvite(inv);
            }}
          >
            <Send className="h-4 w-4 shrink-0 text-text-secondary" />
            {resendingInviteId === inv.id ? 'Resending...' : 'Resend invite'}
          </button>
          <button
            type="button"
            className={`${menuItemClass} text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30`}
            onClick={() => {
              setOpenMenuId(null);
              setRevokeId(inv.id);
            }}
          >
            <Trash2 className="h-4 w-4 shrink-0 text-red-500" />
            Delete
          </button>
        </PopoverContent>
      </Popover>
    );
  }

  function renderMemberRow(m: Member, mobile?: boolean) {
    if (mobile) {
      return (
        <div
          key={m.id}
          className="cursor-pointer rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:bg-surface-muted/50 dark:border-slate-800 dark:bg-slate-900"
          onClick={() => openMemberDetails(m)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') openMemberDetails(m);
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <InitialsAvatar
                name={m.name}
                className="h-9 w-9 bg-brand-100 text-xs text-brand-700 dark:bg-brand-900/40 dark:text-brand-200"
              />
              <div className="min-w-0">
                <p className="truncate font-semibold text-text-primary">{m.name}</p>
                <p className="truncate text-xs text-text-secondary">{m.email}</p>
              </div>
            </div>
            <div
              className="flex shrink-0 items-center gap-1.5"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <CatalogStatusBadge isActive={m.isActive} planSuspended={m.planSuspended} />
              {renderMemberActions(m, 'mobile')}
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge className={cn('font-semibold', roleBadgeClass(m.role))}>
              {formatRoleLabel(m.role)}
            </Badge>
            {m.isOwner ? (
              <Badge className="border border-emerald-200 bg-emerald-50 font-semibold text-emerald-700 dark:border-emerald-800/70 dark:bg-emerald-900/40 dark:text-emerald-200">
                Owner
              </Badge>
            ) : null}
          </div>
        </div>
      );
    }

    return (
      <tr
        key={m.id}
        className="group cursor-pointer transition-colors hover:bg-surface-muted/70"
        onClick={() => openMemberDetails(m)}
      >
        <td className="px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <InitialsAvatar
              name={m.name}
              className="h-9 w-9 bg-brand-100 text-xs text-brand-700 dark:bg-brand-900/40 dark:text-brand-200"
            />
            <p className="truncate font-semibold text-text-primary">{m.name}</p>
          </div>
        </td>
        <td className="px-4 py-3 text-text-secondary">
          <span className="block truncate">{m.email}</span>
        </td>
        <td className="px-4 py-3">
          <Badge className={cn('font-semibold', roleBadgeClass(m.role))}>
            {formatRoleLabel(m.role)}
          </Badge>
          {m.isOwner ? (
            <Badge className="ml-2 border border-emerald-200 bg-emerald-50 font-semibold text-emerald-700 dark:border-emerald-800/70 dark:bg-emerald-900/40 dark:text-emerald-200">
              Owner
            </Badge>
          ) : null}
        </td>
        <td className="px-4 py-3">
          <CatalogStatusBadge isActive={m.isActive} planSuspended={m.planSuspended} />
        </td>
        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
          {renderMemberActions(m, 'desktop')}
        </td>
      </tr>
    );
  }

  function renderInviteRow(inv: Invite, mobile?: boolean) {
    if (mobile) {
      return (
        <div
          key={inv.id}
          className="cursor-pointer rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:bg-surface-muted/50 dark:border-slate-800 dark:bg-slate-900"
          onClick={() => openInviteDetails(inv)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') openInviteDetails(inv);
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-semibold text-text-primary">{inv.email}</p>
              <p className="mt-0.5 text-xs text-text-secondary">Invited by {inv.invitedBy.name}</p>
              <p className="mt-1 text-xs text-text-muted">
                Expires {new Date(inv.expiresAt).toLocaleDateString()}
              </p>
            </div>
            <div
              className="flex shrink-0 items-center gap-1.5"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <Badge
                variant="pending"
                className="border border-amber-200 font-semibold dark:border-amber-800/70 dark:bg-amber-900/40 dark:text-amber-200"
              >
                Pending
              </Badge>
              {renderInviteActions(inv, 'mobile')}
            </div>
          </div>
          <div className="mt-2">
            <Badge className={cn('font-semibold', roleBadgeClass(inv.role))}>
              {formatRoleLabel(inv.role)}
            </Badge>
          </div>
        </div>
      );
    }

    return (
      <tr
        key={inv.id}
        className="group cursor-pointer transition-colors hover:bg-surface-muted/70"
        onClick={() => openInviteDetails(inv)}
      >
        <td className="px-4 py-3">
          <span className="block truncate font-medium text-text-primary">{inv.email}</span>
        </td>
        <td className="px-4 py-3">
          <Badge className={cn('font-semibold', roleBadgeClass(inv.role))}>
            {formatRoleLabel(inv.role)}
          </Badge>
        </td>
        <td className="px-4 py-3">
          <Badge
            variant="pending"
            className="border border-amber-200 font-semibold dark:border-amber-800/70 dark:bg-amber-900/40 dark:text-amber-200"
          >
            Pending
          </Badge>
        </td>
        <td className="px-4 py-3 text-text-secondary">{inv.invitedBy.name}</td>
        <td className="px-4 py-3 text-text-secondary">
          {new Date(inv.expiresAt).toLocaleDateString()}
        </td>
        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
          {renderInviteActions(inv, 'desktop')}
        </td>
      </tr>
    );
  }

  function renderMembersDesktopTable(rows: Member[]) {
    return (
      <div className="hidden md:block">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <table className="w-full table-fixed text-sm">
            <thead className="bg-slate-50/80 dark:bg-slate-900/70">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">
                <th className="w-[28%] px-4 py-3">Name</th>
                <th className="w-[30%] px-4 py-3">Email</th>
                <th className="w-[18%] px-4 py-3">Role</th>
                <th className="w-[14%] px-4 py-3">Status</th>
                <th className="w-[10%] px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map((member) => renderMemberRow(member))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  function renderInvitesDesktopTable(rows: Invite[]) {
    return (
      <div className="hidden md:block">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <table className="w-full table-fixed text-sm">
            <thead className="bg-slate-50/80 dark:bg-slate-900/70">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">
                <th className="w-[28%] px-4 py-3">Email</th>
                <th className="w-[14%] px-4 py-3">Role</th>
                <th className="w-[12%] px-4 py-3">Status</th>
                <th className="w-[18%] px-4 py-3">Invited by</th>
                <th className="w-[16%] px-4 py-3">Expires</th>
                <th className="w-[12%] px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map((invite) => renderInviteRow(invite))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  const roleFilterOptions = [
    { value: 'all', label: 'All roles' },
    { value: 'org_admin', label: 'Admin' },
    { value: 'location_manager', label: 'Manager' },
  ];

  const membersSummary = `${filteredMembers.length} member${filteredMembers.length === 1 ? '' : 's'}`;
  const invitesSummary = `${filteredInvites.length} invite${filteredInvites.length === 1 ? '' : 's'}`;

  return (
    <PageTransition>
      <div className="-mx-4 -mt-4 sm:-mx-8 sm:-mt-8">
        <div className="mb-4 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 lg:px-6">
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
                Team
              </h1>
              <p className="mt-1 text-sm text-text-secondary">
                Invite staff, assign roles, and manage who can access your workspace
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <AdminBookAppointmentHeadingButton />
              <Button onClick={openInvitePanel} disabled={!locationId}>
                <UserPlus className="mr-2 h-4 w-4" />
                Invite member
              </Button>
            </div>
          </div>
        </div>

        <div className="px-4 pb-6 sm:px-5 lg:px-6">
          <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Card className="border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <CardBody className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                      Total members
                    </p>
                    <p className="mt-1 text-xs text-text-muted">All users with staff access</p>
                  </div>
                  <div className="shrink-0 rounded-xl border border-brand-100 bg-brand-50 p-2.5 text-brand-700 dark:border-brand-700 dark:bg-brand-900/35 dark:text-brand-200">
                    <Users className="h-5 w-5" />
                  </div>
                </div>
                <p className="mt-4 font-display text-3xl font-bold tabular-nums text-text-primary">
                  {totalMembersCount}
                </p>
              </CardBody>
            </Card>
            <Card className="border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <CardBody className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                      Pending invites
                    </p>
                    <p className="mt-1 text-xs text-text-muted">Awaiting acceptance</p>
                  </div>
                  <div className="shrink-0 rounded-xl border border-amber-100 bg-amber-50 p-2.5 text-amber-700 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
                    <Mail className="h-5 w-5" />
                  </div>
                </div>
                <p className="mt-4 font-display text-3xl font-bold tabular-nums text-amber-700">
                  {pendingInvitesCount}
                </p>
              </CardBody>
            </Card>
            <Card className="border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <CardBody className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Active</p>
                    <p className="mt-1 text-xs text-text-muted">
                      {totalMembersCount - activeMembersCount} inactive
                    </p>
                  </div>
                  <div className="shrink-0 rounded-xl border border-emerald-100 bg-emerald-50 p-2.5 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                </div>
                <p className="mt-4 font-display text-3xl font-bold tabular-nums text-emerald-700">
                  {activeMembersCount}
                </p>
              </CardBody>
            </Card>
          </div>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'members' | 'invites')}>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <TabsList className="h-11 rounded-xl border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <TabsTrigger value="members" className={tabTriggerClass}>
                  Members
                </TabsTrigger>
                <TabsTrigger value="invites" className={tabTriggerClass}>
                  Pending invites
                </TabsTrigger>
              </TabsList>

              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="h-11 w-full border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:w-44">
                    <Filter className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                    <SelectValue placeholder="Role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roleFilterOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {activeTab === 'members' ? (
                  <Select
                    value={statusFilter}
                    onValueChange={(v) => setStatusFilter(v as 'all' | 'active' | 'paused')}
                  >
                    <SelectTrigger className="h-11 w-full border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:w-44">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="paused">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                ) : null}
              </div>
            </div>

            <TabsContent value="members" className="mt-0 focus-visible:outline-none">
              <ResourceListToolbar
                searchValue={searchValue}
                onSearchValueChange={setSearchValue}
                searchPlaceholder="Search by name or email..."
                showArchivedToggle={false}
                summary={membersSummary}
              />

              {loading ? (
                <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : totalMembersCount === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
                  <EmptyState
                    icon={Users}
                    title="No team members yet"
                    description="Invite colleagues to help manage bookings and schedules."
                    action={
                      <Button onClick={openInvitePanel}>
                        <UserPlus className="mr-2 h-4 w-4" />
                        Invite member
                      </Button>
                    }
                  />
                </div>
              ) : filteredMembers.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
                  <EmptyState
                    icon={Users}
                    title="No members match these filters"
                    description="Try a different search or role filter."
                  />
                </div>
              ) : (
                <>
                  {renderMembersDesktopTable(filteredMembers)}
                  <div className="space-y-3 md:hidden">
                    {filteredMembers.map((member) => renderMemberRow(member, true))}
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="invites" className="mt-0 focus-visible:outline-none">
              <ResourceListToolbar
                searchValue={searchValue}
                onSearchValueChange={setSearchValue}
                searchPlaceholder="Search by email or invited by..."
                showArchivedToggle={false}
                summary={invitesSummary}
              />

              {loading ? (
                <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : pendingInvitesCount === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
                  <EmptyState
                    icon={Mail}
                    title="No pending invites"
                    description="Generate an invite link to add someone to your team."
                    action={
                      <Button onClick={openInvitePanel}>
                        <UserPlus className="mr-2 h-4 w-4" />
                        Invite member
                      </Button>
                    }
                  />
                </div>
              ) : filteredInvites.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
                  <EmptyState
                    icon={Mail}
                    title="No invites match these filters"
                    description="Try a different search or role filter."
                  />
                </div>
              ) : (
                <>
                  {renderInvitesDesktopTable(filteredInvites)}
                  <div className="space-y-3 md:hidden">
                    {filteredInvites.map((invite) => renderInviteRow(invite, true))}
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <SlideOver
        open={panelOpen}
        onClose={closeInvitePanel}
        title="Invite member"
        description="Generate a secure link for a colleague to join your team"
      >
        <form className="space-y-4" onSubmit={sendInvite}>
          <div>
            <Label htmlFor="invite-email">Work email</Label>
            <Input
              id="invite-email"
              type="email"
              required
              placeholder="colleague@company.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
          </div>
          <div>
            <Label>Role</Label>
            <Select value={inviteRole} onValueChange={setInviteRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {inviteRoleOptions.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              type="submit"
              className="flex-1"
              loading={submitting}
              disabled={!inviteEmail.trim()}
            >
              Generate invite link
            </Button>
            <Button type="button" variant="outline" onClick={closeInvitePanel}>
              Cancel
            </Button>
          </div>
        </form>

        {lastLink ? (
          <div className="mt-6 rounded-xl border border-brand-200 bg-brand-50/80 p-4 dark:border-brand-700 dark:bg-brand-900/25">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-brand-700 dark:text-brand-200" />
              <p className="text-sm font-semibold text-brand-900 dark:text-brand-200">Share invite link</p>
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
        ) : null}
      </SlideOver>

      <SlideOver
        open={!!selectedMember}
        onClose={() => setSelectedMember(null)}
        title={selectedMember?.name ?? 'Team member'}
        description="Member profile and access controls"
      >
        {selectedMember ? (
          <div className="space-y-5">
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-surface-subtle p-4 dark:border-slate-800">
              <InitialsAvatar
                name={selectedMember.name}
                className="h-12 w-12 bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200"
              />
              <div className="min-w-0">
                <p className="truncate font-semibold text-text-primary">{selectedMember.name}</p>
                <p className="truncate text-sm text-text-secondary">{selectedMember.email}</p>
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-slate-200 p-4 text-sm dark:border-slate-800">
              <div className="flex items-center justify-between gap-3">
                <span className="text-text-secondary">Role</span>
                <span className="font-medium text-text-primary">
                  {formatRoleLabel(selectedMember.role)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-text-secondary">Status</span>
                <CatalogStatusBadge
                  isActive={selectedMember.isActive}
                  planSuspended={selectedMember.planSuspended}
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-text-secondary">Owner</span>
                <span className="font-medium text-text-primary">
                  {selectedMember.isOwner ? 'Yes' : 'No'}
                </span>
              </div>
            </div>

            {canManageMember(selectedMember) ? (
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => void toggleMemberActive(selectedMember)}
                >
                  {selectedMember.isActive ? 'Deactivate' : 'Activate'}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  className="flex-1"
                  onClick={() => {
                    setMemberAction({ id: selectedMember.id, name: selectedMember.name });
                    setSelectedMember(null);
                  }}
                >
                  Delete
                </Button>
              </div>
            ) : (
              <p className="rounded-xl border border-slate-200 bg-surface-subtle p-3 text-sm text-text-secondary dark:border-slate-800">
                This account is protected and cannot be changed from Team settings.
              </p>
            )}
          </div>
        ) : null}
      </SlideOver>

      <SlideOver
        open={!!selectedInvite}
        onClose={() => setSelectedInvite(null)}
        title={selectedInvite?.email ?? 'Pending invite'}
        description="Pending invite details and resend actions"
      >
        {selectedInvite ? (
          <div className="space-y-5">
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-800/70 dark:bg-amber-900/20">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-text-primary">{selectedInvite.email}</p>
                  <p className="mt-1 text-sm text-text-secondary">
                    Waiting for this person to accept the invite.
                  </p>
                </div>
                <Badge
                  variant="pending"
                  className="border border-amber-200 font-semibold dark:border-amber-800/70 dark:bg-amber-900/40 dark:text-amber-200"
                >
                  Pending
                </Badge>
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-slate-200 p-4 text-sm dark:border-slate-800">
              <div className="flex items-center justify-between gap-3">
                <span className="text-text-secondary">Role</span>
                <span className="font-medium text-text-primary">
                  {formatRoleLabel(selectedInvite.role)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-text-secondary">Invited by</span>
                <span className="font-medium text-text-primary">{selectedInvite.invitedBy.name}</span>
              </div>
              {selectedInvite.createdAt ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-text-secondary">Created</span>
                  <span className="font-medium text-text-primary">
                    {new Date(selectedInvite.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-3">
                <span className="text-text-secondary">Expires</span>
                <span className="font-medium text-text-primary">
                  {new Date(selectedInvite.expiresAt).toLocaleDateString()}
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                className="flex-1"
                loading={resendingInviteId === selectedInvite.id}
                onClick={() => void resendInvite(selectedInvite)}
              >
                <Send className="mr-2 h-4 w-4" />
                Resend invite
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="flex-1"
                onClick={() => {
                  setRevokeId(selectedInvite.id);
                  setSelectedInvite(null);
                }}
              >
                Delete
              </Button>
            </div>

            {lastLink ? (
              <div className="rounded-xl border border-brand-200 bg-brand-50/80 p-4 dark:border-brand-700 dark:bg-brand-900/25">
                <p className="text-sm font-semibold text-brand-900 dark:text-brand-200">
                  Latest invite link
                </p>
                <p className="mt-2 break-all rounded-lg bg-white/80 px-3 py-2 font-mono text-[11px] text-brand-900 dark:bg-slate-950/60 dark:text-brand-200">
                  {lastLink}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
      </SlideOver>

      <ConfirmDialog
        open={!!revokeId}
        onOpenChange={(o) => !o && setRevokeId(null)}
        title="Delete invite?"
        description="The invite link will no longer work."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => void revoke()}
      />

      <ConfirmDialog
        open={!!memberAction}
        onOpenChange={(o) => !o && setMemberAction(null)}
        title="Remove team member?"
        description={
          memberAction
            ? `${memberAction.name} will lose access to this workspace. This cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => void removeMember()}
      />
    </PageTransition>
  );
}
