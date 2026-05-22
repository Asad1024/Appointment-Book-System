import { redirect } from 'next/navigation';

/** Legacy route - workspace sign-in now lives on /login. */
export default function AdminLoginRedirectPage() {
  redirect('/login?next=%2Fadmin%2Fdashboard');
}
