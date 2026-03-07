'use client';
import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

export default function LogoutPage() {
    const { logout } = useAuth();
      const router = useRouter();
    
    useEffect(() => {
        logout();
    router.push('/dashboard');

    }, []);
  return <p>Logging out...</p>;
}
