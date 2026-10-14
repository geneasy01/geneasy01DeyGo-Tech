'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  QrCode,
  Link2,
  Copy,
  Check,
  Trash2,
  Plus,
  Download,
  Users,
  Clock,
  X,
  Loader2,
  Image as ImageIcon,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  createInvitation,
  getInvitations,
  deleteInvitation,
  type PartnerInvitation,
} from '@/lib/partners';

export default function PartnerInvitationsPage() {
  const { user } = useAuth();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [invitations, setInvitations] = useState<PartnerInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrgId(localStorage.getItem('partnerActiveOrgId'));
    }
  }, []);

  const fetchInvitations = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    const data = await getInvitations(orgId);
    setInvitations(data);
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    fetchInvitations();
  }, [fetchInvitations]);

  const copyLink = (code: string) => {
    const url = `${window.location.origin}/partners/join?code=${code}`;
    navigator.clipboard?.writeText(url);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const downloadQR = (code: string, label: string) => {
    const url = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(
      `${window.location.origin}/partners/join?code=${code}`
    )}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = `deygo-qr-${label || code}.png`;
    a.target = '_blank';
    a.click();
  };

  const downloadPoster = (code: string, label: string) => {
    // Generate a simple awareness poster as an SVG data URI.
    const joinUrl = `${window.location.origin}/partners/join?code=${code}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(joinUrl)}`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1100" viewBox="0 0 800 1100">
      <rect width="800" height="1100" fill="#0a0e1a"/>
      <rect x="40" y="40" width="720" height="1020" rx="24" fill="none" stroke="#dc2626" stroke-width="3"/>
      <text x="400" y="140" font-family="Arial, sans-serif" font-size="48" font-weight="bold" fill="#ffffff" text-anchor="middle">DEYGO</text>
      <text x="400" y="190" font-family="Arial, sans-serif" font-size="20" fill="#94a3b8" text-anchor="middle">Emergency Connection Platform</text>
      <text x="400" y="280" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="#ffffff" text-anchor="middle">Join Our Emergency Network</text>
      <text x="400" y="330" font-family="Arial, sans-serif" font-size="18" fill="#cbd5e1" text-anchor="middle">Scan to connect with ${label || 'our organization'}</text>
      <image x="250" y="380" width="300" height="300" href="${qrUrl}"/>
      <text x="400" y="740" font-family="Arial, sans-serif" font-size="16" fill="#64748b" text-anchor="middle">Privacy First \u00b7 No Tracking \u00b7 Emergency Assistance Only</text>
      <text x="400" y="800" font-family="Arial, sans-serif" font-size="14" fill="#475569" text-anchor="middle">Your location is shared ONLY when you</text>
      <text x="400" y="825" font-family="Arial, sans-serif" font-size="14" fill="#475569" text-anchor="middle">explicitly request emergency help.</text>
      <text x="400" y="920" font-family="Arial, sans-serif" font-size="22" font-weight="bold" fill="#dc2626" text-anchor="middle">One tap can save your life.</text>
      <text x="400" y="1010" font-family="Arial, sans-serif" font-size="12" fill="#334155" text-anchor="middle">${joinUrl}</text>
    </svg>`;
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `deygo-poster-${label || code}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Invitations &amp; QR Codes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Generate invitation links and QR codes to onboard your community. Download awareness posters.
          </p>
        </div>
        <Button className="bg-primary text-white hover:bg-red-600" onClick={() => setShowForm(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Create Invitation
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : invitations.length === 0 ? (
        <Card className="glass-card rounded-2xl border-white/5">
          <CardContent className="flex flex-col items-center py-16 text-center">
            <QrCode className="h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-sm text-muted-foreground">
              No invitations yet. Create one to generate a QR code and shareable link.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {invitations.map((inv, i) => {
            const joinUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/partners/join?code=${inv.code}`;
            const expired = inv.expires_at && new Date(inv.expires_at) < new Date();
            const exhausted = inv.max_uses !== null && inv.uses_count >= inv.max_uses;
            return (
              <motion.div
                key={inv.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className="glass-card rounded-2xl border-white/5">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-sm font-semibold text-foreground">
                          {inv.label || 'Untitled invitation'}
                        </div>
                        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" /> {inv.uses_count}
                            {inv.max_uses !== null && `/${inv.max_uses}`} joins
                          </span>
                          {inv.expires_at && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {expired ? 'Expired' : `Expires ${new Date(inv.expires_at).toLocaleDateString()}`}
                            </span>
                          )}
                        </div>
                      </div>
                      {expired || exhausted ? (
                        <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-400">
                          {expired ? 'Expired' : 'Exhausted'}
                        </span>
                      ) : (
                        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                          Active
                        </span>
                      )}
                    </div>

                    {/* QR preview */}
                    <div className="my-4 flex justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(joinUrl)}`}
                        alt="QR code"
                        className="rounded-xl bg-white p-2"
                        width={160}
                        height={160}
                      />
                    </div>

                    {/* Link */}
                    <div className="mb-3 flex items-center gap-2 rounded-lg bg-white/5 p-2">
                      <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate text-xs text-muted-foreground">{joinUrl}</span>
                      <button
                        onClick={() => copyLink(inv.code)}
                        className="ml-auto shrink-0 rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {copiedCode === inv.code ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" className="glass text-xs" onClick={() => copyLink(inv.code)}>
                        {copiedCode === inv.code ? <Check className="mr-1 h-3 w-3 text-emerald-400" /> : <Copy className="mr-1 h-3 w-3" />}
                        Copy Link
                      </Button>
                      <Button size="sm" variant="outline" className="glass text-xs" onClick={() => downloadQR(inv.code, inv.label || '')}>
                        <QrCode className="mr-1 h-3 w-3" /> QR PNG
                      </Button>
                      <Button size="sm" variant="outline" className="glass text-xs" onClick={() => downloadPoster(inv.code, inv.label || '')}>
                        <ImageIcon className="mr-1 h-3 w-3" /> Poster
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="glass text-xs text-red-400 hover:bg-red-500/10"
                        onClick={async () => {
                          if (confirm('Delete this invitation? Existing links will stop working.')) {
                            await deleteInvitation(inv.id);
                            fetchInvitations();
                          }
                        }}
                      >
                        <Trash2 className="mr-1 h-3 w-3" /> Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {showForm && orgId && user && (
        <CreateInvitationForm
          orgId={orgId}
          userId={user.id}
          onClose={() => setShowForm(false)}
          onCreated={() => { setShowForm(false); fetchInvitations(); }}
        />
      )}
    </div>
  );
}

function CreateInvitationForm({
  orgId,
  userId,
  onClose,
  onCreated,
}: {
  orgId: string;
  userId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [label, setLabel] = useState('');
  const [expiresInDays, setExpiresInDays] = useState('');
  const [maxUses, setMaxUses] = useState('');
  const [saving, setSaving] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await createInvitation(
      {
        organizationId: orgId,
        label: label || undefined,
        expiresInDays: expiresInDays ? parseInt(expiresInDays, 10) : undefined,
        maxUses: maxUses ? parseInt(maxUses, 10) : undefined,
      },
      userId
    );
    onCreated();
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
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-white/10 bg-navy-light p-6 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Create Invitation</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-white/5">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="label">Label (optional)</Label>
            <Input id="label" placeholder="e.g. Sunday Service, Staff Onboarding" value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="expires">Expires in (days)</Label>
              <Input id="expires" type="number" min={1} placeholder="Never" value={expiresInDays} onChange={(e) => setExpiresInDays(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxuses">Max uses</Label>
              <Input id="maxuses" type="number" min={1} placeholder="Unlimited" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} />
            </div>
          </div>
          <Button type="submit" className="w-full bg-primary text-white hover:bg-red-600" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Generate Invitation'}
          </Button>
        </form>
      </motion.div>
    </motion.div>
  );
}
