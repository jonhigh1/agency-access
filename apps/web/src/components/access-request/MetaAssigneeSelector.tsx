'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useQuery } from '@tanstack/react-query';
import { getDefaultMetaAccessTasks, type MetaAccessConfig, type MetaAssignableRecipient } from '@agency-platform/shared';
import { authorizedApiFetch } from '@/lib/api/authorized-api-fetch';
import { Button } from '@/components/ui/button';
import { DEV_BYPASS_TOKEN, useAuthOrBypass } from '@/lib/dev-auth';

const PAGE_TASKS = [
  { id: 'MANAGE', label: 'Manage settings' },
  { id: 'CREATE_CONTENT', label: 'Create content' },
  { id: 'MODERATE', label: 'Moderate' },
  { id: 'ADVERTISE', label: 'Advertise' },
  { id: 'ANALYZE', label: 'View insights' },
  { id: 'MANAGE_LEADS', label: 'Manage Leads Access' },
] as const;
const AD_ACCOUNT_TASKS = [
  { id: 'MANAGE', label: 'Manage settings' },
  { id: 'ADVERTISE', label: 'Advertise' },
  { id: 'ANALYZE', label: 'View insights' },
] as const;
const DATASET_TASKS = [
  { id: 'AA_ANALYZE', label: 'Advanced analytics' },
  { id: 'ADVERTISE', label: 'Advertise' },
  { id: 'ANALYZE', label: 'View insights' },
  { id: 'EDIT', label: 'Edit settings' },
  { id: 'UPLOAD', label: 'Upload events' },
] as const;

