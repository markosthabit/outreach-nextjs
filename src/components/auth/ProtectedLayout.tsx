'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [isLoading, user, router]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen space-y-4">
        <Skeleton className="w-32 h-8 rounded-md" />
        <Skeleton className="w-64 h-4 rounded-md" />
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}