'use client';

/**
 * EditClientModal Component
 *
 * Modal form for editing client information.
 * Allows editing name, company, and website.
 * Email is read-only since it's the unique identifier.
 */

import { useEffect, useState } from 'react';
import { m, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { useAuth } from '@clerk/nextjs';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui';
import { resolveApiUrl } from '@/lib/api/api-env';

interface EditClientModalProps {
  client: {
    id: string;
    name: string;
    company: string;
    email: string;
    website: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
  onClose: () => void;
}

export function EditClientModal({ client, onClose }: EditClientModalProps) {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  const [name, setName] = useState(client.name);
  const [company, setCompany] = useState(client.company);
  const [website, setWebsite] = useState(client.website || '');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Update client mutation
  const updateMutation = useMutation({
    mutationFn: async (data: { name: string; company: string; website?: string }) => {
      const token = await getToken();
      if (!token) throw new Error('No auth token');
      const response = await fetch(resolveApiUrl(`/api/clients/${client.id}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to update client');
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch client detail query
      queryClient.invalidateQueries({ queryKey: ['client-detail', client.id] });
      // Also invalidate clients list query
      queryClient.invalidateQueries({ queryKey: ['clients-with-connections'] });

      onClose();
    },
    onError: (error: Error) => {
      setErrorMessage(error.message);
    },
  });

  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !updateMutation.isPending) onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, updateMutation.isPending]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validation
    if (!name.trim()) {
      setErrorMessage('Name is required');
      return;
    }
    if (!company.trim()) {
      setErrorMessage('Company is required');
      return;
    }

    // Update client
    updateMutation.mutate({
      name: name.trim(),
      company: company.trim(),
      website: website.trim() || undefined,
    });
  };

  return (
    <AnimatePresence>
      <m.div
        initial={shouldReduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.15 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
        onClick={() => {
          if (!updateMutation.isPending) onClose();
        }}
      >
        <m.div
          initial={shouldReduceMotion ? false : { scale: 0.98, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={shouldReduceMotion ? { opacity: 0 } : { scale: 0.98, opacity: 0 }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.25, ease: [0.22, 1, 0.36, 1] }}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-client-modal-title"
          className="w-full max-w-md border-2 border-black bg-card shadow-brutalist"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-black/10">
            <h2 id="edit-client-modal-title" className="text-lg font-semibold text-ink font-display">Edit Client</h2>
            <Button
              onClick={onClose}
              variant="ghost"
              size="icon"
              aria-label="Close modal"
            >
              <X className="h-5 w-5 text-muted-foreground" />
            </Button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Name <span className="text-danger-ink">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-none border border-border px-3 py-2"
                placeholder="Client contact name"
              />
            </div>

            {/* Company */}
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Company <span className="text-danger-ink">*</span>
              </label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="w-full rounded-none border border-border px-3 py-2"
                placeholder="Company name"
              />
            </div>

            {/* Email (read-only) */}
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Email
              </label>
              <input
                type="email"
                value={client.email}
                disabled
                className="w-full cursor-not-allowed rounded-none border border-border bg-muted/20 px-3 py-2 text-muted-foreground"
                title="Email cannot be changed"
              />
              <p className="text-xs text-muted-foreground mt-1">Email cannot be changed</p>
            </div>

            {/* Website */}
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Website
              </label>
              <input
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="w-full rounded-none border border-border px-3 py-2"
                placeholder="https://example.com"
              />
            </div>

            {/* Error message */}
            {errorMessage && (
              <div className="border border-coral bg-coral/10 p-3">
                <p className="text-sm text-danger-ink">{errorMessage}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-black/10">
              <Button
                type="button"
                onClick={onClose}
                disabled={updateMutation.isPending}
                variant="secondary"
                size="sm"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                isLoading={updateMutation.isPending}
                size="sm"
              >
                Save Changes
              </Button>
            </div>
          </form>
        </m.div>
      </m.div>
    </AnimatePresence>
  );
}
