'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  User,
  Mail,
  Phone,
  Save,
  Loader2,
  CheckCircle2,
  Shield,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setSaveError('');

    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName, phone })
      .eq('id', user.id);

    if (error) {
      setSaveError(error.message);
    } else {
      await refreshProfile();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
    setSaving(false);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground md:text-3xl">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your account information.
        </p>
      </div>

      {/* Profile header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Card className="glass-strong rounded-2xl border-white/10">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-red-700 text-2xl font-bold text-white">
              {profile?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase()}
            </div>
            <div>
              <div className="text-lg font-semibold text-foreground">
                {profile?.full_name || 'User'}
              </div>
              <div className="text-sm text-muted-foreground">{user?.email}</div>
              <div className="mt-1 flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                  <Shield className="h-3 w-3" />
                  {profile?.role === 'admin' ? 'Admin' : 'Member'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Edit form */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <Card className="glass-card rounded-2xl border-white/5">
          <CardHeader>
            <CardTitle className="text-lg">Edit Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="name"
                    placeholder="Your full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="pl-10 opacity-60"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+234 800 000 0000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {saveError && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
                  {saveError}
                </div>
              )}
              <div className="flex items-center gap-3">
                <Button
                  type="submit"
                  className="bg-primary text-white hover:bg-red-600"
                  disabled={saving}
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </Button>
                {saved && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 text-sm text-green-400"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Profile updated
                  </motion.div>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
