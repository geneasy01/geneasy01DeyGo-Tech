'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Building2,
  Shield,
  HeartHandshake,
  Users,
  School,
  Hospital,
  Siren,
  Flame,
  Building,
  Landmark,
  Home,
  Sparkles,
  Lock,
  Eye,
  ArrowRight,
  Loader2,
  CheckCircle2,
  Phone,
  Mail,
  MapPin,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { registerPartner, PARTNER_TYPE_LABELS, type PartnerType } from '@/lib/partners';

const partnerTypeIcons: Record<PartnerType, typeof Building2> = {
  church: Landmark,
  mosque: Landmark,
  estate: Home,
  company: Building2,
  school: School,
  university: School,
  hospital: Hospital,
  private_security: Shield,
  ambulance_provider: Siren,
  fire_service: Flame,
  ngo: HeartHandshake,
  community_association: Users,
  other: Building,
};

const privacyPrinciples = [
  {
    icon: Lock,
    title: 'Privacy First',
    description:
      'You never receive live user tracking. You never see member locations. You only learn about a user the moment they explicitly request emergency assistance from your organization.',
  },
  {
    icon: Eye,
    title: 'No Surveillance',
    description:
      'DEYGO is an Emergency Connection Platform, not a monitoring platform. There is no tracking, no movement history, no live feed. This is architectural, not a policy setting.',
  },
  {
    icon: HeartHandshake,
    title: 'Trusted Response',
    description:
      'When a member needs help, Guardian coordinates. Your organization receives the emergency request with the user\u2019s consent. You respond. That is the entire relationship.',
  },
];

export default function PartnerPortalLandingPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<'landing' | 'register'>('landing');

  // Registration form state
  const [name, setName] = useState('');
  const [type, setType] = useState<PartnerType>('church');
  const [description, setDescription] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [emergencyEmail, setEmergencyEmail] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('Nigeria');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      router.push('/login?redirect=/partners');
      return;
    }
    setSubmitting(true);
    setError('');

    const result = await registerPartner(
      {
        name,
        type,
        description: description || undefined,
        emergencyPhone: emergencyPhone || undefined,
        emergencyEmail: emergencyEmail || undefined,
        address: address || undefined,
        city: city || undefined,
        country: country || undefined,
      },
      user.id
    );

    if (!result) {
      setError('Unable to register your organization. Please try again.');
      setSubmitting(false);
      return;
    }

    router.push('/partners/dashboard');
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background bg-grid">
      <div className="pointer-events-none absolute inset-0 bg-radial-glow" />

      <div className="relative z-10">
        {/* Header */}
        <header className="sticky top-0 z-40 border-b border-white/5 bg-navy/80 backdrop-blur-lg">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <Logo />
            <div className="flex items-center gap-3">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
                  User App
                </Button>
              </Link>
              {user ? (
                <Button
                  size="sm"
                  className="bg-primary text-white hover:bg-red-600"
                  onClick={() => setMode('register')}
                >
                  Register Organization
                </Button>
              ) : (
                <Link href="/login?redirect=/partners">
                  <Button size="sm" className="bg-primary text-white hover:bg-red-600">
                    Sign In to Register
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </header>

        {mode === 'landing' ? (
          <LandingContent onRegister={() => setMode('register')} canRegister={!!user} />
        ) : (
          <RegisterForm
            name={name}
            setName={setName}
            type={type}
            setType={setType}
            description={description}
            setDescription={setDescription}
            emergencyPhone={emergencyPhone}
            setEmergencyPhone={setEmergencyPhone}
            emergencyEmail={emergencyEmail}
            setEmergencyEmail={setEmergencyEmail}
            address={address}
            setAddress={setAddress}
            city={city}
            setCity={setCity}
            country={country}
            setCountry={setCountry}
            submitting={submitting}
            error={error}
            onSubmit={handleRegister}
            onBack={() => setMode('landing')}
          />
        )}
      </div>
    </div>
  );
}

