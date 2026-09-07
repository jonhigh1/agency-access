'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, CircleAlert } from 'lucide-react';
import posthog from 'posthog-js';
import type { ClientAccessRequestPayload, Platform } from '@agency-platform/shared';
import { InviteFlowShell } from '@/components/flow/invite-flow-shell';
import { ManualInviteHeader } from '@/components/flow/manual-invite-header';
import { InviteLoadStateCard } from '@/components/flow/invite-load-state-card';
import {
  ManualChecklistWizard,
  type ManualStepConfig,
} from '@/components/flow/manual-checklist-wizard';
import { Button } from '@/components/ui';
import { buildClientInviteConnectViewUrl } from '@/lib/client-invite-platforms';
import { useInviteRequestLoader } from '@/lib/query/use-invite-request-loader';
import { resolveApiUrl } from '@/lib/api/api-env';

/** Data every manual invite page needs to render header + rail. */
export interface ManualInviteFlowData {
  agencyName: string;
  clientName?: string;
  clientEmail?: string;
  branding?: {
    logoUrl?: string;
    primaryColor?: string;
  };
}

export interface ManualInviteFlowContext<TData> {
  data: TData;
  form: Record<string, string>;
  setFieldValue: (name: string, value: string) => void;
  isFormValid: boolean;
}

export interface ManualInviteFormField {
  name: string;
  label: string;
  placeholder: string;
  mono?: boolean;
  inputMode?: 'text' | 'numeric';
  sanitize?: (value: string) => string;
  isValid: (value: string) => boolean;
  invalidMessage: ReactNode;
}

export interface ManualInviteStepSpec<TData> {
  id: string;
  title: string;
  description: string;
  content: ReactNode | ((ctx: ManualInviteFlowContext<TData>) => ReactNode);
  primaryLabel: string | ((ctx: ManualInviteFlowContext<TData>) => string);
  disabled?: (ctx: ManualInviteFlowContext<TData>) => boolean;
  disabledReason?: (ctx: ManualInviteFlowContext<TData>) => string | undefined;
}

export interface ManualInviteCompletionSpec<TData> {
  id?: string;
  title?: string;
  description: string;
  pendingMessage: ReactNode;
  gateLabel: string | ((data: TData) => string);
  loadingLabel: string;
  renderSummary?: (ctx: ManualInviteFlowContext<TData>) => ReactNode;
  disabled?: (ctx: ManualInviteFlowContext<TData>) => boolean;
  disabledReason?: (ctx: ManualInviteFlowContext<TData>) => string | undefined;
}

export interface ManualInviteConfig<TData extends ManualInviteFlowData> {
  platform: Platform;
  platformName: string;
  loaderSource: Parameters<typeof useInviteRequestLoader>[0]['source'];
  parseData: (payload: ClientAccessRequestPayload) => TData;
  timeoutMessage: string;
  shellDescription: string;
  headerSecurityNote: string;
  railSecurityNote: string;
  objective: string;
  identities: (ctx: ManualInviteFlowContext<TData>) => Array<{ label: string; value: string }>;
  progress?: { stepTitles: string[] };
  fields?: ManualInviteFormField[];
  prefill?: (data: TData) => Record<string, string>;
  steps: Array<ManualInviteStepSpec<TData>>;
  completion: ManualInviteCompletionSpec<TData>;
  submit: {
    failureMessage: string;
    buildBody: (ctx: ManualInviteFlowContext<TData>) => Record<string, unknown>;
    canSubmit?: (ctx: ManualInviteFlowContext<TData>) => boolean;
  };
}

/**
 * Renders form fields for platforms that collect client-side details before
 * completing the manual invite (currently Shopify). Use as a step `content`:
 * `content: (ctx) => renderManualFormFields(ctx, fields)`.
 */
