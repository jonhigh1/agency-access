import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';
import { themes as prismThemes } from 'prism-react-renderer';

const docsSiteUrl = process.env.DOCS_SITE_URL || 'https://docs.authhub.co';
const productSiteUrl =
  process.env.MARKETING_SITE_URL ||
  docsSiteUrl.replace('://docs.', '://');
const isPreviewDeployment = process.env.VERCEL_ENV === 'preview';

const config: Config = {
  title: 'AuthHub Help Center',
  tagline: 'Support docs for agency onboarding, client authorization, and secure access workflows.',
  favicon: 'img/favicon.svg',

  url: docsSiteUrl,
  baseUrl: '/',

  organizationName: 'jhigh1594',
  projectName: 'agency-access',

  onBrokenLinks: 'throw',
  onBrokenAnchors: 'throw',
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'throw',
      onBrokenMarkdownImages: 'throw',
    },
  },

  // Docusaurus 3.10: Faster (Rspack, SWC, Lightning CSS, worker-thread SSG)
  // is stable and the v4 flags turn it on by default. Opt in now so the v4
  // upgrade is a no-op and every push to main builds quickly.
  future: {
    v4: true,
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  customFields: {
    posthogKey: process.env.NEXT_PUBLIC_POSTHOG_KEY || '',
    posthogHost: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
    sendPosthogInDev: process.env.NEXT_PUBLIC_POSTHOG_SEND_IN_DEV || 'false',
    productSiteUrl,
  },

  presets: [
    [
      'classic',
      {
        docs: {
          path: 'docs',
          routeBasePath: '/',
          sidebarPath: './sidebars.ts',
          editUrl:
            'https://github.com/jonhigh1/agency-access/tree/main/apps/docs/',
          showLastUpdateAuthor: false,
          showLastUpdateTime: false,
        },
        blog: false,
        pages: false,
        theme: {
          customCss: './src/css/custom.css',
        },
        sitemap: {
          changefreq: 'weekly',
          priority: 0.6,
        },
      } satisfies Preset.Options,
    ],
  ],

  plugins: [
    // AI-readable docs: /llms.txt index, /llms-full.txt, and every page as
    // raw Markdown at /{path}.md. AuthHub ships an MCP endpoint and a CLI for
    // agents, so the agent and CLI guides must be readable by agents too.
    [
      '@writechoice/docusaurus-plugin-llms-txt',
      {
        description:
          'AuthHub help center: agency onboarding, client authorization, webhooks, the MCP agent endpoint, and the CLI.',
      },
    ],
    // "Copy page" as Markdown, plus open-in-ChatGPT/Claude actions.
    [
      'docusaurus-plugin-copy-page-button',
      {
        placement: 'article',
      },
    ],
  ],

  themes: [
    [
      require.resolve('@easyops-cn/docusaurus-search-local'),
      {
        hashed: true,
        indexBlog: false,
        docsRouteBasePath: '/',
        highlightSearchTermsOnTargetPage: true,
        explicitSearchResultPath: true,
      },
    ],
  ],

  themeConfig: {
    image: 'img/social-card.svg',
    colorMode: {
      defaultMode: 'light',
      disableSwitch: true,
      respectPrefersColorScheme: false,
    },
    metadata: isPreviewDeployment
      ? [
          { name: 'robots', content: 'noindex, nofollow' },
          { name: 'googlebot', content: 'noindex, nofollow' },
        ]
      : [],
    navbar: {
      title: 'AuthHub Help Center',
      hideOnScroll: false,
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'kbSidebar',
          position: 'left',
          label: 'Browse Docs',
        },
        {
          href: `${productSiteUrl}/blog`,
          label: 'Guides',
          position: 'left',
        },
        {
          href: `${productSiteUrl}/contact`,
          label: 'Contact Support',
          position: 'right',
          className: 'navbar__link--support',
        },
        {
          href: `${productSiteUrl}/sign-in`,
          label: 'Sign In',
          position: 'right',
          className: 'navbar__link--ghost',
        },
        {
          href: `${productSiteUrl}/pricing`,
          label: 'Get Started',
          position: 'right',
          className: 'navbar__link--primary',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Knowledge Base',
          items: [
            {
              label: 'Getting Started',
              to: '/getting-started/create-your-first-request',
            },
            {
              label: 'Troubleshooting',
              to: '/troubleshooting/common-client-blockers',
            },
            {
              label: 'Security',
              to: '/security-and-compliance/audit-logs-and-security',
            },
          ],
        },
        {
          title: 'Product',
          items: [
            {
              label: 'Pricing',
              href: `${productSiteUrl}/pricing`,
            },
            {
              label: 'Blog',
              href: `${productSiteUrl}/blog`,
            },
            {
              label: 'Contact',
              href: `${productSiteUrl}/contact`,
            },
          ],
        },
        {
          title: 'Legal',
          items: [
            {
              label: 'Privacy Policy',
              href: `${productSiteUrl}/privacy-policy`,
            },
            {
              label: 'Terms of Service',
              href: `${productSiteUrl}/terms`,
            },
          ],
        },
      ],
      copyright: `© ${new Date().getFullYear()} AuthHub. Customer-facing support documentation for agency onboarding.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'json'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
