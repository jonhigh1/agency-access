'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { AlertCircle, ChevronDown, Plus, Trash2 } from 'lucide-react';
import { LogoSpinner } from '@/components/ui/logo-spinner';
import { ConfirmModal } from '@/components/access-request-detail/confirm-modal';
import { AccessLevelSelector } from '@/components/access-level-selector';
import { HierarchicalPlatformSelector } from '@/components/hierarchical-platform-selector';
import { Button, SingleSelect } from '@/components/ui';
import { getAccessRequest, updateAccessRequest } from '@/lib/api/access-requests';
import type { AccessRequest } from '@/lib/api/access-requests';
import { transformPlatformsForAPI, normalizePlatformToGroup } from '@/lib/transform-platforms';
import { fetchActiveAgencyPlatformConnections } from '@/hooks/use-user-agency';
import type { AccessLevel } from '@agency-platform/shared';
import type { IntakeField } from '@/contexts/access-request-context';

interface EditAccessRequestPageProps {
  params: Promise<{ id: string }>;
}

interface ConnectedPlatform {
  platform: string;
  name: string;
  connected: boolean;
  status?: string;
  connectedEmail?: string;
}

interface BrandingDraft {
  logoUrl: string;
  primaryColor: string;
  subdomain: string;
}

function isEditable(status: AccessRequest['status']): boolean {
  return status === 'pending' || status === 'partial';
}

function normalizeIntakeFields(fields: IntakeField[]): IntakeField[] {
  return fields.map((field, index) => ({
    ...field,
    order: index,
  }));
}

function toPlatformSelection(request: AccessRequest): Record<string, string[]> {
  return request.platforms.reduce<Record<string, string[]>>((acc, group) => {
    acc[group.platformGroup] = group.products.map((product) => product.product);
    return acc;
  }, {});
}

function inferAccessLevel(request: AccessRequest): AccessLevel {
  const firstProduct = request.platforms[0]?.products[0];
  if (!firstProduct) {
    return 'standard';
  }

  const value = firstProduct.accessLevel;
  if (value === 'admin' || value === 'standard' || value === 'read_only' || value === 'email_only') {
    return value;
  }

  return 'standard';
}

