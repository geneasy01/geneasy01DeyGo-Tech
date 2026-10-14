'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle2,
  CreditCard,
  Shield,
  Users,
  Navigation,
  Siren,
  Wallet,
  Zap,
  Crown,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import type { Subscription as SubscriptionType } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const plans = [
  {
    name: 'Free',
    price: '₦0',
    period: 'forever',
    description: 'Essential emergency tools for everyone.',
    features: [
      { icon: Siren, label: 'SOS Alerts' },
      { icon: Navigation, label: 'Journey Guard' },
      { icon: Users, label: 'Emergency Contacts' },
      { icon: Shield, label: 'Basic Support' },
    ],
    cta: 'Current Plan',
    highlighted: false,
  },
  {
    name: 'Premium',
    price: '₦2,500',
    period: 'per month',
    description: 'Advanced protection for you and your family.',
    features: [
      { icon: Siren, label: 'Everything in Free' },
      { icon: Users, label: 'Family Tracking' },
      { icon: Navigation, label: 'Journey Monitoring' },
      { icon: Zap, label: 'Priority Response' },
      { icon: Wallet, label: 'Emergency Wallet' },
      { icon: Shield, label: '24/7 Dedicated Support' },
    ],
    cta: 'Upgrade to Premium',
    highlighted: true,
  },
];

export default function SubscriptionPage() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionType | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      setSubscription(data as SubscriptionType | null);
      setLoading(false);
    })();
  }, [user]);

  const callManageSubscription = async (action: 'upgrade' | 'downgrade') => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/manage-subscription`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        Apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
      },
      body: JSON.stringify({ action }),
    });

    if (!res.ok) return null;
    const json = await res.json();
    return (json?.subscription as SubscriptionType) ?? null;
  };

  const handleUpgrade = async () => {
    if (!user) return;
    setUpgrading(true);
    const updated = await callManageSubscription('upgrade');
    if (updated) setSubscription(updated);
    setUpgrading(false);
  };

  const handleDowngrade = async () => {
    if (!user) return;
    const updated = await callManageSubscription('downgrade');
    if (updated) setSubscription(updated);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const currentPlan = subscription?.plan || 'free';

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground md:text-3xl">Subscription</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose the plan that keeps you and your family protected.
        </p>
      </div>

      {/* Current plan status */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Card className="glass-strong rounded-2xl border-white/10">
          <CardContent className="flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
            <div className="flex items-center gap-4">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                  currentPlan === 'premium'
                    ? 'bg-primary/10'
                    : 'bg-white/5'
                }`}
              >
                {currentPlan === 'premium' ? (
                  <Crown className="h-6 w-6 text-primary" />
                ) : (
                  <Shield className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div>
                <div className="text-sm font-medium text-foreground">
                  Current Plan: {currentPlan === 'premium' ? 'Premium' : 'Free'}
                </div>
                <div className="text-xs text-muted-foreground">
                  {subscription?.status === 'active' && 'Active'}
                  {subscription?.expires_at && currentPlan === 'premium' && (
                    <span>
                      {' '}
                      • Renews on{' '}
                      {new Date(subscription.expires_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <CreditCard className="h-5 w-5 text-muted-foreground" />
          </CardContent>
        </Card>
      </motion.div>

      {/* Plans */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {plans.map((plan, i) => {
          const isCurrent = currentPlan === plan.name.toLowerCase();
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 + i * 0.1 }}
            >
              <Card
                className={`relative h-full rounded-2xl transition-all ${
                  plan.highlighted
                    ? 'glass-strong border-primary/30 shadow-glow-red'
                    : 'glass-card border-white/5'
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-xs font-medium text-white">
                    Most Popular
                  </div>
                )}
                <CardHeader>
                  <div className="flex items-center gap-2">
                    {plan.highlighted ? (
                      <Crown className="h-5 w-5 text-primary" />
                    ) : (
                      <Shield className="h-5 w-5 text-muted-foreground" />
                    )}
                    <CardTitle className="text-lg">{plan.name}</CardTitle>
                  </div>
                  <p className="text-sm text-muted-foreground">{plan.description}</p>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-foreground">
                      {plan.price}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      / {plan.period}
                    </span>
                  </div>

                  <ul className="mt-6 space-y-3">
                    {plan.features.map((feature, fi) => (
                      <li
                        key={fi}
                        className="flex items-center gap-3 text-sm text-foreground"
                      >
                        <feature.icon
                          className={`h-4.5 w-4.5 flex-shrink-0 ${
                            plan.highlighted ? 'text-primary' : 'text-green-400'
                          }`}
                        />
                        {feature.label}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-8">
                    {isCurrent ? (
                      <Button variant="outline" className="w-full glass" disabled>
                        <CheckCircle2 className="mr-2 h-4 w-4 text-green-400" />
                        Current Plan
                      </Button>
                    ) : plan.name === 'Premium' ? (
                      <Button
                        className="w-full bg-primary text-white hover:bg-red-600"
                        onClick={handleUpgrade}
                        disabled={upgrading}
                      >
                        {upgrading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            {plan.cta}
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </>
                        )}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        className="w-full glass"
                        onClick={handleDowngrade}
                      >
                        Downgrade to Free
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Payment note */}
      <div className="flex items-start gap-3 rounded-2xl border border-white/5 bg-white/5 p-4">
        <CreditCard className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Payment integration coming soon. Premium features are currently available
          at no cost during the beta period. Your subscription will be activated
          immediately upon upgrade.
        </p>
      </div>
    </div>
  );
}
