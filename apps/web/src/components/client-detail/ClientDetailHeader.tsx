'use client';

/**
 * ClientDetailHeader Component
 *
 * Displays client profile information with action buttons.
 * Shows client avatar, name, company, email, client since date,
 * and status badge. Includes Edit and Delete action buttons.
 */

import { useState } from 'react';
import { Mail, Building2, Calendar, Edit, Trash2, Link2 } from 'lucide-react';
import { Button, Card, StatusBadge } from '@/components/ui';
import type { ClientLanguage } from '@agency-platform/shared';
import { EditClientModal } from './EditClientModal';
import { DeleteClientModal } from './DeleteClientModal';
import { CreateRequestModal } from './CreateRequestModal';

interface ClientDetailHeaderProps {
  client: {
    id: string;
    name: string;
    company: string;
    email: string;
    website: string | null;
    language: ClientLanguage;
    createdAt: Date;
    updatedAt: Date;
  };
}

export function ClientDetailHeader({ client }: ClientDetailHeaderProps) {
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showCreateRequestModal, setShowCreateRequestModal] = useState(false);

  // Get initials from name
  const initials = client.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // Format client since date
  const clientSince = new Date(client.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Determine client status based on activity
  // For now, all clients are considered "active" - this could be enhanced
  // to check for active connections
  const status = 'active' as const;

  return (
    <>
      <Card className="p-6 border-black/10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          {/* Left side: Avatar and info */}
          <div className="flex items-start space-x-4 flex-1">
            {/* Avatar */}
            <div className="h-16 w-16 bg-accent rounded-full flex items-center justify-center border border-border flex-shrink-0">
              <span className="text-xl font-semibold font-mono text-foreground">
                {initials}
              </span>
            </div>

            {/* Client info */}
            <div className="flex-1 min-w-0">
              <div className="mb-1 flex flex-wrap items-center gap-2 sm:gap-3">
                <h1 className="min-w-0 break-words text-2xl font-semibold text-foreground tracking-tight">
                  {client.name}
                </h1>
                <StatusBadge status={status} size="md" />
              </div>

              <div className="space-y-1">
                {/* Company */}
                <div className="flex items-center text-sm text-muted-foreground">
                  <Building2 className="h-4 w-4 mr-2 flex-shrink-0" />
                  <span className="min-w-0 break-words font-medium">{client.company}</span>
                </div>

                {/* Email */}
                <div className="flex items-center text-sm text-muted-foreground">
                  <Mail className="h-4 w-4 mr-2 flex-shrink-0" />
                  <span className="min-w-0 break-all">{client.email}</span>
                </div>

                {/* Client since */}
                <div className="flex items-center text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4 mr-2 flex-shrink-0" />
                  <span>Client since {clientSince}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right side: Action buttons */}
          <div className="flex flex-wrap items-center gap-2 lg:ml-4">
            <Button
              onClick={() => setShowCreateRequestModal(true)}
              size="sm"
              leftIcon={<Link2 className="h-4 w-4" />}
            >
              Create Request
            </Button>

            <Button
              onClick={() => setShowEditModal(true)}
              variant="secondary"
              size="sm"
              leftIcon={<Edit className="h-4 w-4" />}
            >
              Edit
            </Button>

            <Button
              onClick={() => setShowDeleteModal(true)}
              variant="secondary"
              size="sm"
              leftIcon={<Trash2 className="h-4 w-4" />}
              className="text-danger-ink border-coral/40 hover:bg-coral/10"
            >
              Delete
            </Button>
          </div>
        </div>
      </Card>

      {/* Modals */}
      {showCreateRequestModal && (
        <CreateRequestModal
          client={client}
          onClose={() => setShowCreateRequestModal(false)}
        />
      )}

      {showEditModal && (
        <EditClientModal
          client={client}
          onClose={() => setShowEditModal(false)}
        />
      )}

      {showDeleteModal && (
        <DeleteClientModal
          client={client}
          onClose={() => setShowDeleteModal(false)}
        />
      )}
    </>
  );
}
