import { redirect } from 'next/navigation';

/** Legacy route — single sign-in at /login */
export default function AdminLoginRedirectPage() {
  redirect('/login');
}