export function renderManualFormFields<TData>(
  ctx: ManualInviteFlowContext<TData>,
  fields: ManualInviteFormField[]
): ReactNode {
  return (
    <div className="space-y-4">
      {fields.map((field) => {
        const value = ctx.form[field.name] ?? '';
        const showInvalid = !field.isValid(value) && value.trim().length > 0;
        return (
          <div key={field.name}>
            <label htmlFor={`manual-invite-${field.name}`} className="mb-2 block text-sm font-medium text-ink">
              {field.label}
            </label>
            <input
              type="text"
              id={`manual-invite-${field.name}`}
              value={value}
              onChange={(event) => ctx.setFieldValue(field.name, event.target.value)}
              placeholder={field.placeholder}
              className={`w-full rounded-lg border border-border bg-paper px-3 py-2 text-sm text-ink${
                field.mono ? ' font-mono' : ''
              }`}
              inputMode={field.inputMode}
            />
            {showInvalid ? <p className="mt-1 text-xs text-danger-ink">{field.invalidMessage}</p> : null}
          </div>
        );
      })}
    </div>
  );
}

export function ManualInviteFlow<TData extends ManualInviteFlowData>({
  config,
}: {
  config: ManualInviteConfig<TData>;
}) {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [completionConfirmed, setCompletionConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [railState, setRailState] = useState<{
    stepIndex: number;
    totalSteps: number;
    label: string;
    blockedReason?: string;
  }>(() => ({
    stepIndex: 0,
    totalSteps: config.steps.length + 1,
    label: 'Continue',
  }));

  const { data, error, phase, retry } = useInviteRequestLoader<TData>({
    endpoint: resolveApiUrl(`/api/client/${token}`),
    source: config.loaderSource,
    parseData: config.parseData,
  });

  const fields = config.fields;

  const isFormValid = !fields || fields.every((field) => field.isValid(form[field.name] ?? ''));

  const setFieldValue = useCallback(
    (name: string, value: string) => {
      const field = fields?.find((candidate) => candidate.name === name);
      setForm((previous) => ({
        ...previous,
        [name]: field?.sanitize ? field.sanitize(value) : value,
      }));
    },
    [fields]
  );

  // Prefill form fields from the loaded request (truthy values only).
  useEffect(() => {
    if (!data || !config.prefill) return;
    const values = config.prefill(data);
    setForm((previous) => {
      const next = { ...previous };
      for (const [key, value] of Object.entries(values)) {
        if (value) next[key] = value;
      }
      return next;
    });
  }, [data, config.prefill]);

  const submitManualConnection = async () => {
    if (!data || submitting) return;

    const ctx: ManualInviteFlowContext<TData> = { data, form, setFieldValue, isFormValid };
    if (config.submit.canSubmit && !config.submit.canSubmit(ctx)) return;

    setSubmitting(true);
    setSubmissionError(null);

    try {
      const response = await fetch(
        resolveApiUrl(`/api/client/${token}/${config.platform}/manual-connect`),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(config.submit.buildBody(ctx)),
        }
      );

      const result = await response.json();
      if (!response.ok || result.error || !result.data?.connectionId) {
        throw new Error(result.error?.message || config.submit.failureMessage);
      }

      router.push(
        `/invite/${token}?step=2&platform=${config.platform}&connectionId=${result.data.connectionId}`
      );
    } catch (err) {
      setSubmissionError(err instanceof Error ? err.message : config.submit.failureMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const steps = useMemo<ManualStepConfig[]>(() => {
    if (!data) return [];

    const ctx: ManualInviteFlowContext<TData> = { data, form, setFieldValue, isFormValid };

    const built = config.steps.map((spec) => {
      const disabled = spec.disabled?.(ctx) ?? false;
      return {
        id: spec.id,
        title: spec.title,
        description: spec.description,
        content: typeof spec.content === 'function' ? spec.content(ctx) : spec.content,
        primaryAction: {
          label:
            typeof spec.primaryLabel === 'function' ? spec.primaryLabel(ctx) : spec.primaryLabel,
          disabled,
          disabledReason: disabled && spec.disabledReason ? spec.disabledReason(ctx) : undefined,
        },
      };
    });

    const completionDisabled = config.completion.disabled?.(ctx) ?? false;

    return [
      ...built,
      {
        id: config.completion.id ?? 'confirm-completion',
        title: config.completion.title ?? 'Confirm and continue',
        description: config.completion.description,
        content: (
          <div className="space-y-3">
            {config.completion.renderSummary?.(ctx)}
            {submissionError ? (
              <div className="rounded-lg border border-coral/30 bg-coral/10 px-3 py-2 text-sm text-danger-ink">
                {submissionError}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{config.completion.pendingMessage}</p>
            )}
          </div>
        ),
        completionGate: {
          label:
            typeof config.completion.gateLabel === 'function'
              ? config.completion.gateLabel(data)
              : config.completion.gateLabel,
          checked: completionConfirmed,
          onChange: (checked: boolean) => {
            setCompletionConfirmed(checked);
            if (checked) {
              posthog.capture('client_manual_completion_confirmed', {
                platform: config.platform,
              });
            }
          },
          requiredMessage: 'Confirm completion before continuing.',
        },
        primaryAction: {
          label: 'Return to request',
          loading: submitting,
          loadingLabel: config.completion.loadingLabel,
          onClick: submitManualConnection,
          disabled: completionDisabled,
          disabledReason:
            completionDisabled && config.completion.disabledReason
              ? config.completion.disabledReason(ctx)
              : undefined,
        },
      },
    ];
  }, [completionConfirmed, config, data, form, isFormValid, setFieldValue, submissionError, submitting]);

  const handleStepStateChange = useCallback(
    ({
      stepIndex,
      totalSteps,
      actionLabel,
      blockedReason,
    }: {
      stepIndex: number;
      totalSteps: number;
      actionLabel: string;
      blockedReason?: string;
    }) => {
      setRailState((previous) => {
        if (
          previous.stepIndex === stepIndex &&
          previous.totalSteps === totalSteps &&
          previous.label === actionLabel &&
          previous.blockedReason === blockedReason
        ) {
          return previous;
        }

        return {
          stepIndex,
          totalSteps,
          label: actionLabel,
          blockedReason,
        };
      });
    },
    []
  );

  if (!data) {
    return (
      <InviteLoadStateCard
        phase={phase === 'ready' ? 'loading' : phase}
        message={
          error ||
          (phase === 'timeout'
            ? config.timeoutMessage
            : 'This request link is invalid or expired. Contact your agency for a new link.')
        }
        onRetry={retry}
      />
    );
  }

  return (
    <InviteFlowShell
      title={data.agencyName}
      description={config.shellDescription}
      header={
        <ManualInviteHeader
          agencyName={data.agencyName}
          platformName={config.platformName}
          logoUrl={data.branding?.logoUrl}
          securityNote={config.headerSecurityNote}
          backAction={
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                router.push(buildClientInviteConnectViewUrl(token, config.platform) as any)
              }
              leftIcon={<ArrowLeft className="h-4 w-4" />}
            >
              Back
            </Button>
          }
        />
      }
>
      {railState.blockedReason ? (
        <p
          role="status"
          className="mb-4 flex items-start gap-2 border border-black bg-paper p-3 text-sm leading-6 text-danger-ink"
        >
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {railState.blockedReason}
        </p>
      ) : null}
      <ManualChecklistWizard
        platformName={config.platformName}
        steps={steps}
        onStepView={({ stepId, stepIndex, totalSteps }) => {
          posthog.capture('client_manual_step_viewed', {
            platform: config.platform,
            step_id: stepId,
            step_index: stepIndex,
            total_steps: totalSteps,
          });
        }}
        onStepAdvanced={({ fromStepId, toStepId, fromStepIndex, toStepIndex, totalSteps }) => {
          posthog.capture('client_manual_step_advanced', {
            platform: config.platform,
            from_step_id: fromStepId,
            to_step_id: toStepId,
            from_step_index: fromStepIndex,
            to_step_index: toStepIndex,
            total_steps: totalSteps,
          });
        }}
        onStepStateChange={handleStepStateChange}
      />
    </InviteFlowShell>
  );
}
