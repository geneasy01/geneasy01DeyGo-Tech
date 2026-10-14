'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Shield, Activity } from 'lucide-react';

export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: { icon: 'h-7 w-7', text: 'text-lg' },
    md: { icon: 'h-9 w-9', text: 'text-xl' },
    lg: { icon: 'h-12 w-12', text: 'text-2xl' },
  };
  const s = sizes[size];

  return (
    <Link href="/" className="flex items-center gap-2.5 group">
      <div className="relative">
        <div className={`${s.icon} rounded-xl bg-gradient-to-br from-primary to-red-700 flex items-center justify-center shadow-glow-red transition-transform group-hover:scale-105`}>
          <Shield className="h-1/2 w-1/2 text-white" strokeWidth={2.5} />
        </div>
        <Activity className="absolute -top-0.5 -right-0.5 h-3 w-3 text-red-400" />
      </div>
      <span className={`${s.text} font-bold tracking-tight text-foreground`}>
        DEYGO
      </span>
    </Link>
  );
}

export function AnimatedLogo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: { icon: 'h-7 w-7', text: 'text-lg' },
    md: { icon: 'h-9 w-9', text: 'text-xl' },
    lg: { icon: 'h-12 w-12', text: 'text-2xl' },
  };
  const s = sizes[size];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="flex items-center gap-2.5"
    >
      <motion.div
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        className={`${s.icon} rounded-xl bg-gradient-to-br from-primary to-red-700 flex items-center justify-center shadow-glow-red`}
      >
        <Shield className="h-1/2 w-1/2 text-white" strokeWidth={2.5} />
      </motion.div>
      <span className={`${s.text} font-bold tracking-tight text-foreground`}>
        DEYGO
      </span>
    </motion.div>
  );
}
