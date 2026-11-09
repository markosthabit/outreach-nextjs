'use client';
import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export default function LogoutPage() {
  const { logout } = useAuth();

  // logout() clears the session and sends the user to /login itself
  // (this page used to also push /dashboard, racing that redirect)
  useEffect(() => {
    logout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-svh items-center justify-center" dir="rtl">
      <p className="text-muted-foreground animate-pulse">بنخرّجك من حسابك...</p>
    </div>
  );
}
