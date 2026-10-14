'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  User,
  Phone,
  Plus,
  Trash2,
  Heart,
  Stethoscope,
  Scale,
  Home,
  UserPlus,
  Loader2,
  Pencil,
  X,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import type { Contact, ContactCategory } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const categoryConfig: Record<
  ContactCategory,
  { label: string; icon: typeof User; color: string; bg: string }
> = {
  family: { label: 'Family', icon: Heart, color: 'text-red-400', bg: 'bg-red-500/10' },
  friend: { label: 'Friend', icon: User, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  doctor: { label: 'Doctor', icon: Stethoscope, color: 'text-green-400', bg: 'bg-green-500/10' },
  lawyer: { label: 'Lawyer', icon: Scale, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  neighbour: { label: 'Neighbour', icon: Home, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
};

export default function ContactsPage() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState('');
  const [category, setCategory] = useState<ContactCategory>('family');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('contacts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      setContacts((data || []) as Contact[]);
      setLoading(false);
    })();
  }, [user]);

  const resetForm = () => {
    setName('');
    setPhone('');
    setRelationship('');
    setCategory('family');
    setEditingId(null);
    setShowForm(false);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setError('');

    if (editingId) {
      const { error } = await supabase
        .from('contacts')
        .update({ name, phone, relationship, category })
        .eq('id', editingId);
      if (error) {
        setError(error.message);
        setSaving(false);
        return;
      }
      setContacts(
        contacts.map((c) =>
          c.id === editingId ? { ...c, name, phone, relationship, category } : c
        )
      );
    } else {
      const { data, error } = await supabase
        .from('contacts')
        .insert({
          user_id: user.id,
          name,
          phone,
          relationship,
          category,
        })
        .select()
        .single();
      if (error) {
        setError(error.message);
        setSaving(false);
        return;
      }
      setContacts([data as Contact, ...contacts]);
    }
    resetForm();
    setSaving(false);
  };

  const handleEdit = (contact: Contact) => {
    setEditingId(contact.id);
    setName(contact.name);
    setPhone(contact.phone);
    setRelationship(contact.relationship || '');
    setCategory(contact.category);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    await supabase.from('contacts').delete().eq('id', id);
    setContacts(contacts.filter((c) => c.id !== id));
  };

  const groupedContacts = contacts.reduce(
    (acc, contact) => {
      if (!acc[contact.category]) acc[contact.category] = [];
      acc[contact.category].push(contact);
      return acc;
    },
    {} as Record<string, Contact[]>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground md:text-3xl">Emergency Contacts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your trusted network — family, friends, doctors, lawyers, and neighbours.
          </p>
        </div>
        {!showForm && (
          <Button
            onClick={() => setShowForm(true)}
            className="bg-primary text-white hover:bg-red-600"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Contact
          </Button>
        )}
      </div>

      {/* Add/Edit Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Card className="glass-strong rounded-2xl border-white/10">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">
                    {editingId ? 'Edit Contact' : 'Add Emergency Contact'}
                  </CardTitle>
                  <button onClick={resetForm}>
                    <X className="h-5 w-5 text-muted-foreground" />
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                {error && (
                  <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
                    {error}
                  </div>
                )}
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="name">Name</Label>
                      <Input
                        id="name"
                        placeholder="Contact name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                      />
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
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="relationship">Relationship</Label>
                      <Input
                        id="relationship"
                        placeholder="e.g. Brother, Family Doctor"
                        value={relationship}
                        onChange={(e) => setRelationship(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Select
                        value={category}
                        onValueChange={(v) => setCategory(v as ContactCategory)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(categoryConfig).map(([key, config]) => (
                            <SelectItem key={key} value={key}>
                              {config.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Button
                      type="submit"
                      className="flex-1 bg-primary text-white hover:bg-red-600"
                      disabled={saving}
                    >
                      {saving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : editingId ? (
                        'Save Changes'
                      ) : (
                        'Add Contact'
                      )}
                    </Button>
                    <Button type="button" variant="outline" className="glass" onClick={resetForm}>
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Contacts by category */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : contacts.length === 0 ? (
        <Card className="glass-card rounded-2xl border-white/5">
          <CardContent className="flex flex-col items-center py-16 text-center">
            <UserPlus className="h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-sm text-muted-foreground">
              No emergency contacts yet. Add people you trust to be notified during emergencies.
            </p>
            {!showForm && (
              <Button
                onClick={() => setShowForm(true)}
                className="mt-6 bg-primary text-white hover:bg-red-600"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Your First Contact
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(categoryConfig).map(([catKey, config]) => {
            const catContacts = groupedContacts[catKey] || [];
            if (catContacts.length === 0) return null;
            return (
              <div key={catKey}>
                <div className="mb-3 flex items-center gap-2">
                  <config.icon className={`h-4 w-4 ${config.color}`} />
                  <h3 className="text-sm font-semibold text-foreground">{config.label}</h3>
                  <span className="text-xs text-muted-foreground">({catContacts.length})</span>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {catContacts.map((contact, i) => (
                    <motion.div
                      key={contact.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: i * 0.05 }}
                    >
                      <Card className="glass-card group rounded-2xl border-white/5 transition-all hover:border-white/10">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div
                              className={`flex h-11 w-11 items-center justify-center rounded-xl ${config.bg}`}
                            >
                              <config.icon className={`h-5 w-5 ${config.color}`} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-semibold text-foreground">
                                {contact.name}
                              </div>
                              {contact.relationship && (
                                <div className="truncate text-xs text-muted-foreground">
                                  {contact.relationship}
                                </div>
                              )}
                              <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                                <Phone className="h-3 w-3" />
                                {contact.phone}
                              </div>
                            </div>
                            <div className="flex flex-col gap-1 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                              <button
                                onClick={() => handleEdit(contact)}
                                className="rounded-lg p-1.5 text-muted-foreground hover:bg-white/5 hover:text-foreground"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(contact.id)}
                                className="rounded-lg p-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-400"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
