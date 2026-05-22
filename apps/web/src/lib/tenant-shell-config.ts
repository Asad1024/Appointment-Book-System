import {
  BarChart3,
  CalendarDays,
  KeyRound,
  LayoutDashboard,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react';

export type ShellNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
};

export type ShellNavCategory = {
  title: string;
  items: ShellNavItem[];
};

export const tenantNavCategories: ShellNavCategory[] = [
  {
    title: 'Main',
    items: [{ href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    title: 'Scheduling',
    items: [
      { href: '/admin/services', label: 'Services', icon: CalendarDays },
      { href: '/admin/providers', label: 'Providers', icon: Users },
      { href: '/admin/reports', label: 'Reports', icon: BarChart3 },
    ],
  },
  {
    title: 'Admin',
    items: [
      { href: '/admin/team', label: 'Team', icon: UserPlus, adminOnly: true },
      { href: '/admin/api-keys', label: 'Developers', icon: KeyRound, adminOnly: true },
    ],
  },
];

export const tenantShellMeta = {
  logoHref: '/admin/dashboard',
  dashboardPathPrefix: '/admin/dashboard',
  notificationsPath: '/admin/notifications',
  settingsPath: '/admin/settings',
  showLocationSwitcher: true,
  showNotifications: true,
  showSettings: true,
  mobileColumns: 5 as const,
};
