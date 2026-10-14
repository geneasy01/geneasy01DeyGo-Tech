'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface SectionHeadingProps {
  badge?: string;
  title: string;
  subtitle?: string;
  className?: string;
  align?: 'left' | 'center';
}

export function SectionHeading({
  badge,
  title,
  subtitle,
  className,
  align = 'center',
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3',
        align === 'center' ? 'items-center text-center' : 'items-start text-left',
        className
      )}
    >
      {badge && (
        <motion.span
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-primary"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          {badge}
        </motion.span>
      )}
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.1 }}
        className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl"
      >
        {title}
      </motion.h2>
      {subtitle && (
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className={cn(
            'text-base text-muted-foreground sm:text-lg',
            align === 'center' ? 'max-w-2xl' : 'max-w-xl'
          )}
        >
          {subtitle}
        </motion.p>
      )}
    </div>
  );
}