function LandingContent({
  onRegister,
  canRegister,
}: {
  onRegister: () => void;
  canRegister: boolean;
}) {
  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mx-auto max-w-3xl text-center"
      >
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary">
          <Sparkles className="h-3.5 w-3.5" />
          Emergency Connection Platform
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Become a DEYGO Partner
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Connect your organization to your community for emergency assistance.
          Churches, mosques, estates, companies, schools, hospitals, security firms,
          ambulance providers, fire services, and NGOs \u2014 all welcome.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button
            size="lg"
            className="bg-primary text-white hover:bg-red-600"
            onClick={onRegister}
            disabled={!canRegister}
          >
            {canRegister ? 'Register Your Organization' : 'Sign In to Register'}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          {!canRegister && (
            <Link href="/login?redirect=/partners">
              <Button variant="outline" size="lg" className="glass">
                Sign In
              </Button>
            </Link>
          )}
        </div>
      </motion.div>

      {/* Partner types */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="mt-16"
      >
        <h2 className="mb-6 text-center text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Who can become a partner
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {(Object.keys(PARTNER_TYPE_LABELS) as PartnerType[])
            .filter((t) => t !== 'other')
            .map((t, i) => {
              const Icon = partnerTypeIcons[t];
              return (
                <motion.div
                  key={t}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <Card className="glass-card rounded-2xl border-white/5 text-center transition-all hover:border-primary/20">
                    <CardContent className="flex flex-col items-center p-5">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <span className="mt-3 text-sm font-medium text-foreground">
                        {PARTNER_TYPE_LABELS[t]}
                      </span>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
        </div>
      </motion.div>

      {/* Privacy principles */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="mt-20"
      >
        <h2 className="mb-2 text-center text-2xl font-bold text-foreground">
          Privacy is the foundation
        </h2>
        <p className="mb-8 text-center text-sm text-muted-foreground">
          DEYGO is not a surveillance platform. These principles are permanent.
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          {privacyPrinciples.map((p, i) => (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Card className="glass-card h-full rounded-2xl border-white/5">
                <CardContent className="p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                    <p.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-foreground">{p.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {p.description}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* What partners can do */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="mt-20"
      >
        <h2 className="mb-8 text-center text-2xl font-bold text-foreground">
          What partners can do
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {[
            { icon: Building2, title: 'Register your organization', desc: 'Upload your logo, set your emergency phone and email, and list your address.' },
            { icon: HeartHandshake, title: 'Build an Emergency Resource Directory', desc: 'Configure preferred hospitals, ambulance providers, security providers, and fire responders across seven categories.' },
            { icon: Users, title: 'Onboard your community', desc: 'Generate QR codes and invitation links. Download awareness posters. Track onboarding statistics.' },
            { icon: Siren, title: 'Receive emergency requests', desc: 'When a member explicitly requests help, you receive the request with their consent. You respond.' },
          ].map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, x: i % 2 === 0 ? -20 : 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="glass-card rounded-2xl border-white/5">
                <CardContent className="flex items-start gap-4 p-5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <f.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{f.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* What partners cannot do */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="mt-12"
      >
        <Card className="glass-strong rounded-2xl border-red-500/20">
          <CardContent className="p-6">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-red-400">
              <Lock className="h-4 w-4" />
              What partners can never do
            </h3>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                Receive live user tracking or movement history
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                Monitor journeys or member locations
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                Access user contacts, wallets, or any data without explicit user action
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                Dispatch responders on a user\u2019s behalf without consent
              </li>
            </ul>
          </CardContent>
        </Card>
      </motion.div>

      {/* CTA */}
      <div className="mt-20 text-center">
        <Button
          size="lg"
          className="bg-primary text-white hover:bg-red-600"
          onClick={onRegister}
          disabled={!canRegister}
        >
          {canRegister ? 'Get Started' : 'Sign In to Get Started'}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

interface RegisterFormProps {
  name: string;
  setName: (v: string) => void;
  type: PartnerType;
  setType: (v: PartnerType) => void;
  description: string;
  setDescription: (v: string) => void;
  emergencyPhone: string;
  setEmergencyPhone: (v: string) => void;
  emergencyEmail: string;
  setEmergencyEmail: (v: string) => void;
  address: string;
  setAddress: (v: string) => void;
  city: string;
  setCity: (v: string) => void;
  country: string;
  setCountry: (v: string) => void;
  submitting: boolean;
  error: string;
  onSubmit: (e: React.FormEvent) => void;
  onBack: () => void;
}

function RegisterForm(props: RegisterFormProps) {
  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <button
          onClick={props.onBack}
          className="mb-6 text-sm text-muted-foreground hover:text-foreground"
        >
          \u2190 Back to overview
        </button>
        <Card className="glass-strong rounded-2xl border-primary/20">
          <CardHeader>
            <CardTitle className="text-2xl">Register Your Organization</CardTitle>
            <CardDescription>
              You will become the administrator of this partner organization.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {props.error && (
              <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
                {props.error}
              </div>
            )}
            <form onSubmit={props.onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Organization Name</Label>
                <Input
                  id="name"
                  placeholder="e.g. Grace Community Church"
                  value={props.name}
                  onChange={(e) => props.setName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Organization Type</Label>
                <Select value={props.type} onValueChange={(v) => props.setType(v as PartnerType)}>
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PARTNER_TYPE_LABELS) as PartnerType[]).map((t) => (
                      <SelectItem key={t} value={t}>
                        {PARTNER_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  placeholder="Brief description of your organization and the community you serve."
                  value={props.description}
                  onChange={(e) => props.setDescription(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="phone">Emergency Phone</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="phone"
                      placeholder="+234 ..."
                      value={props.emergencyPhone}
                      onChange={(e) => props.setEmergencyPhone(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Emergency Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="emergency@org.org"
                      value={props.emergencyEmail}
                      onChange={(e) => props.setEmergencyEmail(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="address"
                    placeholder="Street address"
                    value={props.address}
                    onChange={(e) => props.setAddress(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    placeholder="Lagos"
                    value={props.city}
                    onChange={(e) => props.setCity(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    value={props.country}
                    onChange={(e) => props.setCountry(e.target.value)}
                  />
                </div>
              </div>

              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
                <CheckCircle2 className="mr-1.5 inline h-3.5 w-3.5 text-primary" />
                Your organization will be created. A DEYGO platform admin will verify it before it appears in public discovery. You can start configuring your Emergency Resource Directory immediately.
              </div>

              <Button
                type="submit"
                className="w-full bg-primary text-white hover:bg-red-600"
                disabled={props.submitting || !props.name.trim()}
              >
                {props.submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Create Partner Organization
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
