'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Shield,
  Siren,
  MapPin,
  Wallet,
  Users,
  Phone,
  ArrowRight,
  Play,
  CheckCircle2,
  Clock,
  Navigation,
  Heart,
  Bell,
  Lock,
  Zap,
  Activity,
  ChevronRight,
} from 'lucide-react';
import { Logo } from '@/components/logo';
import { SectionHeading } from '@/components/section-heading';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const features = [
  {
    icon: Siren,
    title: 'SOS Emergency Alert',
    description:
      'One tap sends an instant distress signal with your live GPS location to trusted contacts and verified response partners.',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
  },
  {
    icon: Navigation,
    title: 'Journey Guard',
    description:
      'Share your trip details, expected arrival time, and emergency contacts. Guardian checks in on your journey and alerts your contacts only if you don’t arrive on time. You are always in control.',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
  },
  {
    icon: Wallet,
    title: 'Emergency Wallet',
    description:
      'Store critical medical information — blood group, genotype, allergies, medications — accessible to responders when it matters most.',
    color: 'text-green-400',
    bg: 'bg-green-500/10',
  },
  {
    icon: Users,
    title: 'Trusted Contacts',
    description:
      'Build your emergency network with family, friends, doctors, lawyers, and neighbours who respond when seconds count.',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
  },
  {
    icon: Lock,
    title: 'Duress Mode',
    description:
      'A secret PIN that silently triggers SOS without any visible alarm — protecting you in threatening situations.',
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
  },
  {
    icon: Bell,
    title: 'Real-time Notifications',
    description:
      'Firebase Cloud Messaging keeps your contacts and response partners instantly informed with live updates.',
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
  },
];

const steps = [
  {
    number: '01',
    icon: Users,
    title: 'Set Up Your Network',
    description:
      'Create your account, add emergency contacts, and fill your emergency wallet with critical medical data.',
  },
  {
    number: '02',
    icon: MapPin,
    title: 'Share Your Location',
    description:
      'Activate Journey Guard before you travel, or trigger SOS with a single tap when danger strikes.',
  },
  {
    number: '03',
    icon: Activity,
    title: 'Get Connected',
    description:
      'Your trusted contacts and verified emergency response partners receive instant alerts with your live location.',
  },
];

const partners = [
  { name: 'NEMA', role: 'National Emergency Management' },
  { name: 'Red Cross', role: 'Nigerian Red Cross Society' },
  { name: 'FRSC', role: 'Federal Road Safety Corps' },
  { name: 'NPF', role: 'Nigeria Police Force' },
];

