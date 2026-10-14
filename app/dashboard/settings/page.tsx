'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Siren,
  Navigation,
  Users,
  Mail,
  Bell,
  Megaphone,
  Loader2,
  CheckCircle2,
  Save,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import type { NotificationSettings } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';

interface SettingItem {
  key: keyof NotificationSettings;
  label: string;
  description: string;
  icon: typeof Siren;
  color: string;
  bg: string;
}

const settingItems: SettingItem[] = [
  {
    key: 'sos_alerts',
    label: 'SOS Alerts',
    description: 'Get notified when SOS emergencies are triggered or resolved.',
    icon: Siren,
    color: 'text-red-400',
    bg: 'bg-red-500/10',
  },
  {
    key: 'journey_alerts',
    label: 'Journey Alerts',
    description: 'Receive updates about active journeys, arrivals, and overdue trips.',
    icon: Navigation,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
  },
  {
    key: 'emergency_contact_notifications',
    label: 'Emergency Contact Notifications',
    description: 'Allow your emergency contacts to be notified during incidents.',
    icon: Users,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
  },
  {
    key: 'email_notifications',
    label: 'Email Notifications',
    description: 'Receive notifications via your registered email address.',
    icon: Mail,
    color: 'text-green-400',
    bg: 'bg-green-500/10',
  },
  {
    key: 'push_notifications',
    label: 'Push Notifications',
    description: 'Receive real-time push notifications on your device (FCM).',
    icon: Bell,
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
  },
  {
    key: 'marketing_notifications',
    label: 'Marketing Notifications',
    description: 'Receive product updates, tips, and promotional messages.',
    icon: Megaphone,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
  },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [toggles, setToggles] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('notification_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data) {
        const s = data as NotificationSettings;
        setSettings(s);
        setToggles({
          sos_alerts: s.sos_alerts,
          journey_alerts: s.journey_alerts,
          emergency_contact_notifications: s.emergency_contact_notifications,
          email_notifications: s.email_notifications,
          push_notifications: s.push_notifications,
          marketing_notifications: s.marketing_notifications,
        });
      } else {
        // Defaults for new users
        setToggles({
          sos_alerts: true,
          journey_alerts: true,
          emergency_contact_notifications: true,
          email_notifications: true,
          push_notifications: true,
          marketing_notifications: false,
        });
      }
      setLoading(false);
    })();
  }, [user]);

  const handleToggle = (key: string, value: boolean) => {
    setToggles((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setSaved(false);
    setSaveError('');

    const updates = {
      sos_alerts: toggles.sos_alerts,
      journey_alerts: toggles.journey_alerts,
      emergency_contact_notifications: toggles.emergency_contact_notifications,
      email_notifications: toggles.email_notifications,
      push_notifications: toggles.push_notifications,
      marketing_notifications: toggles.marketing_notifications,
    };

    if (settings) {
      const { data, error } = await supabase
        .from('notification_settings')
        .update(updates)
        .eq('user_id', user.id)
        .select()
        .single();
      if (error) {
        setSaveError(error.message);
      } else {
        setSettings(data as NotificationSettings);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } else {
      const { data, error } = await supabase
        .from('notification_settings')
        .insert({ user_id: user.id, ...updates })
        .select()
        .single();
      if (error) {
        setSaveError(error.message);
      } else {
        setSettings(data as NotificationSettings);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    }

    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground md:text-3xl">Notification Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose which alerts and updates you want to receive.
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Card className="glass-strong rounded-2xl border-white/10">
          <CardHeader>
            <CardTitle className="text-lg">Notification Preferences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {settingItems.map((item, i) => (
              <div
                key={item.key}
                className={`flex items-center gap-4 rounded-xl p-4 transition-colors hover:bg-white/5 ${
                  i > 0 ? 'border-t border-white/5' : ''
                }`}
              >
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${item.bg}`}>
                  <item.icon className={`h-5 w-5 ${item.color}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-foreground">
                    {item.label}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {item.description}
                  </div>
                </div>
                <Switch
                  checked={toggles[item.key] ?? false}
                  onCheckedChange={(v) => handleToggle(item.key, v)}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      </motion.div>

      {saveError && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
          {saveError}
        </div>
      )}
      <div className="flex items-center gap-3">
        <Button
          onClick={handleSave}
          className="bg-primary text-white hover:bg-red-600"
          disabled={saving}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Preferences
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
            Preferences saved
          </motion.div>
        )}
      </div>
    </div>
  );
}
