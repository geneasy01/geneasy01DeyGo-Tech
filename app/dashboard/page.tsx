'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Siren,
  Navigation,
  Users,
  Wallet,
  Shield,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import type { Contact, Journey, SOSAlert, Subscription } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GuardianActivity } from '@/components/guardian-activity';

export default function DashboardPage() {
  const { user, profile } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [activeJourney, setActiveJourney] = useState<Journey | null>(null);
  const [sosAlerts, setSosAlerts] = useState<SOSAlert[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const [contactsRes, journeysRes, sosRes, subRes] = await Promise.all([
          supabase.from('contacts').select('*').eq('user_id', user.id),
          supabase
            .from('journeys')
            .select('*')
            .eq('user_id', user.id)
            .eq('status', 'active')
            .maybeSingle(),
          supabase
            .from('sos_alerts')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(5),
          supabase
            .from('subscriptions')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle(),
        ]);

        setContacts(contactsRes.data || []);
        setActiveJourney(journeysRes.data as Journey | null);
        setSosAlerts((sosRes.data || []) as SOSAlert[]);
        setSubscription(subRes.data as Subscription | null);
      } catch (err) {
        setError('Failed to load dashboard data');
      }
      setLoading(false);
    })();
  }, [user]);

  const quickActions = [
    {
      href: '/dashboard/sos',
      label: 'SOS Alert',
      description: 'Send emergency signal',
      icon: Siren,
      color: 'from-red-500 to-red-700',
      glow: 'shadow-glow-red',
    },
    {
      href: '/dashboard/journey',
      label: 'Journey Guard',
      description: 'Start tracking trip',
      icon: Navigation,
      color: 'from-blue-500 to-blue-700',
      glow: '',
    },
    {
      href: '/dashboard/contacts',
      label: 'Contacts',
      description: 'Manage emergency contacts',
      icon: Users,
      color: 'from-amber-500 to-amber-700',
      glow: '',
    },
    {
      href: '/dashboard/wallet',
      label: 'Wallet',
      description: 'Medical information',
      icon: Wallet,
      color: 'from-green-500 to-green-700',
      glow: '',
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Error banner */}
      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
          {error}
        </div>
      )}
      {/* Welcome header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-2xl font-bold text-foreground md:text-3xl">
          Welcome, {profile?.full_name?.split(' ')[0] || 'there'}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Stay safe. Your emergency tools are ready.
        </p>
      </motion.div>

      {/* Membership banner */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <Card className="glass-card overflow-hidden rounded-2xl border-white/5">
          <CardContent className="flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <div>
                <div className="text-sm font-medium text-foreground">
                  {subscription?.plan === 'premium' ? 'Premium Member' : 'Free Plan'}
                </div>
                <div className="text-xs text-muted-foreground">
                  {subscription?.plan === 'premium'
                    ? 'Full access to all features'
                    : 'Upgrade for family tracking & priority response'}
                </div>
              </div>
            </div>
            {subscription?.plan !== 'premium' && (
              <Link href="/dashboard/subscription">
                <Button size="sm" className="bg-primary text-white hover:bg-red-600">
                  Upgrade
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Quick Actions */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-foreground">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {quickActions.map((action, i) => (
            <motion.div
              key={action.href}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.15 + i * 0.05 }}
            >
              <Link href={action.href}>
                <Card className="glass-card group h-full cursor-pointer rounded-2xl border-white/5 transition-all hover:border-white/10 hover:shadow-lg">
                  <CardContent className="flex flex-col items-center p-5 text-center">
                    <div
                      className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${action.color} ${action.glow} transition-transform group-hover:scale-110`}
                    >
                      <action.icon className="h-7 w-7 text-white" />
                    </div>
                    <div className="mt-3 text-sm font-semibold text-foreground">
                      {action.label}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {action.description}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Active Journey */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <Card className="glass-card h-full rounded-2xl border-white/5">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Journey Guard
                </CardTitle>
                <Navigation className="h-4 w-4 text-blue-400" />
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-16 animate-pulse rounded-lg bg-white/5" />
              ) : activeJourney ? (
                <div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
                    <span className="text-sm font-semibold text-green-400">
                      Active Journey
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    To: {activeJourney.destination}
                  </div>
                  {activeJourney.expected_arrival && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      ETA: {new Date(activeJourney.expected_arrival).toLocaleTimeString()}
                    </div>
                  )}
                  <Link href="/dashboard/journey" className="mt-3 block">
                    <Button size="sm" variant="outline" className="w-full glass text-xs">
                      View Journey
                    </Button>
                  </Link>
                </div>
              ) : (
                <div>
                  <div className="text-sm text-muted-foreground">No active journey</div>
                  <Link href="/dashboard/journey" className="mt-3 block">
                    <Button size="sm" variant="outline" className="w-full glass text-xs">
                      Start Journey
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* SOS Status */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.35 }}
        >
          <Card className="glass-card h-full rounded-2xl border-white/5">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  SOS Status
                </CardTitle>
                <Siren className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-16 animate-pulse rounded-lg bg-white/5" />
              ) : (
                <div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-400" />
                    <span className="text-sm font-semibold text-green-400">
                      Ready
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {sosAlerts.length} past incident{sosAlerts.length !== 1 ? 's' : ''}
                  </div>
                  {sosAlerts.length > 0 && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      Last: {new Date(sosAlerts[0].triggered_at).toLocaleDateString()}
                    </div>
                  )}
                  <Link href="/dashboard/sos" className="mt-3 block">
                    <Button size="sm" className="w-full bg-primary text-xs text-white hover:bg-red-600">
                      SOS Button
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Emergency Contacts */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
        >
          <Card className="glass-card h-full rounded-2xl border-white/5">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Emergency Contacts
                </CardTitle>
                <Users className="h-4 w-4 text-amber-400" />
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-16 animate-pulse rounded-lg bg-white/5" />
              ) : (
                <div>
                  <div className="text-2xl font-bold text-foreground">
                    {contacts.length}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {contacts.length === 0
                      ? 'No contacts added'
                      : 'Trusted contacts ready'}
                  </div>
                  <Link href="/dashboard/contacts" className="mt-3 block">
                    <Button size="sm" variant="outline" className="w-full glass text-xs">
                      Manage Contacts
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Guardian Activity Timeline */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.45 }}
      >
        <GuardianActivity limit={15} />
      </motion.div>
    </div>
  );
}
