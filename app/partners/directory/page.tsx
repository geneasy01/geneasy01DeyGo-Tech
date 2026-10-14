'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookUser,
  Plus,
  Phone,
  Mail,
  MapPin,
  Trash2,
  Edit2,
  X,
  Loader2,
  Shield,
  HeartPulse,
  Ambulance,
  Flame,
  Siren,
  Zap,
  LifeBuoy,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
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
import { Switch } from '@/components/ui/switch';
import {
  CATEGORY_LABELS,
  CATEGORY_DESCRIPTIONS,
  ALL_CATEGORIES,
  createDirectoryEntry,
  getDirectoryEntries,
  updateDirectoryEntry,
  deleteDirectoryEntry,
  type DirectoryEntry,
  type ResourceCategory,
} from '@/lib/partner-directory';
import { cn } from '@/lib/utils';

const categoryIcons: Record<ResourceCategory, typeof Shield> = {
  security: Shield,
  medical: HeartPulse,
  ambulance: Ambulance,
  fire: Flame,
  police: Siren,
  utilities: Zap,
  emergency_help_desk: LifeBuoy,
};

export default function PartnerDirectoryPage() {
  const { user } = useAuth();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [entries, setEntries] = useState<DirectoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<DirectoryEntry | null>(null);
  const [filterCat, setFilterCat] = useState<ResourceCategory | 'all'>('all');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrgId(localStorage.getItem('partnerActiveOrgId'));
    }
  }, []);

  const fetchEntries = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    const data = await getDirectoryEntries(orgId);
    setEntries(data);
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const filtered = filterCat === 'all' ? entries : entries.filter((e) => e.category === filterCat);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Emergency Resource Directory</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure the responders Guardian recommends to your members during emergencies.
          </p>
        </div>
        <Button
          className="bg-primary text-white hover:bg-red-600"
          onClick={() => {
            setEditingEntry(null);
            setShowForm(true);
          }}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          Add Provider
        </Button>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilterCat('all')}
          className={cn(
            'rounded-xl px-3 py-1.5 text-xs font-medium transition-all',
            filterCat === 'all' ? 'bg-primary/10 text-primary' : 'bg-white/5 text-muted-foreground hover:bg-white/10'
          )}
        >
          All ({entries.length})
        </button>
        {ALL_CATEGORIES.map((cat) => {
          const count = entries.filter((e) => e.category === cat).length;
          const Icon = categoryIcons[cat];
          return (
            <button
              key={cat}
              onClick={() => setFilterCat(cat)}
              className={cn(
                'flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-all',
                filterCat === cat ? 'bg-primary/10 text-primary' : 'bg-white/5 text-muted-foreground hover:bg-white/10'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {CATEGORY_LABELS[cat]} ({count})
            </button>
          );
        })}
      </div>

      {/* Entries */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="glass-card rounded-2xl border-white/5">
          <CardContent className="flex flex-col items-center py-16 text-center">
            <BookUser className="h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-sm text-muted-foreground">
              No providers in this category yet. Add hospitals, ambulance services, security firms, and more so Guardian can recommend them.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((entry, i) => {
            const Icon = categoryIcons[entry.category];
            return (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <Card className={cn('glass-card rounded-2xl border-white/5 transition-all hover:border-white/10', !entry.active && 'opacity-60')}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold text-foreground">{entry.name}</span>
                          {entry.available_247 && (
                            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">24/7</span>
                          )}
                          {!entry.active && (
                            <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">Inactive</span>
                          )}
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">{CATEGORY_LABELS[entry.category]}</div>
                        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                          {entry.phone && (
                            <div className="flex items-center gap-1.5">
                              <Phone className="h-3 w-3" /> {entry.phone}
                            </div>
                          )}
                          {entry.email && (
                            <div className="flex items-center gap-1.5">
                              <Mail className="h-3 w-3" /> {entry.email}
                            </div>
                          )}
                          {entry.address && (
                            <div className="flex items-center gap-1.5">
                              <MapPin className="h-3 w-3" /> {entry.address}
                            </div>
                          )}
                          {entry.notes && <p className="mt-1 italic text-muted-foreground/70">{entry.notes}</p>}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col gap-1">
                        <button
                          onClick={() => { setEditingEntry(entry); setShowForm(true); }}
                          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={async () => {
                            if (confirm(`Remove ${entry.name} from your directory?`)) {
                              await deleteDirectoryEntry(entry.id);
                              fetchEntries();
                            }
                          }}
                          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Form modal */}
      <AnimatePresence>
        {showForm && orgId && (
          <DirectoryForm
            orgId={orgId}
            entry={editingEntry}
            onClose={() => setShowForm(false)}
            onSaved={() => { setShowForm(false); fetchEntries(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function DirectoryForm({
  orgId,
  entry,
  onClose,
  onSaved,
}: {
  orgId: string;
  entry: DirectoryEntry | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [category, setCategory] = useState<ResourceCategory>(entry?.category ?? 'security');
  const [name, setName] = useState(entry?.name ?? '');
  const [phone, setPhone] = useState(entry?.phone ?? '');
  const [email, setEmail] = useState(entry?.email ?? '');
  const [address, setAddress] = useState(entry?.address ?? '');
  const [notes, setNotes] = useState(entry?.notes ?? '');
  const [available247, setAvailable247] = useState(entry?.available_247 ?? false);
  const [active, setActive] = useState(entry?.active ?? true);
  const [priority, setPriority] = useState(entry?.priority?.toString() ?? '100');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    const payload = {
      category,
      name: name.trim(),
      phone: phone || undefined,
      email: email || undefined,
      address: address || undefined,
      notes: notes || undefined,
      priority: parseInt(priority, 10) || 100,
      available_247: available247,
      active,
    };

    let ok = false;
    if (entry) {
      ok = await updateDirectoryEntry(entry.id, payload);
    } else {
      const created = await createDirectoryEntry({ organization_id: orgId, ...payload });
      ok = !!created;
    }

    if (!ok) {
      setError('Unable to save. Please try again.');
      setSaving(false);
      return;
    }
    onSaved();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl border border-white/10 bg-navy-light p-6 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            {entry ? 'Edit Provider' : 'Add Provider'}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-white/5">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as ResourceCategory)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ALL_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{CATEGORY_DESCRIPTIONS[category]}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Provider Name</Label>
            <Input id="name" placeholder="e.g. St. Mary\u2019s Hospital" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" placeholder="+234 ..." value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea id="notes" rows={2} placeholder="Any details Guardian should consider" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="priority">Priority (lower = recommended first)</Label>
              <Input id="priority" type="number" min={1} value={priority} onChange={(e) => setPriority(e.target.value)} />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-white/5 p-3">
            <div>
              <div className="text-sm font-medium text-foreground">Available 24/7</div>
              <div className="text-xs text-muted-foreground">Boosts Guardian recommendation ranking</div>
            </div>
            <Switch checked={available247} onCheckedChange={setAvailable247} />
          </div>

          <div className="flex items-center justify-between rounded-xl bg-white/5 p-3">
            <div>
              <div className="text-sm font-medium text-foreground">Active</div>
              <div className="text-xs text-muted-foreground">Inactive providers are not recommended</div>
            </div>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1 bg-primary text-white hover:bg-red-600" disabled={saving || !name.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : entry ? 'Save Changes' : 'Add Provider'}
            </Button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
