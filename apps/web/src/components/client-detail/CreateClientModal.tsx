'use client';

/**
 * CreateClientModal Component
 *
 * Modal form for creating a new client.
 * Allows entering name, company, email, and website.
 */

import { useEffect, useRef, useState } from 'react';
import { m } from 'framer-motion';
import { X, Loader2, CheckCircle2, Plus } from 'lucide-react';
import { useAuth } from '@clerk/nextjs';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getApiBaseUrl } from '@/lib/api/api-env';
import { extractApiErrorMessage } from '@/lib/api/extract-error';
import { Button } from '@/components/ui/button';

interface CreateClientModalProps {
  onClose: () => void;
  onSuccess?: (client: { id: string; name: string; email: string }) => void;
}

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// URL validation regex (simple)
const URL_REGEX = /^https?:\/\/.+/;

export function CreateClientModal({ onClose, onSuccess }: CreateClientModalProps) {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const submissionInFlightRef = useRef(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialog.open) dialog.showModal();
    nameInputRef.current?.focus();

    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      openerRef.current?.focus();
    };
  }, []);

  const closeModal = () => {
    dialogRef.current?.close();
    onClose();
  };

  // Create client mutation
  const createMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      company: string;
      email: string;
      website?: string;
      language?: string;
    }) => {
      const token = await getToken();
      if (!token) throw new Error('No auth token');
      const apiBase = getApiBaseUrl();
      const response = await fetch(`${apiBase}/api/clients`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const msg = await extractApiErrorMessage(response, 'Failed to create client');
        throw new Error(msg);
      }

      const result = await response.json() as { data?: { id?: string; name?: string; email?: string } };
      if (!result.data?.id || !result.data.name || !result.data.email) {
        throw new Error('Server returned no client');
      }

      return result.data as { id: string; name: string; email: string };
    },
    onSuccess: (client) => {
      // Invalidate clients list query
      queryClient.invalidateQueries({ queryKey: ['clients-with-connections'] });

      setSuccess(true);
      closeTimerRef.current = setTimeout(() => {
        onSuccess?.(client);
        closeModal();
      }, 1000);
    },
    onError: (error: Error) => {
      submissionInFlightRef.current = false;
      setErrorMessage(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (submissionInFlightRef.current) return;
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
    if (!email.trim()) {
      setErrorMessage('Email is required');
      return;
    }
    if (!EMAIL_REGEX.test(email.trim())) {
      setErrorMessage('Please enter a valid email address');
      return;
    }
    if (website.trim() && !URL_REGEX.test(website.trim())) {
      setErrorMessage('Website must be a valid URL (e.g., https://example.com)');
      return;
    }

    submissionInFlightRef.current = true;
    createMutation.mutate({
      name: name.trim(),
      company: company.trim(),
      email: email.trim().toLowerCase(),
      website: website.trim() || undefined,
      language: 'en',
    });
  };

  return (
    <m.dialog
      ref={dialogRef}
      aria-labelledby="create-client-title"
      onCancel={(event) => {
        event.preventDefault();
        closeModal();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) closeModal();
      }}
      className="fixed z-50 m-auto w-full max-w-md overflow-visible border-0 bg-transparent p-4 backdrop:bg-black/50"
    >
      <m.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-card rounded-lg shadow-brutalist"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/10">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 bg-coral/20 rounded-lg">
              <Plus className="h-4 w-4 text-danger-ink" />
            </div>
            <h2 id="create-client-title" className="text-lg font-semibold text-ink">Create Client</h2>
          </div>
          <button
            type="button"
            aria-label="Close create client"
            onClick={closeModal}
            className="p-1 text-muted-foreground hover:bg-muted/10 rounded-none transition-colors"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Name */}
            <div>
              <label htmlFor="create-client-name" className="block text-sm font-medium text-gray-700 mb-1">
                Client contact name <span className="text-danger-ink">*</span>
              </label>
              <input
                id="create-client-name"
                ref={nameInputRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border-2 border-black/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-coral focus:border-transparent"
                placeholder="Client contact name"
                disabled={createMutation.isPending}
              />
            </div>

            {/* Company */}
            <div>
              <label htmlFor="create-client-company" className="block text-sm font-medium text-gray-700 mb-1">
                Company name <span className="text-danger-ink">*</span>
              </label>
              <input
                id="create-client-company"
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="w-full px-3 py-2 border-2 border-black/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-coral focus:border-transparent"
                placeholder="Company name"
                disabled={createMutation.isPending}
              />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="create-client-email" className="block text-sm font-medium text-gray-700 mb-1">
                Email address <span className="text-danger-ink">*</span>
              </label>
              <input
                id="create-client-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border-2 border-black/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-coral focus:border-transparent"
                placeholder="client@company.com"
                disabled={createMutation.isPending}
              />
              <p className="text-xs text-gray-500 mt-1">Used for client authentication</p>
            </div>

            {/* Website */}
            <div>
              <label htmlFor="create-client-website" className="block text-sm font-medium text-gray-700 mb-1">
                Website
              </label>
              <input
                id="create-client-website"
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="w-full px-3 py-2 border-2 border-black/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-coral focus:border-transparent"
                placeholder="https://example.com"
                disabled={createMutation.isPending}
              />
            </div>

            {/* Error message */}
            {errorMessage && (
              <div className="p-3 bg-coral/10 border border-coral rounded-lg">
                <p className="text-sm text-danger-ink">{errorMessage}</p>
              </div>
            )}

            {/* Success message */}
            {success && (
              <div className="p-3 bg-teal/10 border border-teal rounded-lg flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success-ink flex-shrink-0" />
                <p className="text-sm text-success-ink">Client created successfully</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-black/10">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={closeModal}
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Create Client
                  </>
                )}
              </Button>
            </div>
        </form>
      </m.div>
    </m.dialog>
  );
}