export function MetaAssigneeSelector({
  agencyId,
  products,
  value,
  onChange,
}: {
  agencyId: string;
  products: string[];
  value: MetaAccessConfig;
  onChange: (config: MetaAccessConfig) => void;
}) {
  const clerkAuth = useAuth();
  const { getToken } = clerkAuth;
  const auth = useAuthOrBypass(clerkAuth);
  const appliedDefaults = useRef(false);
  const productKey = [...products].sort().join(',');
  const previousProductKey = useRef<string | null>(null);
  const previousDefaults = useRef({ pageTasks: [] as string[], adAccountTasks: [] as string[], datasetTasks: [] as string[] });
  const { data = [], isLoading, isFetching, error, refetch } = useQuery<MetaAssignableRecipient[]>({
    queryKey: ['meta-assignees', agencyId],
    queryFn: async () => (await authorizedApiFetch<{ data: MetaAssignableRecipient[] }>(
      `/agency-platforms/meta/assignees?agencyId=${encodeURIComponent(agencyId)}`,
      { getToken: async () => (await getToken()) ?? (auth.isDevelopmentBypass ? DEV_BYPASS_TOKEN : null) },
    )).data,
    enabled: Boolean(agencyId) && auth.isLoaded,
    retry: false,
  });

  useEffect(() => {
    const productsChanged = previousProductKey.current !== productKey;
    const taskDefaults = getDefaultMetaAccessTasks(products);
    const tasksStillDefault = value.pageTasks.length === 0 ||
      (previousProductKey.current !== null &&
        value.pageTasks.length === previousDefaults.current.pageTasks.length &&
        previousDefaults.current.pageTasks.every((task) => value.pageTasks.includes(task)));
    const accountTasksStillDefault = value.adAccountTasks.length === 0 ||
      (previousProductKey.current !== null &&
        value.adAccountTasks.length === previousDefaults.current.adAccountTasks.length &&
        previousDefaults.current.adAccountTasks.every((task) => value.adAccountTasks.includes(task)));
    const datasetTasks = value.datasetTasks || [];
    const datasetTasksStillDefault = datasetTasks.length === 0 ||
      (previousProductKey.current !== null &&
        datasetTasks.length === previousDefaults.current.datasetTasks.length &&
        previousDefaults.current.datasetTasks.every((task) => datasetTasks.includes(task)));
    const updateTasks = productsChanged && tasksStillDefault && accountTasksStillDefault && datasetTasksStillDefault;
    previousProductKey.current = productKey;
    previousDefaults.current = taskDefaults;

    const recipients = !appliedDefaults.current && data.length > 0 && value.recipients.length === 0
      ? [data.find((recipient) => recipient.type === 'human'), data.find((recipient) => recipient.type === 'system_user')]
          .filter((recipient): recipient is MetaAssignableRecipient => Boolean(recipient))
          .map(({ type, id, name }) => ({ type, id, name }))
      : value.recipients;
    if (recipients !== value.recipients) appliedDefaults.current = true;
    if (updateTasks || recipients !== value.recipients) {
      onChange({
        ...value,
        ...(updateTasks ? taskDefaults : {}),
        recipients,
      });
    }
  }, [data, onChange, productKey, products, value]);

  const toggleRecipient = (recipient: MetaAssignableRecipient) => {
    const selected = value.recipients.some(
      (item) => item.type === recipient.type && item.id === recipient.id
    );
    onChange({
      ...value,
      recipients: selected
        ? value.recipients.filter((item) => item.type !== recipient.type || item.id !== recipient.id)
        : [...value.recipients, { type: recipient.type, id: recipient.id, name: recipient.name }],
    });
  };

  const togglePageTask = (task: string) => {
    onChange({
      ...value,
      pageTasks: value.pageTasks.includes(task)
        ? value.pageTasks.filter((item) => item !== task)
        : [...value.pageTasks, task],
    });
  };

  const toggleAdAccountTask = (task: string) => {
    onChange({
      ...value,
      adAccountTasks: value.adAccountTasks.includes(task)
        ? value.adAccountTasks.filter((item) => item !== task)
        : [...value.adAccountTasks, task],
    });
  };

  const toggleDatasetTask = (task: string) => {
    const tasks = value.datasetTasks || [];
    onChange({
      ...value,
      datasetTasks: tasks.includes(task)
        ? tasks.filter((item) => item !== task)
        : [...tasks, task],
    });
  };

  const fullControl = PAGE_TASKS.every(({ id }) => value.pageTasks.includes(id)) &&
    AD_ACCOUNT_TASKS.every(({ id }) => value.adAccountTasks.includes(id)) &&
    (!products.includes('meta_ads') || DATASET_TASKS.every(({ id }) => (value.datasetTasks || []).includes(id)));
  const setFullControl = (enabled: boolean) => {
    const defaults = getDefaultMetaAccessTasks(products);
    onChange({
      ...value,
      ...(enabled
        ? {
            pageTasks: PAGE_TASKS.map(({ id }) => id),
            adAccountTasks: AD_ACCOUNT_TASKS.map(({ id }) => id),
            ...(products.includes('meta_ads') ? { datasetTasks: DATASET_TASKS.map(({ id }) => id) } : {}),
          }
        : defaults),
    });
  };

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading Meta people and system users…</p>;
  if (error) return (
    <div role="alert" className="flex items-center justify-between gap-4 text-sm text-danger-ink">
      <p>{error.message}</p>
      <Button type="button" variant="secondary" disabled={isFetching} onClick={() => void refetch()}>
        Retry
      </Button>
    </div>
  );

  const humans = data.filter((recipient) => recipient.type === 'human');
  const systemUsers = data.filter((recipient) => recipient.type === 'system_user');

  return (
    <section className="space-y-4 border border-black bg-paper p-4" aria-labelledby="meta-assignees-title">
      <div>
        <h3 id="meta-assignees-title" className="text-base font-semibold text-ink">Meta access recipients</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose the person who must use the client assets. A system user is optional for server automation.
        </p>
      </div>

      <RecipientGroup title="People" recipients={humans} selected={value.recipients} onToggle={toggleRecipient} />
      <RecipientGroup title="System users" recipients={systemUsers} selected={value.recipients} onToggle={toggleRecipient} />

      <label className="flex min-h-11 items-center gap-3 border border-black bg-card px-3 py-2 text-sm font-semibold text-ink">
        <input type="checkbox" checked={fullControl} onChange={(event) => setFullControl(event.target.checked)} className="h-5 w-5" />
        Full control for selected Meta assets
      </label>

      <fieldset>
        <legend className="text-sm font-semibold text-ink">Page tasks</legend>
        <p className="mt-1 text-xs text-muted-foreground">Recommended tasks follow the selected Meta products. Full control adds every task.</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {PAGE_TASKS.map((task) => (
            <label key={task.id} className="flex min-h-11 cursor-pointer items-center gap-3 border border-border bg-card px-3 py-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={value.pageTasks.includes(task.id)}
                onChange={() => togglePageTask(task.id)}
                className="h-5 w-5"
              />
              {task.label}
            </label>
          ))}
        </div>
      </fieldset>
      {products.some((product) => ['meta_ads', 'instagram'].includes(product)) ? (
        <fieldset>
          <legend className="text-sm font-semibold text-ink">Ad account tasks</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {AD_ACCOUNT_TASKS.map((task) => (
              <label key={task.id} className="flex min-h-11 cursor-pointer items-center gap-3 border border-border bg-card px-3 py-2 text-sm text-ink">
                <input type="checkbox" checked={value.adAccountTasks.includes(task.id)} onChange={() => toggleAdAccountTask(task.id)} className="h-5 w-5" />
                {task.label}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
      {products.includes('meta_ads') ? (
        <fieldset>
          <legend className="text-sm font-semibold text-ink">Pixel and Dataset tasks</legend>
          <p className="mt-1 text-xs text-muted-foreground">Meta verifies these tasks after the client assigns the Pixel or Dataset in Business Settings.</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {DATASET_TASKS.map((task) => (
              <label key={task.id} className="flex min-h-11 cursor-pointer items-center gap-3 border border-border bg-card px-3 py-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={(value.datasetTasks || []).includes(task.id)}
                  onChange={() => toggleDatasetTask(task.id)}
                  className="h-5 w-5"
                />
                {task.label}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
    </section>
  );
}

function RecipientGroup({
  title,
  recipients,
  selected,
  onToggle,
}: {
  title: string;
  recipients: MetaAssignableRecipient[];
  selected: MetaAccessConfig['recipients'];
  onToggle: (recipient: MetaAssignableRecipient) => void;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-ink">{title}</legend>
      <div className="mt-2 space-y-2">
        {recipients.length === 0 ? (
          <p className="text-sm text-muted-foreground">None available in the selected Business Portfolio.</p>
        ) : recipients.map((recipient) => (
          <label key={`${recipient.type}:${recipient.id}`} className="flex min-h-11 cursor-pointer items-center gap-3 border border-border bg-card px-3 py-2">
            <input
              type="checkbox"
              checked={selected.some((item) => item.type === recipient.type && item.id === recipient.id)}
              onChange={() => onToggle(recipient)}
              className="h-5 w-5"
            />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-ink">{recipient.name}</span>
              <span className="block truncate text-xs text-muted-foreground">{recipient.email || recipient.role || recipient.id}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
