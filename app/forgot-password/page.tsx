'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Mail, ArrowRight, ArrowLeft, CheckCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });

    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
    setLoading(false);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background bg-grid">
      <div className="pointer-events-none absolute inset-0 bg-radial-glow" />
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 py-12">
        <Link href="/" className="mb-8">
          <Logo size="lg" />
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <Card className="glass-strong rounded-2xl border-white/10">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Reset Password</CardTitle>
              <CardDescription>
                {sent
                  ? 'Check your email for a reset link'
                  : 'Enter your email to receive a password reset link'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
                  {error}
                </div>
              )}

              {sent ? (
                <div className="flex flex-col items-center gap-4 py-4 text-center">
                  <CheckCircle className="h-12 w-12 text-green-400" />
                  <p className="text-sm text-muted-foreground">
                    We&apos;ve sent a password reset link to{' '}
                    <span className="font-medium text-foreground">{email}</span>.
                    Follow the link to reset your password.
                  </p>
                  <Link href="/login" className="block w-full">
                    <Button variant="outline" className="w-full glass">
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back to Sign In
                    </Button>
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleReset} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-primary text-white hover:bg-red-600"
                    disabled={loading}
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        Send Reset Link
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </form>
              )}

              <p className="text-center text-sm text-muted-foreground">
                Remember your password?{' '}
                <Link href="/login" className="font-medium text-primary hover:text-red-400">
                  Sign in
                </Link>
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
