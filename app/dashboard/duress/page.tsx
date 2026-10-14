'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lock,
  Shield,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Eye,
  EyeOff,
  Info,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function DuressPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [hasPin, setHasPin] = useState(false);

  useEffect(() => {
    setHasPin(!!profile?.duress_pin);
  }, [profile]);

  const handleSetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (pin.length < 4) {
      setError('PIN must be at least 4 digits');
      return;
    }
    if (pin !== confirmPin) {
      setError('PINs do not match');
      return;
    }
    if (!user) return;

    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ duress_pin: pin })
      .eq('id', user.id);

    if (error) {
      setError(error.message);
    } else {
      setSuccess(true);
      setHasPin(true);
      await refreshProfile();
      setTimeout(() => setSuccess(false), 3000);
      setPin('');
      setConfirmPin('');
    }
    setSaving(false);
  };

  const handleRemovePin = async () => {
    if (!user) return;
    setError('');
    const { error } = await supabase.from('profiles').update({ duress_pin: null }).eq('id', user.id);
    if (error) {
      setError(error.message);
    } else {
      setHasPin(false);
      await refreshProfile();
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground md:text-3xl">Duress Mode</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A secret PIN that silently triggers SOS without any visible alarm.
        </p>
      </div>

      {/* How it works */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Card className="glass-strong rounded-2xl border-purple-500/20">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10">
                <ShieldAlert className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <CardTitle className="text-lg">How Duress Mode Works</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Protects you in threatening situations
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[
                {
                  icon: KeyRound,
                  step: '1',
                  title: 'Set Secret PIN',
                  description:
                    'Create a PIN different from your lock screen. This is your duress code.',
                },
                {
                  icon: Lock,
                  step: '2',
                  title: 'Enter PIN When Threatened',
                  description:
                    'If someone forces you to unlock DEYGO, enter your duress PIN instead.',
                },
                {
                  icon: ShieldAlert,
                  step: '3',
                  title: 'Silent SOS Triggered',
                  description:
                    'The app unlocks normally, but silently sends SOS with your GPS location to trusted contacts.',
                },
              ].map((item, i) => (
                <div key={i} className="rounded-xl bg-white/5 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-500/10">
                      <item.icon className="h-4.5 w-4.5 text-purple-400" />
                    </div>
                    <span className="text-xs font-medium text-purple-400">
                      Step {item.step}
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-foreground">
                    {item.title}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {item.description}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
              <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-400" />
              <div className="text-sm text-muted-foreground">
                <span className="font-medium text-amber-400">Important:</span> When
                duress mode is triggered, <strong className="text-foreground">no warning
                or notification</strong> appears on screen. The app behaves normally
                while silently alerting your trusted contacts with your live location
                and timestamp. The incident is logged as a duress SOS.
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Status */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <Card className="glass-card rounded-2xl border-white/5">
          <CardContent className="flex items-center justify-between p-6">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                  hasPin ? 'bg-green-500/10' : 'bg-white/5'
                }`}
              >
                {hasPin ? (
                  <ShieldCheck className="h-6 w-6 text-green-400" />
                ) : (
                  <Shield className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">
                  Duress Mode {hasPin ? 'Active' : 'Not Configured'}
                </div>
                <div className="text-xs text-muted-foreground">
                  {hasPin
                    ? 'Your secret PIN is set. Use it to silently trigger SOS.'
                    : 'Set up your duress PIN to enable silent emergency alerts.'}
                </div>
              </div>
            </div>
            {hasPin && (
              <Button
                variant="outline"
                size="sm"
                className="glass text-red-400 hover:bg-red-500/10"
                onClick={handleRemovePin}
              >
                Remove PIN
              </Button>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Set PIN form */}
      {!hasPin && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
        >
          <Card className="glass-card rounded-2xl border-white/5">
            <CardHeader>
              <CardTitle className="text-lg">Set Your Duress PIN</CardTitle>
            </CardHeader>
            <CardContent>
              {error && (
                <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
                  {error}
                </div>
              )}
              {success && (
                <div className="mb-4 flex items-center gap-2 rounded-lg border border-green-500/20 bg-green-500/10 p-3 text-sm text-green-400">
                  <CheckCircle2 className="h-4 w-4" />
                  Duress PIN set successfully!
                </div>
              )}
              <form onSubmit={handleSetPin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="pin">Secret PIN</Label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="pin"
                      type={showPin ? 'text' : 'password'}
                      placeholder="Enter 4-6 digit PIN"
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                      className="pl-10 pr-10"
                      maxLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPin(!showPin)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    >
                      {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPin">Confirm PIN</Label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="confirmPin"
                      type={showPin ? 'text' : 'password'}
                      placeholder="Re-enter PIN"
                      value={confirmPin}
                      onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                      className="pl-10"
                      maxLength={6}
                    />
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-xl bg-white/5 p-3">
                  <Info className="h-4 w-4 flex-shrink-0 text-blue-400" />
                  <p className="text-xs text-muted-foreground">
                    Choose a PIN that is different from your phone unlock code and
                    easy to remember. This PIN will silently trigger an SOS when
                    entered.
                  </p>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-primary text-white hover:bg-red-600"
                  disabled={saving}
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Set Duress PIN'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Update PIN form */}
      {hasPin && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
        >
          <Card className="glass-card rounded-2xl border-white/5">
            <CardHeader>
              <CardTitle className="text-lg">Update Duress PIN</CardTitle>
            </CardHeader>
            <CardContent>
              {error && (
                <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
                  {error}
                </div>
              )}
              {success && (
                <div className="mb-4 flex items-center gap-2 rounded-lg border border-green-500/20 bg-green-500/10 p-3 text-sm text-green-400">
                  <CheckCircle2 className="h-4 w-4" />
                  Duress PIN updated!
                </div>
              )}
              <form onSubmit={handleSetPin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newPin">New Secret PIN</Label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="newPin"
                      type={showPin ? 'text' : 'password'}
                      placeholder="Enter new 4-6 digit PIN"
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                      className="pl-10 pr-10"
                      maxLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPin(!showPin)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    >
                      {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newConfirmPin">Confirm New PIN</Label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="newConfirmPin"
                      type={showPin ? 'text' : 'password'}
                      placeholder="Re-enter new PIN"
                      value={confirmPin}
                      onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                      className="pl-10"
                      maxLength={6}
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  className="w-full bg-primary text-white hover:bg-red-600"
                  disabled={saving}
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Update PIN'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