export default function EditAccessRequestPage({ params }: EditAccessRequestPageProps) {
  const { getToken } = useAuth();
  const router = useRouter();

  const [requestId, setRequestId] = useState<string>('');
  const [request, setRequest] = useState<AccessRequest | null>(null);
  const [externalReference, setExternalReference] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<Record<string, string[]>>({});
  const [globalAccessLevel, setGlobalAccessLevel] = useState<AccessLevel>('standard');
  const [platformAccessLevels, setPlatformAccessLevels] = useState<Record<string, AccessLevel>>({});
  const [intakeFields, setIntakeFields] = useState<IntakeField[]>([]);
  const [branding, setBranding] = useState<BrandingDraft>({
    logoUrl: '',
    primaryColor: '#FF6B35',
    subdomain: '',
  });
  const [connectedPlatforms, setConnectedPlatforms] = useState<ConnectedPlatform[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [initialSnapshot, setInitialSnapshot] = useState<string>('');
  const [advancedExpanded, setAdvancedExpanded] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const snapshot = useMemo(
    () =>
      JSON.stringify({
        externalReference,
        selectedPlatforms,
        globalAccessLevel,
        intakeFields,
        branding,
      }),
    [externalReference, selectedPlatforms, globalAccessLevel, intakeFields, branding]
  );
  const hasUnsavedChanges = initialSnapshot !== '' && initialSnapshot !== snapshot;

  useEffect(() => {
    async function load() {
      const resolved = await params;
      setRequestId(resolved.id);

      const result = await getAccessRequest(resolved.id, getToken);
      if (result.error || !result.data) {
        setError(result.error?.message || 'Failed to load access request');
        setLoading(false);
        return;
      }

      if (!isEditable(result.data.status)) {
        router.push(`/access-requests/${resolved.id}` as any);
        return;
      }

      const requestData = result.data;
      const selection = toPlatformSelection(requestData);
      const normalizedFields = normalizeIntakeFields((requestData.intakeFields || []) as IntakeField[]);
      const nextBranding: BrandingDraft = {
        logoUrl: requestData.branding?.logoUrl || '',
        primaryColor: requestData.branding?.primaryColor || '#FF6B35',
        subdomain: requestData.branding?.subdomain || '',
      };

      setRequest(requestData);
      setExternalReference(requestData.externalReference || '');
      setSelectedPlatforms(selection);
      setGlobalAccessLevel(inferAccessLevel(requestData));
      setIntakeFields(normalizedFields);
      setBranding(nextBranding);

      setInitialSnapshot(JSON.stringify({
        externalReference: requestData.externalReference || '',
        selectedPlatforms: selection,
        globalAccessLevel: inferAccessLevel(requestData),
        intakeFields: normalizedFields,
        branding: nextBranding,
      }));

      setLoading(false);
    }

    load();
  }, [params, getToken, router]);

  useEffect(() => {
    if (!request?.agencyId) {
      return;
    }

    const loadConnections = async () => {
      try {
        const data = await fetchActiveAgencyPlatformConnections(request.agencyId, getToken);
        const normalized = data.map((item) => ({
          platform: normalizePlatformToGroup(item.platform),
          name: item.name || item.platform,
          connected: item.connected === true || item.status === 'active' || item.status === undefined,
          status: item.status,
          connectedEmail: item.agencyEmail || item.connectedBy || (item.metadata?.email as string | undefined),
        }));
        setConnectedPlatforms(normalized);
      } catch {
        // ponytail: deliberate degradation — connection status is advisory, never block editing.
        setConnectedPlatforms([]);
      }
    };

    void loadConnections();
  }, [request?.agencyId, getToken]);

  useEffect(() => {
    if (!hasUnsavedChanges) {
      return;
    }

    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [hasUnsavedChanges]);

  const mergedConnectedPlatforms = useMemo(() => {
    const map = new Map<string, ConnectedPlatform>();

    for (const connection of connectedPlatforms) {
      map.set(connection.platform, connection);
    }

    for (const platformGroup of Object.keys(selectedPlatforms)) {
      if (!map.has(platformGroup)) {
        map.set(platformGroup, {
          platform: platformGroup,
          name: platformGroup,
          connected: true,
          status: 'active',
        });
      }
    }

    return Array.from(map.values());
  }, [connectedPlatforms, selectedPlatforms]);

  const profileEditHref = useMemo(() => {
    if (!request) {
      return '/clients';
    }

    if (request.clientId) {
      return `/clients/${request.clientId}`;
    }

    return `/clients?email=${encodeURIComponent(request.clientEmail)}`;
  }, [request]);

  const addIntakeField = () => {
    const next: IntakeField = {
      id: String(Date.now()),
      label: '',
      type: 'text',
      required: false,
      order: intakeFields.length,
    };
    setIntakeFields([...intakeFields, next]);
  };

  const updateIntakeField = (id: string, updates: Partial<IntakeField>) => {
    setIntakeFields((prev) =>
      prev.map((field) => (field.id === id ? { ...field, ...updates } : field))
    );
  };

  const removeIntakeField = (id: string) => {
    setIntakeFields((prev) => prev.filter((field) => field.id !== id));
  };

  const handleDiscard = () => {
    if (hasUnsavedChanges) {
      setShowDiscardConfirm(true);
      return;
    }

    router.push(`/access-requests/${requestId}` as any);
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!requestId) {
      return;
    }

    const selectedCount = Object.values(selectedPlatforms).reduce((sum, products) => sum + products.length, 0);
    if (selectedCount === 0) {
      setError('Select at least one platform before saving.');
      return;
    }

    if (intakeFields.some((field) => !field.label.trim())) {
      setError('All intake fields must have a label before saving.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    const result = await updateAccessRequest(
      requestId,
      {
        externalReference: externalReference.trim() || undefined,
        platforms: transformPlatformsForAPI(selectedPlatforms, platformAccessLevels, globalAccessLevel),
        intakeFields: normalizeIntakeFields(intakeFields),
        branding: {
          logoUrl: branding.logoUrl || undefined,
          primaryColor: branding.primaryColor || undefined,
          subdomain: branding.subdomain || undefined,
        },
      },
      getToken
    );

    if (result.error || !result.data) {
      setError(result.error?.message || 'Failed to save changes');
      setSaving(false);
      return;
    }

    setRequest(result.data);
    setInitialSnapshot(snapshot);
    if (result.data.authorizationLinkChanged) {
      setSuccess('Link updated. Resend this link to your client.');
    } else {
      setSuccess('Request updated.');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <LogoSpinner size="lg" />
      </div>
    );
  }

  if (error && !request) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-lg border border-coral/30 bg-card p-6 text-center">
          <AlertCircle className="h-8 w-8 text-danger-ink mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <div className="mt-4">
            <Button variant="secondary" onClick={() => router.push('/dashboard')}>
              Back to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-3 border-b-2 border-black pb-5">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
              Edit Access Request
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Update settings while the authorization link is still pending.
            </p>
          </div>
          <Button type="button" variant="secondary" onClick={() => router.back()}>
            Back
          </Button>
        </header>
      <form onSubmit={handleSave} className="space-y-6">
        <div className="border-2 border-black bg-card p-6 shadow-brutalist space-y-4">
          <h2 className="text-lg font-semibold text-ink">Platforms</h2>
          <AccessLevelSelector
            selectedAccessLevel={globalAccessLevel}
            onSelectionChange={(next) => setGlobalAccessLevel(next)}
          />
          <HierarchicalPlatformSelector
            selectedPlatforms={selectedPlatforms}
            onSelectionChange={setSelectedPlatforms}
            connectedPlatforms={mergedConnectedPlatforms}
            agencyId={request?.agencyId}
          />
        </div>

        <div className="border-2 border-black bg-card p-6 shadow-brutalist space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-ink">Advanced</h2>
            <button
              type="button"
              onClick={() => setAdvancedExpanded((prev) => !prev)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-ink"
              aria-expanded={advancedExpanded}
              aria-controls="advanced-settings"
              aria-label={advancedExpanded ? 'Hide advanced settings' : 'Show advanced settings'}
            >
              {advancedExpanded ? 'Hide' : 'Show'}
              <ChevronDown
                className="h-3.5 w-3.5 transition-transform"
                aria-hidden="true"
                style={{ transform: advancedExpanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}
              />
            </button>
          </div>

          {advancedExpanded && (
            <div id="advanced-settings" className="space-y-4">
              <div>
                <label htmlFor="externalReference" className="block text-sm font-medium text-foreground mb-1">
                  External Reference
                </label>
                <input
                  id="externalReference"
                  type="text"
                  value={externalReference}
                  onChange={(event) => setExternalReference(event.target.value)}
                  maxLength={255}
                  placeholder="crm-123"
                  className="w-full rounded-lg border border-border bg-card px-3 py-2"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Optional CRM or internal identifier included in webhook payloads.
                </p>
              </div>

              <div className="rounded-lg border border-border bg-paper p-3 text-xs text-muted-foreground">
                Client name and email are managed in the client profile.
                <button
                  type="button"
                  onClick={() => router.push(profileEditHref as any)}
                  className="ml-1 font-semibold text-danger-ink hover:text-danger-ink"
                >
                  Edit client profile
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="border-2 border-black bg-card p-6 shadow-brutalist space-y-4">
          <h2 className="text-lg font-semibold text-ink">Customize</h2>

          <div className="space-y-3">
            {intakeFields.map((field) => (
              <div key={field.id} className="rounded-lg border border-border p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    type="text"
                    value={field.label}
                    onChange={(event) => updateIntakeField(field.id, { label: event.target.value })}
                    className="w-full rounded-lg border border-border px-3 py-2"
                    placeholder="Field label"
                  />
                  <SingleSelect
                    options={[
                      { value: 'text', label: 'Text' },
                      { value: 'email', label: 'Email' },
                      { value: 'phone', label: 'Phone' },
                      { value: 'url', label: 'URL' },
                      { value: 'textarea', label: 'Text Area' },
                      { value: 'dropdown', label: 'Dropdown' },
                    ]}
                    value={field.type}
                    onChange={(v) => updateIntakeField(field.id, { type: v as IntakeField['type'] })}
                    placeholder="Field type"
                    ariaLabel="Field type"
                    triggerClassName="w-full rounded-lg border border-border px-3 py-2 min-h-auto"
                  />
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <label className="inline-flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={field.required}
                      onChange={(event) => updateIntakeField(field.id, { required: event.target.checked })}
                      className="h-4 w-4 rounded border-border"
                    />
                    Required
                  </label>
                  <button
                    type="button"
                    onClick={() => removeIntakeField(field.id)}
                    className="inline-flex items-center gap-1 text-sm text-danger-ink hover:text-danger-ink"
                  >
                    <Trash2 className="h-4 w-4" />
                    Remove
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={addIntakeField}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-foreground hover:bg-paper"
            >
              <Plus className="h-4 w-4" />
              Add Field
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="logoUrl" className="block text-sm font-medium text-foreground mb-1">
                Logo URL
              </label>
              <input
                id="logoUrl"
                type="url"
                value={branding.logoUrl}
                onChange={(event) => setBranding((prev) => ({ ...prev, logoUrl: event.target.value }))}
                className="w-full rounded-lg border border-border px-3 py-2"
              />
            </div>
            <div>
              <label htmlFor="primaryColor" className="block text-sm font-medium text-foreground mb-1">
                Primary Color
              </label>
              <input
                id="primaryColor"
                type="text"
                value={branding.primaryColor}
                onChange={(event) => setBranding((prev) => ({ ...prev, primaryColor: event.target.value }))}
                className="w-full rounded-lg border border-border px-3 py-2"
              />
            </div>
          </div>

          <div>
            <label htmlFor="subdomain" className="block text-sm font-medium text-foreground mb-1">
              Subdomain
            </label>
            <input
              id="subdomain"
              type="text"
              value={branding.subdomain}
              onChange={(event) => setBranding((prev) => ({ ...prev, subdomain: event.target.value.toLowerCase() }))}
              className="w-full rounded-lg border border-border px-3 py-2"
            />
          </div>
        </div>

        {error && (
          <div className="border border-black bg-paper p-3 text-sm text-danger-ink">
            {error}
          </div>
        )}

        {success && (
          <div className="border border-black bg-paper p-3 text-sm text-success-ink">
            {success}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={handleDiscard}
          >
            Discard Changes
          </Button>
          <Button
            type="submit"
            isLoading={saving}
            aria-busy={saving}
            data-testid="edit-access-request-save"
          >
            Save Changes
          </Button>
        </div>
      </form>
        {showDiscardConfirm ? (
          <ConfirmModal
            title="Discard unsaved changes?"
            body="Edits you have not saved will be lost."
            confirmLabel="Discard changes"
            cancelLabel="Keep editing"
            destructive
            onConfirm={() => {
              setShowDiscardConfirm(false);
              router.push(`/access-requests/${requestId}` as any);
            }}
            onClose={() => setShowDiscardConfirm(false)}
          />
        ) : null}
      </div>
    </div>
  );
}
