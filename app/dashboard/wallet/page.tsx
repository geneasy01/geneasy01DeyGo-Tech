'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Wallet,
  Heart,
  Activity,
  Pill,
  Shield,
  Droplet,
  Dna,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import type { Wallet as WalletType } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const genotypes = ['AA', 'AS', 'SS', 'AC', 'SC', 'CC'];

export default function WalletPage() {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<WalletType | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [bloodGroup, setBloodGroup] = useState('');
  const [genotype, setGenotype] = useState('');
  const [medicalConditions, setMedicalConditions] = useState('');
  const [allergies, setAllergies] = useState('');
  const [currentMedication, setCurrentMedication] = useState('');
  const [insurance, setInsurance] = useState('');
  const [emergencyNotes, setEmergencyNotes] = useState('');

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data) {
        const w = data as WalletType;
        setWallet(w);
        setBloodGroup(w.blood_group || '');
        setGenotype(w.genotype || '');
        setMedicalConditions(w.medical_conditions || '');
        setAllergies(w.allergies || '');
        setCurrentMedication(w.current_medication || '');
        setInsurance(w.insurance || '');
        setEmergencyNotes(w.emergency_notes || '');
      }
      setLoading(false);
    })();
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setSaved(false);

    const walletData = {
      blood_group: bloodGroup,
      genotype,
      medical_conditions: medicalConditions,
      allergies,
      current_medication: currentMedication,
      insurance,
      emergency_notes: emergencyNotes,
    };

    setSaveError('');

    if (wallet) {
      const { data, error } = await supabase
        .from('wallets')
        .update(walletData)
        .eq('id', wallet.id)
        .select()
        .single();
      if (error) {
        setSaveError(error.message);
      } else {
        setWallet(data as WalletType);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } else {
      const { data, error } = await supabase
        .from('wallets')
        .insert({ user_id: user.id, ...walletData })
        .select()
        .single();
      if (error) {
        setSaveError(error.message);
      } else {
        setWallet(data as WalletType);
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

  const fields = [
    {
      icon: Droplet,
      label: 'Blood Group',
      value: bloodGroup,
      color: 'text-red-400',
      bg: 'bg-red-500/10',
    },
    {
      icon: Dna,
      label: 'Genotype',
      value: genotype,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
    },
    {
      icon: AlertCircle,
      label: 'Allergies',
      value: allergies,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
    },
    {
      icon: Activity,
      label: 'Medical Conditions',
      value: medicalConditions,
      color: 'text-green-400',
      bg: 'bg-green-500/10',
    },
    {
      icon: Pill,
      label: 'Current Medication',
      value: currentMedication,
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10',
    },
    {
      icon: Shield,
      label: 'Insurance',
      value: insurance,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
    },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground md:text-3xl">Emergency Wallet</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Critical medical information accessible to first responders during emergencies.
        </p>
      </div>

      {/* Quick overview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Card className="glass-strong rounded-2xl border-white/10">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-500/10">
                <Heart className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <CardTitle className="text-lg">Medical Information</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {wallet ? 'Last updated: ' + new Date(wallet.updated_at).toLocaleDateString() : 'Not yet configured'}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {fields.map((field, i) => (
                <div key={i} className="rounded-xl bg-white/5 p-3">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${field.bg}`}>
                    <field.icon className={`h-4 w-4 ${field.color}`} />
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">{field.label}</div>
                  <div className="mt-0.5 truncate text-sm font-semibold text-foreground">
                    {field.value || '—'}
                  </div>
                </div>
              ))}
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
            <CardTitle className="text-lg">Update Emergency Wallet</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Blood Group</Label>
                  <Select value={bloodGroup} onValueChange={setBloodGroup}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select blood group" />
                    </SelectTrigger>
                    <SelectContent>
                      {bloodGroups.map((bg) => (
                        <SelectItem key={bg} value={bg}>
                          {bg}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Genotype</Label>
                  <Select value={genotype} onValueChange={setGenotype}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select genotype" />
                    </SelectTrigger>
                    <SelectContent>
                      {genotypes.map((g) => (
                        <SelectItem key={g} value={g}>
                          {g}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="conditions">Medical Conditions</Label>
                <Textarea
                  id="conditions"
                  placeholder="e.g. Asthma, Diabetes, Hypertension"
                  value={medicalConditions}
                  onChange={(e) => setMedicalConditions(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="allergies">Allergies</Label>
                <Textarea
                  id="allergies"
                  placeholder="e.g. Penicillin, Peanuts, Latex"
                  value={allergies}
                  onChange={(e) => setAllergies(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="medication">Current Medication</Label>
                <Textarea
                  id="medication"
                  placeholder="e.g. Inhaler, Metformin 500mg"
                  value={currentMedication}
                  onChange={(e) => setCurrentMedication(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="insurance">Insurance</Label>
                <Input
                  id="insurance"
                  placeholder="e.g. NHIS, AXA Health"
                  value={insurance}
                  onChange={(e) => setInsurance(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Emergency Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Any additional information for first responders..."
                  value={emergencyNotes}
                  onChange={(e) => setEmergencyNotes(e.target.value)}
                  rows={3}
                />
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
                    'Save Emergency Wallet'
                  )}
                </Button>
                {saved && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 text-sm text-green-400"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Saved successfully
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
