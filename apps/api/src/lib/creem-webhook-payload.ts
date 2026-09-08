export type CreemNormalizedEvent = {
  id: string;
  type: string;
  data: Record<string, unknown>;
};

export type CreemSubscriptionPayload = {
  id: string;
  status: 'active' | 'past_due' | 'canceled' | 'trialing';
  customer_id: string;
  /** Normalized Creem product id (from product.id, price_id, etc.). */
  price_id: string;
  current_period_start: string;
  current_period_end: string;
  trial_end?: string;
};

function readId(value: unknown): string | null {
  if (typeof value === 'string' && value.length > 0) return value;
  if (value && typeof value === 'object' && typeof (value as { id?: unknown }).id === 'string') {
    return (value as { id: string }).id;
  }
  return null;
}

/** Map Creem dashboard payloads (`eventType`, top-level `object`) to AuthHub shape. */
export function normalizeCreemEvent(raw: Record<string, unknown>): CreemNormalizedEvent {
  const type = String(raw.type ?? raw.eventType ?? '');
  const data = (raw.data ?? raw.object ?? {}) as Record<string, unknown>;
  return {
    id: String(raw.id ?? ''),
    type,
    data,
  };
}

/** Extract product id from product.id, product string, price_id, items, or order.product. */
export function extractCreemProductId(source: Record<string, unknown>): string | null {
  const candidates: unknown[] = [
    source.price_id,
    source.product_id,
    source.product,
    (source.product as { id?: string } | undefined)?.id,
    (source.items as Array<{ product?: unknown }> | undefined)?.[0]?.product,
    (
      (source.items as Array<{ product?: { id?: string } }> | undefined)?.[0]?.product as
        | { id?: string }
        | undefined
    )?.id,
    (source.order as { product?: unknown } | undefined)?.product,
  ];

  for (const candidate of candidates) {
    const id = readId(candidate);
    if (id) return id;
  }

  return null;
}

/** Extract customer id from customer_id, customer string, or customer.id. */
export function extractCreemCustomerId(source: Record<string, unknown>): string | null {
  return readId(source.customer_id) ?? readId(source.customer);
}

/** Extract subscription id from subscription object id or nested subscription on checkout. */
export function extractCreemSubscriptionId(
  eventType: string,
  source: Record<string, unknown>
): string | null {
  if (source.object === 'subscription' || eventType.startsWith('subscription.')) {
    return readId(source.id);
  }

  if (eventType === 'checkout.completed') {
    return (
      readId(source.subscription) ??
      readId((source.subscription as { id?: string } | undefined)?.id)
    );
  }

  return (
    readId(source.subscription) ??
    readId((source.subscription as { id?: string } | undefined)?.id) ??
    readId(source.id)
  );
}

function readPeriodDate(source: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return new Date().toISOString();
}

function resolveSubscriptionRoot(
  eventType: string,
  data: Record<string, unknown>
): Record<string, unknown> | null {
  if (data.object === 'checkout') {
    const nested = data.subscription;
    if (!nested || typeof nested !== 'object') return null;

    const subscription = nested as Record<string, unknown>;
    return {
      ...subscription,
      product:
        subscription.product ??
        data.product ??
        (data.order as { product?: unknown } | undefined)?.product,
      customer:
        subscription.customer ??
        data.customer ??
        (data.order as { customer?: unknown } | undefined)?.customer,
    };
  }

  if (data.subscription && typeof data.subscription === 'object') {
    const subscription = data.subscription as Record<string, unknown>;
    return {
      ...subscription,
      product: subscription.product ?? data.product,
      customer: subscription.customer ?? data.customer,
    };
  }

  if (data.object === 'subscription' || eventType.startsWith('subscription.')) {
    return data;
  }

  return data;
}

const SUBSCRIPTION_STATUSES = new Set(['active', 'past_due', 'canceled', 'trialing']);

export function getSubscriptionPayload(payload: CreemNormalizedEvent): CreemSubscriptionPayload | null {
  const root = resolveSubscriptionRoot(payload.type, payload.data);
  if (!root) return null;

  const subscriptionId =
    extractCreemSubscriptionId(payload.type, root) ??
    extractCreemSubscriptionId(payload.type, payload.data);
  const customerId = extractCreemCustomerId(root) ?? extractCreemCustomerId(payload.data);
  const productId = extractCreemProductId(root) ?? extractCreemProductId(payload.data);

  if (!subscriptionId || !customerId || !productId) return null;

  const rawStatus = typeof root.status === 'string' ? root.status : 'active';
  const status = SUBSCRIPTION_STATUSES.has(rawStatus)
    ? (rawStatus as CreemSubscriptionPayload['status'])
    : 'active';

  const trialEnd =
    readId(root.trial_end) ?? readId(root.trial_end_date) ?? undefined;

  return {
    id: subscriptionId,
    status,
    customer_id: customerId,
    price_id: productId,
    current_period_start: readPeriodDate(
      root,
      'current_period_start',
      'current_period_start_date'
    ),
    current_period_end: readPeriodDate(root, 'current_period_end', 'current_period_end_date'),
    trial_end: trialEnd ?? undefined,
  };
}
