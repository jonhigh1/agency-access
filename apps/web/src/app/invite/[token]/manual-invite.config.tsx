'use client';

import type { ComponentType, ReactNode } from 'react';
import { ExternalLink } from 'lucide-react';
import type { ClientAccessRequestPayload, Platform } from '@agency-platform/shared';
import { KitCopyButton } from '@/components/client-auth/kit/KitCopyButton';
import { BeehiivCopyButton } from '@/components/client-auth/beehiiv/BeehiivCopyButton';
import { CopyCode } from '@/components/client-auth/pinterest/CopyCode';
import type { ManualInviteConfig, ManualInviteFlowData } from '@/components/flow/manual-invite-flow';
import { renderManualFormFields } from '@/components/flow/manual-invite-flow';

// ---------------------------------------------------------------------------
// Data shapes
// ---------------------------------------------------------------------------

interface EmailManualData extends ManualInviteFlowData {
  agencyEmail: string;
}

interface PinterestManualData extends ManualInviteFlowData {
  businessId?: string;
}

interface ShopifyManualData extends ManualInviteFlowData {
  shopDomain?: string;
  collaboratorCode?: string;
}

// ---------------------------------------------------------------------------
// Content blocks shared by the manual invite steps
// ---------------------------------------------------------------------------

function copyEmailRow(email: string, copyButton: ReactNode): ReactNode {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Invite email</p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          readOnly
          value={email}
          className="flex-1 rounded-lg border border-border bg-paper px-3 py-2 text-sm font-mono text-ink"
        />
        {copyButton}
      </div>
    </div>
  );
}

function copyCodeRow(intro: ReactNode, value: string, label: string): ReactNode {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{intro}</p>
      <CopyCode value={value} label={label} />
    </div>
  );
}

function linkButtons(links: Array<{ href: string; label: string }>): ReactNode {
  return (
    <div className="flex flex-wrap gap-3">
      {links.map((link) => (
        <a
          key={link.href}
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/20"
        >
          {link.label}
          <ExternalLink className="h-4 w-4" />
        </a>
      ))}
    </div>
  );
}

