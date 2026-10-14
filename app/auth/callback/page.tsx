'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        router.replace('/dashboard');
      } else if (event === 'SIGNED_OUT') {
        router.replace('/login');
      }
    });

    // Also check for existing session immediately
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace('/dashboard');
      }
    });

    // Fallback: redirect after 3 seconds if nothing happens
    const fallback = setTimeout(() => {
      router.replace('/dashboard');
    }, 3000);

    return () => {
      listener.subscription.unsubscribe();
      clearTimeout(fallback);
    };
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Completing sign in...</p>
      </div>
    </div>
  );
}
