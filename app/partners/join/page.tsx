'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Building2,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Lock,
  Shield,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  getInvitationByCode,
  joinPartnerByCode,
  isInvitationValid,
  PARTNER_TYPE_LABELS,
  type PartnerInvitationPublic,
} from '@/lib/partners';

export default function JoinPartnerPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();
  const code = searchParams.get('code');

  const [invitation, setInvitation] = useState<PartnerInvitationPublic | null>(null);
  const [fetching, setFetching] = useState(true);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!code) {
      setFetching(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const inv = await getInvitationByCode(code);
      if (cancelled) return;
      setInvitation(inv);
      setFetching(false);
    })();
    return () => { cancelled = true; };
  }, [code]);

  const handleJoin = async () => {
    if (!user || !code) return;
    setJoining(true);
    setError('');
    const result = await joinPartnerByCode(code, user.id);
    if (!result) {
      setError('Unable to join. The invitation may be invalid, expired, or already used up.');
      setJoining(false);
      return;
    }
    setJoined(true);
    setJoining(false);
  };

  if (loading || fetching) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!code) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <Card className="glass-strong max-w-md rounded-2xl border-red-500/20 text-center">
          <CardContent className="p-8">
            <AlertTriangle className="mx-auto h-12 w-12 text-red-400" />
            <h1 className="mt-4 text-xl font-bold text-foreground">Invalid Link</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This invitation link is missing a code. Ask your organization for a new link.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!invitation || !isInvitationValid(invitation)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <Card className="glass-strong max-w-md rounded-2xl border-red-500/20 text-center">
          <CardContent className="p-8">
            <AlertTriangle className="mx-auto h-12 w-12 text-red-400" />
            <h1 className="mt-4 text-xl font-bold text-foreground">Invitation Unavailable</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This invitation link has expired or reached its usage limit. Contact your organization for a new one.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (joined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <Card className="glass-strong max-w-md rounded-2xl border-emerald-500/20 text-center">
          <CardContent className="p-8">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" />
            <h1 className="mt-4 text-xl font-bold text-foreground">You\u2019re Connected</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              You are now a member of {invitation.organization_name}. Guardian can now recommend their emergency responders to you. Your location is never shared unless you explicitly request help.
            </p>
            <Button
              className="mt-6 bg-primary text-white hover:bg-red-600"
              onClick={() => router.push('/dashboard')}
            >
              Go to Dashboard <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background bg-grid">
      <div className="pointer-events-none absolute inset-0 bg-radial-glow" />
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 py-12">
        <Logo size="lg" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mt-8 w-full max-w-md"
        >
          <Card className="glass-strong rounded-2xl border-primary/20">
            <CardHeader className="text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                {invitation.organization_logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={invitation.organization_logo_url} alt="" className="h-full w-full rounded-2xl object-cover" />
                ) : (
                  <Building2 className="h-7 w-7 text-primary" />
                )}
              </div>
              <CardTitle className="text-xl">{invitation.organization_name}</CardTitle>
              <CardDescription>{PARTNER_TYPE_LABELS[invitation.organization_type]}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {invitation.label && (
                <div className="rounded-lg bg-white/5 p-3 text-center text-sm text-muted-foreground">
                  Invitation: {invitation.label}
                </div>
              )}

              <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                <Lock className="h-4 w-4 shrink-0 text-emerald-400" />
                <p className="text-xs text-muted-foreground">
                  By joining, you connect to this organization\u2019s emergency network. Your location is NEVER shared with them \u2014 unless you explicitly request emergency help. No tracking, no surveillance.
                </p>
              </div>

              {error && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
                  {error}
                </div>
              )}

              {!user ? (
                <div className="space-y-2">
                  <Button
                    className="w-full bg-primary text-white hover:bg-red-600"
                    onClick={() => router.push(`/login?redirect=/partners/join?code=${code}`)}
                  >
                    Sign In to Join
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full text-xs text-muted-foreground"
                    onClick={() => router.push(`/signup?redirect=/partners/join?code=${code}`)}
                  >
                    Don\u2019t have an account? Sign up
                  </Button>
                </div>
              ) : (
                <Button
                  className="w-full bg-primary text-white hover:bg-red-600"
                  onClick={handleJoin}
                  disabled={joining}
                >
                  {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                    <>
                      <Shield className="mr-2 h-4 w-4" />
                      Join {invitation.organization_name}
                    </>
                  )}
                </Button>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