function para(children: ReactNode): ReactNode {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

function bulletList(items: ReactNode[]): ReactNode {
  return (
    <div className="rounded-lg border border-border bg-muted/10 px-4 py-3">
      <ul className="list-disc space-y-2 pl-5 text-sm text-foreground">{items}</ul>
    </div>
  );
}

function stack(children: ReactNode): ReactNode {
  return <div className="space-y-3">{children}</div>;
}

// ---------------------------------------------------------------------------
// Kit / Klaviyo / Mailchimp — identical flow shape, different copy
// ---------------------------------------------------------------------------

interface EmailInviteSpec {
  platform: 'kit' | 'klaviyo' | 'mailchimp';
  platformName: string;
  targetKey: 'kit' | 'klaviyo' | 'mailchimp';
  copyButton: ComponentType<{ text: string }>;
  loginUrl: string;
  loginLabel: string;
  step2Title: string;
  step2Description: string;
  step2PrimaryLabel: string;
  step2Guidance: ReactNode;
  step3Title: string;
  step3Description: string;
  step3FirstBullet: string;
  step3LastBullet: string;
  failureMessage: string;
}

function buildEmailInviteConfig(spec: EmailInviteSpec): ManualInviteConfig<EmailManualData> {
  const { platform, platformName } = spec;

  return {
    platform,
    platformName,
    loaderSource: `manual-${platform}`,
    parseData: (payload: ClientAccessRequestPayload): EmailManualData => ({
      agencyName: payload.agencyName,
      clientName: payload.clientName,
      agencyEmail: payload.manualInviteTargets?.[spec.targetKey]?.agencyEmail ||
        'your agency contact email',
      clientEmail: payload.clientEmail,
      branding: payload.branding,
    }),
    timeoutMessage: `${platformName} setup took too long to load. Retry or contact support.`,
    shellDescription: `Connect ${platformName} by completing each checklist step.`,
    headerSecurityNote: `Use only ${platformName}-native invite screens. Never share credentials.`,
    railSecurityNote: `Use only ${platformName}-native invite screens. Never share credentials.`,
    objective: `Complete ${platformName} invite setup and return to your authorization request.`,
    identities: (ctx) => [{ label: `${platformName} invite email`, value: ctx.data.agencyEmail }],
    steps: [
      {
        id: 'copy-invite-email',
        title: 'Copy invite email',
        description: `Use this email when inviting your agency into ${platformName}.`,
        content: (ctx) => copyEmailRow(ctx.data.agencyEmail, <spec.copyButton text={ctx.data.agencyEmail} />),
        primaryLabel: 'I copied this',
      },
      {
        id: 'open-team-settings',
        title: spec.step2Title,
        description: spec.step2Description,
        content: stack(
          <>
            {linkButtons([{ href: spec.loginUrl, label: spec.loginLabel }])}
            {para(spec.step2Guidance)}
          </>
        ),
        primaryLabel: spec.step2PrimaryLabel,
      },
      {
        id: 'send-invite',
        title: spec.step3Title,
        description: spec.step3Description,
        content: (ctx) =>
          bulletList([
            spec.step3FirstBullet,
            <>
              Paste <span className="font-mono">{ctx.data.agencyEmail}</span>.
            </>,
            'Choose the role you want your agency to have.',
            spec.step3LastBullet,
          ]),
        primaryLabel: 'I sent the invite',
      },
    ],
    completion: {
      description: 'We will return you to the authorization request once confirmed.',
      pendingMessage: 'Confirm completion and continue back to the request flow.',
      gateLabel: (data) => `I invited ${data.agencyEmail} to my ${platformName} account`,
      loadingLabel: 'Connecting...',
    },
    submit: {
      failureMessage: spec.failureMessage,
      buildBody: (ctx) => ({
        agencyEmail: ctx.data.agencyEmail,
        clientEmail: ctx.data.clientEmail,
        platform,
      }),
    },
  };
}

export const kitManualConfig = buildEmailInviteConfig({
  platform: 'kit',
  platformName: 'Kit',
  targetKey: 'kit',
  copyButton: KitCopyButton,
  loginUrl: 'https://app.kit.com/login',
  loginLabel: 'Open Kit Login',
  step2Title: 'Open Kit team settings',
  step2Description: 'Sign in and navigate to Account Settings then Team.',
  step2PrimaryLabel: 'I opened team settings',
  step2Guidance: (
    <>
      From your account, go to <span className="font-medium text-foreground">Account Settings</span>{' '}
      then <span className="font-medium text-foreground">Team</span>.
    </>
  ),
  step3Title: 'Invite your agency in Kit',
  step3Description: 'Invite a team member and choose the appropriate role before sending.',
  step3FirstBullet: 'Select Invite a team member.',
  step3LastBullet: 'Send the invite email from Kit.',
  failureMessage: 'Failed to create Kit connection',
});

export const klaviyoManualConfig = buildEmailInviteConfig({
  platform: 'klaviyo',
  platformName: 'Klaviyo',
  targetKey: 'klaviyo',
  copyButton: KitCopyButton,
  loginUrl: 'https://www.klaviyo.com/login',
  loginLabel: 'Open Klaviyo Login',
  step2Title: 'Open Klaviyo team settings',
  step2Description: 'Sign in to Klaviyo and open your account settings so you can manage users.',
  step2PrimaryLabel: 'I opened settings',
  step2Guidance:
    'From your account settings, open your users or organization settings to invite a new team member.',
  step3Title: 'Invite your agency in Klaviyo',
  step3Description: 'Add a new user, paste the email below, assign the correct role, then send.',
  step3FirstBullet: 'Select the option to add or invite a new user.',
  step3LastBullet: 'Send the invitation from Klaviyo.',
  failureMessage: 'Failed to create Klaviyo connection',
});

export const mailchimpManualConfig = buildEmailInviteConfig({
  platform: 'mailchimp',
  platformName: 'Mailchimp',
  targetKey: 'mailchimp',
  copyButton: KitCopyButton,
  loginUrl: 'https://login.mailchimp.com/',
  loginLabel: 'Open Mailchimp Login',
  step2Title: 'Open Mailchimp team settings',
  step2Description: 'Sign in to Mailchimp and open the account team or user-management area.',
  step2PrimaryLabel: 'I opened settings',
  step2Guidance: 'From your account, open your user or team settings so you can invite a new user.',
  step3Title: 'Invite your agency in Mailchimp',
  step3Description:
    'Invite a new user, paste the email below, choose the appropriate role, then send.',
  step3FirstBullet: 'Select the option to invite a new user or team member.',
  step3LastBullet: 'Send the invitation from Mailchimp.',
  failureMessage: 'Failed to create Mailchimp connection',
});

// ---------------------------------------------------------------------------
// Beehiiv
// ---------------------------------------------------------------------------

export const beehiivManualConfig: ManualInviteConfig<EmailManualData> = {
  platform: 'beehiiv',
  platformName: 'Beehiiv',
  loaderSource: 'manual-beehiiv',
  parseData: (payload: ClientAccessRequestPayload): EmailManualData => ({
    agencyName: payload.agencyName,
    clientName: payload.clientName,
    agencyEmail: payload.manualInviteTargets?.beehiiv?.agencyEmail || 'your agency contact email',
    clientEmail: payload.clientEmail,
    branding: payload.branding,
  }),
  timeoutMessage: 'Beehiiv setup took too long to load. Retry or contact support.',
  shellDescription: 'Connect Beehiiv by completing each checklist step.',
  headerSecurityNote: 'Use only Beehiiv-native invite screens. Never share credentials.',
  railSecurityNote: 'Use only Beehiiv-native invite screens. Never share credentials.',
  objective: 'Complete Beehiiv invite setup and return to your authorization request.',
  identities: (ctx) => [{ label: 'Beehiiv invite email', value: ctx.data.agencyEmail }],
  steps: [
    {
      id: 'copy-invite-email',
      title: 'Copy invite email',
      description: 'Use this email when adding your agency as a Beehiiv teammate.',
      content: (ctx) =>
        copyEmailRow(ctx.data.agencyEmail, <BeehiivCopyButton text={ctx.data.agencyEmail} />),
      primaryLabel: 'I copied this',
    },
    {
      id: 'open-team-settings',
      title: 'Open Beehiiv team settings',
      description: 'Sign in to Beehiiv and open your workspace team settings.',
      content: linkButtons([
        { href: 'https://app.beehiiv.com/login', label: 'Open Beehiiv Login' },
        { href: 'https://app.beehiiv.com/settings/workspace/team', label: 'Open Team Settings' },
      ]),
      primaryLabel: 'I opened settings',
    },
    {
      id: 'send-invite',
      title: 'Invite your agency in Beehiiv',
      description: 'Select Invite New User, paste the email, choose access, then send.',
      content: (ctx) =>
        bulletList([
          'Click Invite New User in the team screen.',
          <>
            Paste <span className="font-mono">{ctx.data.agencyEmail}</span>.
          </>,
          'Choose workspace or publication access and assign role.',
          'Send the email invite from Beehiiv.',
        ]),
      primaryLabel: 'I sent the invite',
    },
  ],
  completion: {
    description: 'Once confirmed, we will mark Beehiiv as completed for this request.',
    pendingMessage: 'Confirm this invite is complete, then continue back to the request flow.',
    gateLabel: (data) => `I invited ${data.agencyEmail} to my Beehiiv workspace`,
    loadingLabel: 'Connecting...',
  },
  submit: {
    failureMessage: 'Failed to create Beehiiv connection',
    buildBody: (ctx) => ({
      agencyEmail: ctx.data.agencyEmail,
      clientEmail: ctx.data.clientEmail,
      platform: 'beehiiv',
    }),
  },
};

// ---------------------------------------------------------------------------
// Pinterest
// ---------------------------------------------------------------------------

export const pinterestManualConfig: ManualInviteConfig<PinterestManualData> = {
  platform: 'pinterest',
  platformName: 'Pinterest',
  loaderSource: 'manual-pinterest',
  parseData: (payload: ClientAccessRequestPayload): PinterestManualData => ({
    agencyName: payload.agencyName,
    clientName: payload.clientName,
    businessId: payload.manualInviteTargets?.pinterest?.businessId,
    clientEmail: payload.clientEmail,
    branding: payload.branding,
  }),
  timeoutMessage: 'Pinterest setup took too long to load. Retry or contact support.',
  shellDescription: 'Connect Pinterest by completing each checklist step.',
  headerSecurityNote: 'Use only Pinterest-native invite screens. Never share credentials.',
  railSecurityNote: 'Use only Pinterest Business Manager and never share credentials.',
  objective: 'Complete Pinterest partner setup and return to your authorization request.',
  identities: (ctx) => [
    {
      label: 'Pinterest Business ID',
      value: ctx.data.businessId || 'Missing - contact your agency',
    },
  ],
  steps: [
    {
      id: 'open-business-manager',
      title: 'Open Pinterest Business Manager',
      description: 'Sign in to Pinterest Business and open your business manager account.',
      content: linkButtons([
        {
          href: 'https://www.pinterest.com/business/business-manager/',
          label: 'Open Business Manager',
        },
      ]),
      primaryLabel: 'I opened Pinterest',
    },
    {
      id: 'add-partner',
      title: 'Add your agency as partner',
      description: 'Open Partners in the sidebar and add a new partner by business ID.',
      content: (ctx) =>
        ctx.data.businessId
          ? copyCodeRow(
              'Use this business ID in the Add Partner modal.',
              ctx.data.businessId,
              'Agency Business ID'
            )
          : (
              <div className="rounded-lg border border-coral/30 bg-coral/10 px-3 py-3 text-sm text-danger-ink">
                Pinterest Business ID is missing. Contact your agency before continuing.
              </div>
            ),
      primaryLabel: (ctx) => (ctx.data.businessId ? 'I added the partner' : 'Business ID required'),
      disabled: (ctx) => !ctx.data.businessId,
      disabledReason: (ctx) =>
        ctx.data.businessId
          ? undefined
          : 'Business ID is required before this step can continue.',
    },
    {
      id: 'assign-permissions',
      title: 'Assign permissions',
      description: 'Grant Admin permissions to the selected ad account and save.',
      content: bulletList([
        'Select the ad account to share.',
        'Set partner permissions to Admin.',
        'Click Assign Permissions in Pinterest.',
      ]),
      primaryLabel: 'I assigned permissions',
    },
  ],
  completion: {
    description: 'Confirm completion and return to the authorization request.',
    pendingMessage: 'Confirm completion to finalize Pinterest setup for this request.',
    gateLabel: 'I completed Pinterest partner setup and permissions',
    loadingLabel: 'Connecting...',
    disabled: (ctx) => !ctx.data.businessId,
    disabledReason: (ctx) =>
      ctx.data.businessId ? undefined : 'Business ID is required before finalizing Pinterest.',
  },
  submit: {
    failureMessage: 'Failed to connect Pinterest',
    buildBody: (ctx) => ({
      platform: 'pinterest',
      businessId: ctx.data.businessId,
      clientEmail: ctx.data.clientEmail,
    }),
    canSubmit: (ctx) => Boolean(ctx.data.businessId),
  },
};

// ---------------------------------------------------------------------------
// Shopify
// ---------------------------------------------------------------------------

function normalizeShopDomain(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '');
}

