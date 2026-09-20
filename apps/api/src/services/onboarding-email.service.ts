import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';
import { enqueueJob } from '@/lib/pg-boss';
import { sendEmail } from '@/services/email.service';

type OnboardingEmailKey =
  | 'welcome_first_step'
  | 'get_to_first_link'
  | 'send_the_link'
  | 'track_status_keep_momentum'
  | 'turn_one_request_into_workflow'
  | 'still_waiting_day14'
  | 'one_client_day30'
  | 'closing_the_loop_day60';

const DAY_MS = 24 * 60 * 60 * 1000;
const EMAIL_DELAYS: Record<Exclude<OnboardingEmailKey, 'send_the_link'>, number> = {
  welcome_first_step: 0,
  get_to_first_link: DAY_MS,
  track_status_keep_momentum: 3 * DAY_MS,
  turn_one_request_into_workflow: 7 * DAY_MS,
  still_waiting_day14: 14 * DAY_MS,
  one_client_day30: 30 * DAY_MS,
  closing_the_loop_day60: 60 * DAY_MS,
};

function getOnboardingUrl(): string {
  return `${env.FRONTEND_URL}/onboarding/unified`;
}

function getDashboardUrl(): string {
  return `${env.FRONTEND_URL}/dashboard`;
}

function getAuthorizeUrl(uniqueToken: string): string {
  return `${env.FRONTEND_URL}/authorize/${uniqueToken}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function textToHtml(text: string): string {
  const blocks = text.trim().split(/\n{2,}/);
  const htmlBlocks = blocks.map((block) => {
    const trimmed = block.trim();
    if (!trimmed) return '';

    const lines = trimmed.split('\n').map((line) => escapeHtml(line).replace(
      /(https?:\/\/[^\s<]+)/g,
      '<a href="$1">$1</a>'
    ));

    return `<p style="margin: 0 0 16px; line-height: 1.6; white-space: pre-wrap;">${lines.join('<br />')}</p>`;
  });

  return `
    <div style="font-family: Inter, Arial, sans-serif; color: #111827; max-width: 640px; margin: 0 auto; padding: 24px;">
      ${htmlBlocks.join('')}
    </div>
  `;
}

async function hasAlreadySentEmail(agencyId: string, emailKey: OnboardingEmailKey): Promise<boolean> {
  const existing = await prisma.auditLog.findFirst({
    where: {
      agencyId,
      action: 'ONBOARDING_EMAIL_SENT',
      resourceType: 'onboarding_email',
      resourceId: `${agencyId}:${emailKey}`,
    },
  });

  return Boolean(existing);
}

async function logEmailSent(agencyId: string, emailKey: OnboardingEmailKey, subject: string) {
  await prisma.auditLog.create({
    data: {
      agencyId,
      userEmail: 'system',
      action: 'ONBOARDING_EMAIL_SENT',
      resourceType: 'onboarding_email',
      resourceId: `${agencyId}:${emailKey}`,
      metadata: {
        emailKey,
        subject,
      },
    },
  });
}

function buildWelcomeEmail(agencyName: string) {
  const subject = 'Your client access flow starts here';
  const text = `Hi there,

You signed up for one reason: get client access without the usual week of back-and-forth.

${agencyName} now has the shortest path to that outcome: one secure link your client can use to authorize the platforms you need.

Your fastest path to value:
1. Add your agency details
2. Choose a client
3. Select the platforms you need
4. Generate your access link

The goal is not to set up everything. The goal is to get your first real request live.

Start here:
${getOnboardingUrl()}

If you want a quick recommendation, reply with the first client you plan to onboard and the platforms you need.

- The AuthHub team`;

  return { subject, text };
}

function buildFirstLinkReminderEmail() {
  const subject = 'Your first access link is still waiting';
  const text = `Hi there,

If you have not created your first access link yet, that is the only step that matters right now.

Pick one real client. Create one real request. Send one real link.

That gets you to value fast:
1. Pick the client you want to onboard first
2. Choose the platforms they need to authorize
3. Generate the link
4. Send it

Create your first request here:
${getOnboardingUrl()}

If you hit a blocker, reply with the step where you got stuck.

- The AuthHub team`;

  return { subject, text };
}

function buildSendTheLinkEmail(clientName: string, accessRequestUrl: string) {
  const subject = 'Your access link is ready to send';
  const text = `Hi there,

Your first access link is ready.

Next move: send it to ${clientName}.

Once they open it:
1. They authorize each requested platform
2. You track status from your dashboard
3. You move the work forward without another email thread

If you want a clean note to forward, use this:

Hi ${clientName},

Please use this secure link to grant us access to the platforms we need. It should take a few minutes:
${accessRequestUrl}

Once you finish, we will be able to get started faster.

Open your request here:
${accessRequestUrl}

- The AuthHub team`;

  return { subject, text };
}

function buildMomentumEmail(hasRequest: boolean) {
  if (!hasRequest) {
    return {
      subject: 'Need help getting your first request live?',
      text: `Hi there,

If you have not launched your first request yet, pick one client and create one link.

That is the moment where the product starts paying off. Everything else can wait.

Start here:
${getOnboardingUrl()}

If you want help choosing which platforms to include, reply to this email and we will point you in the right direction.

- The AuthHub team`,
    };
  }

  return {
    subject: 'Check your request status',
    text: `Hi there,

Once your first request is in motion, the dashboard matters more than your inbox.

Use it to:
- see which requests are pending
- confirm when a client has authorized access
- create the next request without starting from scratch

Open your dashboard here:
${getDashboardUrl()}

If your client has not completed the request yet, this is the right moment for a short follow-up.

- The AuthHub team`,
  };
}

function buildWorkflowEmail() {
  const subject = 'Turn this into your standard onboarding flow';
  const text = `Hi there,

One completed request is useful.

What matters next is turning that one request into a repeatable onboarding workflow for your agency.

From your dashboard, you can:
- create requests for new clients faster
- track every authorization in one place
- invite teammates so access setup does not live with one person
- add your branding for a cleaner client experience

Go back to your dashboard here:
${getDashboardUrl()}

If you are still testing, run one more real client through the flow. That is usually when the time savings become obvious.

- The AuthHub team`;

  return { subject, text };
}

const CHURN_OPTOUT_ACTION = 'CHURN_OPTOUT';

async function hasChurnOptOut(agencyId: string): Promise<boolean> {
  const existing = await prisma.auditLog.findFirst({
    where: {
      agencyId,
      action: CHURN_OPTOUT_ACTION,
      resourceType: 'onboarding_email',
    },
  });

  return Boolean(existing);
}

async function logChurnOptOut(agencyId: string) {
  await prisma.auditLog.create({
    data: {
      agencyId,
      userEmail: 'system',
      action: CHURN_OPTOUT_ACTION,
      resourceType: 'onboarding_email',
      resourceId: `${agencyId}:churn_optout`,
      metadata: {
        source: 'one_client_day30_optout',
      },
    },
  });
}

export async function recordChurnOptOut(input: { agencyId: string }) {
  try {
    await logChurnOptOut(input.agencyId);
    return { data: true, error: null };
  } catch (error: any) {
    return {
      data: null,
      error: {
        code: 'CHURN_OPTOUT_FAILED',
        message: 'Failed to record churn opt-out',
      },
    };
  }
}

function buildStillWaitingDay14Email() {
  const subject = 'The part where most agencies get stuck';
  const text = `Hi there,

Two weeks ago you signed up to kill the access-handoff email loop. Still nothing set up. That is normal, and it is almost never the product that stopped you.

It is picking which client goes first.

So here is the shortcut: pick the next client you are already chasing for access. Not the biggest one. The one where the back-and-forth is actively annoying you this week.

That client already needs to give you access. AuthHub just turns three days of email into one link.

Create that request here:
${getOnboardingUrl()}

If it is something else blocking you, reply with one sentence about what it is. We read every reply.

- The AuthHub team`;

  return { subject, text };
}

function buildOneClientDay30Email() {
  const subject = 'Five minutes, one client, done';
  const text = `Hi there,

One month in, so this is the short version.

Setting up AuthHub takes about five minutes: pick a client, choose their platforms, generate the link. The link does the rest — your client authorizes Meta, Google, GA4, or LinkedIn without a single email thread.

If you have a client waiting on access right now, this is your moment:

Create the link here:
${getOnboardingUrl()}

And if AuthHub turned out to be not for you, that is fine too. Reply with the word "pass" and we will stop emailing. No hard feelings. Marcus had whole chapters on letting go.

- The AuthHub team`;

  return { subject, text };
}

function buildClosingTheLoopDay60Email() {
  const subject = 'Before we stop emailing you';
  const text = `Hi there,

This is the last email in this sequence. After this, we go quiet unless you reach out first.

Before that, one honest question:

What would have made you set up your first access link in those first days?

Reply with one sentence. If the answer is something we can fix, you will have made the product better for every agency after you. If the answer means we are not for you, that is useful too.

The door stays open. Your account is live whenever a client handoff gets painful again:

${getDashboardUrl()}

— The AuthHub team`;

  return { subject, text };
}

export async function queueSequenceStart(input: { agencyId: string }) {
  try {
    const jobs = Object.entries(EMAIL_DELAYS) as Array<[Exclude<OnboardingEmailKey, 'send_the_link'>, number]>;

    for (const [emailKey, delay] of jobs) {
      await enqueueJob(
        'onboarding-email',
        {
          agencyId: input.agencyId,
          emailKey,
        },
        {
          singletonKey: `onboarding-email:${input.agencyId}:${emailKey}`,
          startAfter: delay / 1000, // Convert ms to seconds
          retryLimit: 3,
          retryDelay: 2,
          retryBackoff: true,
        }
      );
    }

    return { data: true, error: null };
  } catch (error: any) {
    return {
      data: null,
      error: {
        code: 'ONBOARDING_EMAIL_QUEUE_FAILED',
        message: 'Failed to queue onboarding email sequence',
      },
    };
  }
}

export async function queueActivatedFollowUp(input: { agencyId: string; accessRequestId: string }) {
  try {
    await enqueueJob(
      'onboarding-email',
      {
        agencyId: input.agencyId,
        accessRequestId: input.accessRequestId,
        emailKey: 'send_the_link' as const,
      },
      {
        singletonKey: `onboarding-email:${input.agencyId}:send_the_link:${input.accessRequestId}`,
        startAfter: DAY_MS / 1000, // Convert ms to seconds
        retryLimit: 3,
        retryDelay: 2,
        retryBackoff: true,
      }
    );

    return { data: true, error: null };
  } catch (error: any) {
    return {
      data: null,
      error: {
        code: 'ONBOARDING_EMAIL_QUEUE_FAILED',
        message: 'Failed to queue onboarding activation follow-up',
      },
    };
  }
}

export async function sendOnboardingEmail(input: {
  agencyId: string;
  emailKey: OnboardingEmailKey;
  accessRequestId?: string;
}) {
  const { agencyId, emailKey, accessRequestId } = input;

  if (await hasAlreadySentEmail(agencyId, emailKey)) {
    return { data: { skipped: true, reason: 'already_sent' }, error: null };
  }

  const agency = await prisma.agency.findUnique({
    where: { id: agencyId },
    select: {
      id: true,
      name: true,
      email: true,
      settings: true,
      accessRequests: {
        select: {
          id: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      },
    },
  });

  if (!agency) {
    return {
      data: null,
      error: {
        code: 'AGENCY_NOT_FOUND',
        message: 'Agency not found',
      },
    };
  }

  let message: { subject: string; text: string } | null = null;

  if (emailKey === 'welcome_first_step') {
    message = buildWelcomeEmail(agency.name);
  }

  if (emailKey === 'get_to_first_link') {
    if (agency.accessRequests.length > 0) {
      return { data: { skipped: true, reason: 'already_activated' }, error: null };
    }
    message = buildFirstLinkReminderEmail();
  }

  if (emailKey === 'send_the_link') {
    const accessRequest = await prisma.accessRequest.findUnique({
      where: { id: accessRequestId },
      select: {
        id: true,
        status: true,
        clientName: true,
        uniqueToken: true,
      },
    });

    if (!accessRequest) {
      return { data: { skipped: true, reason: 'missing_access_request' }, error: null };
    }

    if (accessRequest.status === 'completed') {
      return { data: { skipped: true, reason: 'already_completed' }, error: null };
    }

    message = buildSendTheLinkEmail(accessRequest.clientName, getAuthorizeUrl(accessRequest.uniqueToken));
  }

  if (emailKey === 'track_status_keep_momentum') {
    const latestRequest = await prisma.accessRequest.findFirst({
      where: { agencyId },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });

    message = buildMomentumEmail(Boolean(latestRequest));
  }

  if (emailKey === 'turn_one_request_into_workflow') {
    if (agency.accessRequests.length === 0) {
      return { data: { skipped: true, reason: 'not_activated' }, error: null };
    }
    message = buildWorkflowEmail();
  }

  if (emailKey === 'still_waiting_day14') {
    if (agency.accessRequests.length > 0) {
      return { data: { skipped: true, reason: 'already_activated' }, error: null };
    }
    if (await hasChurnOptOut(agencyId)) {
      return { data: { skipped: true, reason: 'churn_optout' }, error: null };
    }
    message = buildStillWaitingDay14Email();
  }

  if (emailKey === 'one_client_day30') {
    if (agency.accessRequests.length > 0) {
      return { data: { skipped: true, reason: 'already_activated' }, error: null };
    }
    if (await hasChurnOptOut(agencyId)) {
      return { data: { skipped: true, reason: 'churn_optout' }, error: null };
    }
    message = buildOneClientDay30Email();
  }

  if (emailKey === 'closing_the_loop_day60') {
    if (agency.accessRequests.length > 0) {
      return { data: { skipped: true, reason: 'already_activated' }, error: null };
    }
    if (await hasChurnOptOut(agencyId)) {
      return { data: { skipped: true, reason: 'churn_optout' }, error: null };
    }
    message = buildClosingTheLoopDay60Email();
  }

  if (!message) {
    return {
      data: null,
      error: {
        code: 'UNKNOWN_ONBOARDING_EMAIL',
        message: `Unknown onboarding email key: ${emailKey}`,
      },
    };
  }

  const result = await sendEmail({
    to: agency.email,
    subject: message.subject,
    text: message.text,
    html: textToHtml(message.text),
  });

  if (result.error) {
    return result;
  }

  await logEmailSent(agencyId, emailKey, message.subject);

  return {
    data: {
      sent: true,
      emailKey,
    },
    error: null,
  };
}

export const onboardingEmailService = {
  queueSequenceStart,
  queueActivatedFollowUp,
  sendOnboardingEmail,
  recordChurnOptOut,
};