const plans = [
  {
    name: 'Free',
    price: '₦0',
    period: 'forever',
    description: 'Essential emergency tools for everyone.',
    features: ['SOS Alerts', 'Journey Guard', 'Emergency Contacts', 'Basic Support'],
    cta: 'Get Started',
    highlighted: false,
  },
  {
    name: 'Premium',
    price: '₦2,500',
    period: 'per month',
    description: 'Advanced protection for you and your family.',
    features: [
      'Everything in Free',
      'Family Emergency Connection',
      'Journey Guard Pro',
      'Priority Response',
      'Emergency Wallet',
      '24/7 Dedicated Support',
    ],
    cta: 'Go Premium',
    highlighted: true,
  },
];

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background bg-grid">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0 bg-radial-glow" />
      <div className="pointer-events-none absolute top-1/3 -left-40 h-96 w-96 rounded-full bg-red-500/10 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-1/4 -right-40 h-96 w-96 rounded-full bg-blue-500/10 blur-[120px]" />

      {/* Navigation */}
      <nav className="relative z-50 flex items-center justify-between px-6 py-5 lg:px-12">
        <Logo />
        <div className="hidden items-center gap-8 md:flex">
          <Link href="#features" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Features
          </Link>
          <Link href="#how-it-works" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            How It Works
          </Link>
          <Link href="#partners" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Partners
          </Link>
          <Link href="#pricing" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Pricing
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="hidden sm:block">
            <Button variant="ghost" size="sm">Sign In</Button>
          </Link>
          <Link href="/signup">
            <Button size="sm" className="bg-primary text-white hover:bg-red-600">
              Get Started
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 px-6 pt-16 pb-24 lg:px-12 lg:pt-24">
        <div className="mx-auto max-w-5xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            Now live across Nigeria
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="text-5xl font-bold tracking-tight text-foreground sm:text-6xl md:text-7xl lg:text-8xl"
          >
            HELP <span className="text-gradient-red">DEY GO.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl"
          >
            One tap can save your life. DEYGO connects you to trusted contacts and
            verified emergency response partners when seconds matter most.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
          >
            <Link href="/signup">
              <Button size="lg" className="h-14 px-8 text-base bg-primary text-white hover:bg-red-600 shadow-glow-red">
                Get Started
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="#how-it-works">
              <Button size="lg" variant="outline" className="h-14 px-8 text-base glass">
                <Play className="mr-2 h-5 w-5" />
                Watch Demo
              </Button>
            </Link>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="mt-20 grid grid-cols-2 gap-4 sm:grid-cols-4"
          >
            {[
              { value: '< 5s', label: 'SOS Response Time' },
              { value: '24/7', label: 'Always Active' },
              { value: '100+', label: 'Response Partners' },
              { value: '1M+', label: 'Potential Users' },
            ].map((stat, i) => (
              <div key={i} className="glass-card rounded-2xl p-4">
                <div className="text-2xl font-bold text-foreground sm:text-3xl">{stat.value}</div>
                <div className="mt-1 text-xs text-muted-foreground sm:text-sm">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="relative z-10 px-6 py-20 lg:px-12">
        <div className="mx-auto max-w-6xl">
          <SectionHeading
            badge="Features"
            title="Built for Emergencies"
            subtitle="Every feature is designed to work in the moments when you need help the most."
          />
          <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
              >
                <Card className="glass-card h-full rounded-2xl border-white/5 transition-all hover:border-primary/20 hover:shadow-glow-red">
                  <CardContent className="p-6">
                    <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${feature.bg}`}>
                      <feature.icon className={`h-6 w-6 ${feature.color}`} />
                    </div>
                    <h3 className="mb-2 text-lg font-semibold text-foreground">{feature.title}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="relative z-10 px-6 py-20 lg:px-12">
        <div className="mx-auto max-w-5xl">
          <SectionHeading
            badge="How It Works"
            title="Three Steps to Safety"
            subtitle="From setup to emergency response — DEYGO keeps you protected at every step."
          />
          <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">
            {steps.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.15 }}
                className="relative"
              >
                <Card className="glass-card h-full rounded-2xl border-white/5">
                  <CardContent className="p-6">
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                        <step.icon className="h-6 w-6 text-primary" />
                      </div>
                      <span className="text-4xl font-bold text-white/5">{step.number}</span>
                    </div>
                    <h3 className="mb-2 text-lg font-semibold text-foreground">{step.title}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{step.description}</p>
                  </CardContent>
                </Card>
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 z-20">
                    <ChevronRight className="h-6 w-6 text-primary/40" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Journey Guard Highlight */}
      <section className="relative z-10 px-6 py-20 lg:px-12">
        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <span className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-blue-400">
                <Navigation className="h-3 w-3" />
                Journey Guard
              </span>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Never travel alone again.
              </h2>
              <p className="mt-4 text-base text-muted-foreground sm:text-lg">
                Set your origin, destination, and expected arrival time. Guardian
                watches over your journey and alerts your emergency contacts only if
                you don&apos;t arrive on time. You choose when to start and end it.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  'Live journey status with Google Maps integration',
                  'Automatic alerts to trusted contacts on delay',
                  'One-tap SOS from within active journey',
                  'Arrival confirmation to end your journey',
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-foreground">
                    <CheckCircle2 className="h-5 w-5 text-green-400 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/signup" className="inline-block mt-8">
                <Button className="bg-primary text-white hover:bg-red-600">
                  Start Your First Journey
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="relative"
            >
              <div className="glass-strong rounded-3xl p-6">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/20">
                    <MapPin className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-foreground">Active Journey</div>
                    <div className="text-xs text-muted-foreground">Started 12 min ago</div>
                  </div>
                  <div className="ml-auto flex items-center gap-1.5">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
                    <span className="text-xs text-green-400">Active</span>
                  </div>
                </div>
                {/* Map placeholder */}
                <div className="relative h-56 overflow-hidden rounded-2xl border border-white/5 bg-navy-light">
                  <div className="absolute inset-0 bg-grid opacity-30" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <Navigation className="mx-auto h-10 w-10 text-blue-400/40" />
                      <p className="mt-2 text-xs text-muted-foreground">Google Maps Integration</p>
                    </div>
                  </div>
                  <div className="absolute left-6 top-6 flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-green-400 ring-4 ring-green-400/20" />
                    <span className="text-xs text-muted-foreground">Origin</span>
                  </div>
                  <div className="absolute bottom-6 right-6 flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-red-400 ring-4 ring-red-400/20" />
                    <span className="text-xs text-muted-foreground">Destination</span>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3">
                  <div className="rounded-xl bg-white/5 p-3 text-center">
                    <Clock className="mx-auto h-4 w-4 text-muted-foreground" />
                    <div className="mt-1 text-xs text-muted-foreground">ETA</div>
                    <div className="text-sm font-semibold text-foreground">8 min</div>
                  </div>
                  <div className="rounded-xl bg-white/5 p-3 text-center">
                    <MapPin className="mx-auto h-4 w-4 text-muted-foreground" />
                    <div className="mt-1 text-xs text-muted-foreground">Distance</div>
                    <div className="text-sm font-semibold text-foreground">3.2 km</div>
                  </div>
                  <div className="rounded-xl bg-white/5 p-3 text-center">
                    <Users className="mx-auto h-4 w-4 text-muted-foreground" />
                    <div className="mt-1 text-xs text-muted-foreground">Contacts</div>
                    <div className="text-sm font-semibold text-foreground">3</div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Emergency Wallet Highlight */}
      <section className="relative z-10 px-6 py-20 lg:px-12">
        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="order-2 lg:order-1"
            >
              <div className="glass-strong rounded-3xl p-6">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/20">
                    <Heart className="h-5 w-5 text-green-400" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-foreground">Emergency Wallet</div>
                    <div className="text-xs text-muted-foreground">Medical Information</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Blood Group', value: 'O+' },
                    { label: 'Genotype', value: 'AA' },
                    { label: 'Allergies', value: 'Penicillin' },
                    { label: 'Conditions', value: 'Asthma' },
                    { label: 'Medication', value: 'Inhaler' },
                    { label: 'Insurance', value: 'NHIS' },
                  ].map((item, i) => (
                    <div key={i} className="rounded-xl bg-white/5 p-3">
                      <div className="text-xs text-muted-foreground">{item.label}</div>
                      <div className="mt-0.5 text-sm font-semibold text-foreground">{item.value}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 rounded-xl bg-white/5 p-3">
                  <div className="text-xs text-muted-foreground">Emergency Notes</div>
                  <div className="mt-0.5 text-sm text-foreground">
                    Asthmatic. Inhaler in left pocket. Contact Dr. Ade on arrival.
                  </div>
                </div>
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="order-1 lg:order-2"
            >
              <span className="inline-flex items-center gap-2 rounded-full border border-green-500/20 bg-green-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-green-400">
                <Wallet className="h-3 w-3" />
                Emergency Wallet
              </span>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Your medical info, ready when responders need it.
              </h2>
              <p className="mt-4 text-base text-muted-foreground sm:text-lg">
                Store blood group, genotype, allergies, medical conditions, current
                medications, and insurance details. First responders can access this
                critical information during emergencies.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  'Blood group and genotype for transfusions',
                  'Allergies and medical conditions for treatment',
                  'Current medications to avoid interactions',
                  'Insurance and emergency notes for responders',
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-foreground">
                    <CheckCircle2 className="h-5 w-5 text-green-400 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>
        </div>
      </section>

      {/* SOS Highlight */}
      <section className="relative z-10 px-6 py-20 lg:px-12">
        <div className="mx-auto max-w-4xl text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="flex flex-col items-center"
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-primary">
              <Siren className="h-3 w-3" />
              SOS Emergency
            </span>
            <div className="relative mt-12">
              <div className="absolute inset-0 animate-pulse-red rounded-full" />
              <div className="relative flex h-48 w-48 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-red-700 shadow-glow-red-lg">
                <Siren className="h-20 w-20 text-white" />
              </div>
            </div>
            <h2 className="mt-12 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              One tap. Five seconds. Help is on the way.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
              Press the SOS button and DEYGO starts a 5-second countdown. If you
              don&apos;t cancel, we instantly save your GPS location, log the time,
              notify your trusted contacts, and create an incident record.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              {[
                { icon: MapPin, label: 'GPS Location' },
                { icon: Clock, label: 'Timestamp' },
                { icon: Bell, label: 'Contact Alerts' },
                { icon: Activity, label: 'Incident Log' },
              ].map((item, i) => (
                <div key={i} className="glass-card flex items-center gap-2 rounded-full px-4 py-2">
                  <item.icon className="h-4 w-4 text-primary" />
                  <span className="text-sm text-foreground">{item.label}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Emergency Partners */}
      <section id="partners" className="relative z-10 px-6 py-20 lg:px-12">
        <div className="mx-auto max-w-5xl">
          <SectionHeading
            badge="Emergency Partners"
            title="Verified Response Partners"
            subtitle="DEYGO connects you with Nigeria's most trusted emergency response organizations."
          />
          <div className="mt-14 grid grid-cols-2 gap-5 md:grid-cols-4">
            {partners.map((partner, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
              >
                <Card className="glass-card h-full rounded-2xl border-white/5 text-center transition-all hover:border-primary/20">
                  <CardContent className="flex flex-col items-center p-6">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                      <Shield className="h-7 w-7 text-primary" />
                    </div>
                    <div className="mt-4 text-lg font-bold text-foreground">{partner.name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{partner.role}</div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Placeholder */}
      <section className="relative z-10 px-6 py-20 lg:px-12">
        <div className="mx-auto max-w-5xl">
          <SectionHeading
            badge="Testimonials"
            title="Trusted by Communities"
            subtitle="Real stories from people DEYGO has helped. (Testimonials coming soon)"
          />
          <div className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="glass-card h-full rounded-2xl border-white/5">
                <CardContent className="p-6">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <span key={s} className="text-amber-400">&#9733;</span>
                    ))}
                  </div>
                  <p className="mt-4 text-sm italic text-muted-foreground">
                    &ldquo;Your testimonial here. Share how DEYGO helped you during an
                    emergency.&rdquo;
                  </p>
                  <div className="mt-4 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-red-700" />
                    <div>
                      <div className="text-sm font-medium text-foreground">Coming Soon</div>
                      <div className="text-xs text-muted-foreground">Verified User</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="relative z-10 px-6 py-20 lg:px-12">
        <div className="mx-auto max-w-4xl">
          <SectionHeading
            badge="Pricing"
            title="Choose Your Protection Plan"
            subtitle="Start free and upgrade when you need advanced features for your family."
          />
          <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-2">
            {plans.map((plan, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
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
                  <CardContent className="p-8">
                    <h3 className="text-lg font-semibold text-foreground">{plan.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
                    <div className="mt-6 flex items-baseline gap-1">
                      <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                      <span className="text-sm text-muted-foreground">/ {plan.period}</span>
                    </div>
                    <ul className="mt-6 space-y-3">
                      {plan.features.map((feature, fi) => (
                        <li key={fi} className="flex items-center gap-3 text-sm text-foreground">
                          <CheckCircle2 className={`h-5 w-5 flex-shrink-0 ${plan.highlighted ? 'text-primary' : 'text-green-400'}`} />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <Link href="/signup" className="block mt-8">
                      <Button
                        className={`w-full ${plan.highlighted ? 'bg-primary text-white hover:bg-red-600' : 'glass'}`}
                        variant={plan.highlighted ? 'default' : 'outline'}
                      >
                        {plan.cta}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 px-6 py-20 lg:px-12">
        <div className="mx-auto max-w-4xl">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="glass-strong relative overflow-hidden rounded-3xl p-12 text-center"
          >
            <div className="pointer-events-none absolute inset-0 bg-radial-glow" />
            <div className="relative">
              <Zap className="mx-auto h-12 w-12 text-primary" />
              <h2 className="mt-6 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Help Dey Go.
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
                Join DEYGO today. Because one tap can save your life.
              </p>
              <Link href="/signup" className="inline-block mt-8">
                <Button size="lg" className="h-14 px-8 text-base bg-primary text-white hover:bg-red-600 shadow-glow-red">
                  Get Started Free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 px-6 py-12 lg:px-12">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            <div className="col-span-2 md:col-span-1">
              <Logo />
              <p className="mt-4 text-sm text-muted-foreground">
                Nigeria&apos;s next-generation emergency response platform. Help Dey Go.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground">Product</h4>
              <ul className="mt-4 space-y-2">
                <li><Link href="#features" className="text-sm text-muted-foreground hover:text-foreground">Features</Link></li>
                <li><Link href="#pricing" className="text-sm text-muted-foreground hover:text-foreground">Pricing</Link></li>
                <li><Link href="/signup" className="text-sm text-muted-foreground hover:text-foreground">Sign Up</Link></li>
                <li><Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">Sign In</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground">Company</h4>
              <ul className="mt-4 space-y-2">
                <li><Link href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground">How It Works</Link></li>
                <li><Link href="#partners" className="text-sm text-muted-foreground hover:text-foreground">Partners</Link></li>
                <li><Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground">Admin</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground">Emergency</h4>
              <ul className="mt-4 space-y-2">
                <li className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-3.5 w-3.5 text-primary" /> 112
                </li>
                <li className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Siren className="h-3.5 w-3.5 text-primary" /> NEMA 0800CALLNEMA
                </li>
                <li className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Shield className="h-3.5 w-3.5 text-primary" /> Police 199
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-white/5 pt-6 sm:flex-row">
            <p className="text-xs text-muted-foreground">
              &copy; {new Date().getFullYear()} DEYGO. All rights reserved.
            </p>
            <p className="text-xs text-muted-foreground">
              Built for Nigeria. Scaled for Africa.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