function isValidShopDomain(value: string): boolean {
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(value);
}

function isValidCollaboratorCode(value: string): boolean {
  return /^\d{4}$/.test(value.trim());
}

const shopifyFormFields = [
  {
    name: 'shopDomain',
    label: 'Shop domain',
    placeholder: 'your-store.myshopify.com',
    isValid: (value: string) => isValidShopDomain(normalizeShopDomain(value)),
    invalidMessage: (
      <>
        Use a valid domain like <span className="font-mono">store-name.myshopify.com</span>.
      </>
    ),
  },
  {
    name: 'collaboratorCode',
    label: 'Collaborator code',
    placeholder: '1234',
    mono: true,
    inputMode: 'numeric' as const,
    sanitize: (value: string) => value.replace(/\D/g, '').slice(0, 4),
    isValid: (value: string) => isValidCollaboratorCode(value),
    invalidMessage: 'Collaborator code must be exactly 4 digits.',
  },
];

export const shopifyManualConfig: ManualInviteConfig<ShopifyManualData> = {
  platform: 'shopify',
  platformName: 'Shopify',
  loaderSource: 'manual-shopify',
  parseData: (payload: ClientAccessRequestPayload): ShopifyManualData => ({
    agencyName: payload.agencyName,
    clientName: payload.clientName,
    clientEmail: payload.clientEmail,
    shopDomain: payload.manualInviteTargets?.shopify?.shopDomain,
    collaboratorCode: payload.manualInviteTargets?.shopify?.collaboratorCode,
    branding: payload.branding,
  }),
  timeoutMessage: 'Shopify setup took too long to load. Retry or contact support.',
  shellDescription: 'Connect Shopify in 3 steps: Connect Shopify, Select Store, Connected.',
  headerSecurityNote: 'Use only Shopify-native collaborator screens. Never share credentials.',
  railSecurityNote:
    'Use only Shopify-native collaborator access screens. Never share passwords.',
  objective: 'Share Shopify collaborator details so your agency can request access.',
  identities: (ctx) => [
    {
      label: 'Shopify store',
      value: normalizeShopDomain(ctx.form.shopDomain || '') || 'Not provided yet',
    },
    {
      label: 'Collaborator code',
      value: (ctx.form.collaboratorCode || '').trim() || 'Not provided yet',
    },
  ],
  progress: { stepTitles: ['Connect Shopify', 'Select Store', 'Connected'] },
  fields: shopifyFormFields,
  prefill: (data) => ({
    shopDomain: data.shopDomain || '',
    collaboratorCode: data.collaboratorCode || '',
  }),
  steps: [
    {
      id: 'connect-shopify',
      title: 'Connect Shopify',
      description: 'Open Shopify admin and navigate to Users and permissions.',
      content: linkButtons([
        { href: 'https://admin.shopify.com/store', label: 'Open Shopify Admin' },
        {
          href: 'https://help.shopify.com/en/manual/your-account/users/security/collaborator-accounts',
          label: 'Open Shopify Help',
        },
      ]),
      primaryLabel: 'Connect Shopify',
    },
    {
      id: 'select-store',
      title: 'Select Store',
      description: 'Enter your store domain and 4-digit collaborator request code.',
      content: (ctx) => renderManualFormFields(ctx, shopifyFormFields),
      primaryLabel: (ctx) => (ctx.isFormValid ? 'Select Store' : 'Details required'),
      disabled: (ctx) => !ctx.isFormValid,
      disabledReason: (ctx) =>
        ctx.isFormValid
          ? undefined
          : 'A valid shop domain and 4-digit collaborator code are required.',
    },
  ],
  completion: {
    id: 'connected',
    title: 'Connected',
    description: 'Confirm completion and return to your authorization request.',
    pendingMessage: 'We will mark Shopify as complete once you confirm and continue.',
    gateLabel: 'I have shared my shop domain and collaborator code with the agency',
    loadingLabel: 'Saving...',
    renderSummary: (ctx) =>
      bulletList([
        <>
          Shop domain: <span className="font-mono">{normalizeShopDomain(ctx.form.shopDomain || '')}</span>.
        </>,
        <>
          Collaborator code: <span className="font-mono">{(ctx.form.collaboratorCode || '').trim()}</span>.
        </>,
        'Your agency sends the collaborator access request from Shopify Partners.',
      ]),
    disabled: (ctx) => !ctx.isFormValid,
    disabledReason: () => 'A valid shop domain and 4-digit collaborator code are required.',
  },
  submit: {
    failureMessage: 'Failed to save Shopify collaborator details',
    buildBody: (ctx) => ({
      platform: 'shopify',
      shopDomain: normalizeShopDomain(ctx.form.shopDomain || ''),
      collaboratorCode: (ctx.form.collaboratorCode || '').trim(),
      clientEmail: ctx.data.clientEmail,
    }),
    canSubmit: (ctx) => ctx.isFormValid,
  },
};
