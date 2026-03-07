'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/skeleton'; // shadcn skeleton
import React from 'react';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { user, refresh } = useAuth();
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  useEffect(() => {
    const verify = async () => {
      try {
        // if no user yet, try refreshing
        if (!user) {
          const newToken = await refresh();
          if (!newToken) {
            router.push('/login');
            return;
          }
        }
      } catch {
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };

    verify();
  }, [user, refresh, router]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen space-y-4">
        <Skeleton className="w-32 h-8 rounded-md" />
        <Skeleton className="w-64 h-4 rounded-md" />
      </div>
    );
  }

  if (!user) return null; // avoid flicker during redirect

  return <>{children}</>;
}
