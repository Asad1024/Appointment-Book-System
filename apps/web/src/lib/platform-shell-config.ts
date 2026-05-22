import {
  BarChart3,
  Building2,
  CreditCard,
  LayoutDashboard,
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

export const platformNavCategories: ShellNavCategory[] = [
  {
    title: 'Main',
    items: [{ href: '/platform/dashboard', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    title: 'Platform',
    items: [
      { href: '/platform/organizations', label: 'Organizations', icon: Building2 },
      { href: '/platform/payments', label: 'Payments', icon: CreditCard },
      { href: '/platform/reports', label: 'Reports', icon: BarChart3 },
    ],
  },
];

export const platformShellMeta = {
  logoHref: '/platform/dashboard',
  dashboardPathPrefix: '/platform/dashboard',
  notificationsPath: '/platform/notifications',
  settingsPath: '/platform/settings',
  showLocationSwitcher: true,
  showNotifications: true,
  showSettings: true,
  mobileColumns: 4 as const,
};
