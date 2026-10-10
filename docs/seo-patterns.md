# SEO Patterns & Standards

**Last Updated**: October 10, 2026
**Purpose**: Ensure consistent SEO implementation across all AuthHub pages

---

## Core Principles

1. **Canonical URL Strategy**: All pages use `https://authhub.co` (non-www)
2. **One H1 per page**: The first heading on every page must be `<h1>`
3. **Metadata completeness**: Every page needs title, description, canonical, and OpenGraph
4. **Structured data**: Use JSON-LD schema for content types (Article, HowTo, Organization)

## GitHub indexing leak

`apps/web/src/app/robots.ts` only governs **authhub.co**. It cannot noindex `github.com` blob or raw pages of this public repo. Do not add unpublished SEO drafts, competitive teardowns, or keyword-rich planning docs that should not rank. Published marketing pages must carry self-referencing `https://authhub.co` canonicals so Google can prefer the live site over GitHub copies of `apps/web/content/blog/*.md`.

Making the repository private is an ops decision, not a `robots.ts` fix.

**GSC ops (not code):** inspect `/compare/clientinvite-alternative`, `/guides/meta-ads-access`, and `/guides/google-ads-access`; request indexing if they are 200 with self-canonicals.

---

## Page Templates

### Marketing Pages (Homepage, Pricing, Features)

**Metadata Pattern**:
```typescript
export const metadata: Metadata = {
  title: 'Page Title | AuthHub',
  description: 'Compelling description for search snippets (150-160 chars)',
  alternates: {
    canonical: 'https://authhub.co/page-path',
  },
  openGraph: {
    title: 'Page Title | AuthHub',
    description: 'Same as meta description or slightly longer',
    type: 'website',
    url: 'https://authhub.co/page-path',
    images: ['/authhub.png'], // or page-specific OG image
  },
};
```

**H1 Pattern**:
- First visible heading must be `<h1>`
- Use `font-dela` for hero sections
- Include primary keyword naturally
- Keep under 70 characters when possible

**Example**:
```tsx
<h1 className="font-dela text-4xl sm:text-5xl md:text-6xl text-ink">
  Client Access in 5 Minutes
</h1>
```

---

### Blog Posts

**Metadata Pattern**:
```typescript
export async function generateMetadata({ params }): Promise<Metadata> {
  const post = getBlogPostBySlug((await params).slug);
  const canonicalUrl = `https://authhub.co/blog/${post.slug}`;

  return {
    title: post.metaTitle || post.title,
    description: post.metaDescription || post.excerpt,
    keywords: post.tags,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: 'article',
      publishedTime: post.publishedAt,
      authors: [post.author.name],
      url: canonicalUrl,
      images: [post.ogImage || '/authhub.png'],
    },
  };
}
```

**Structured Data (Required)**:
```tsx
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{
    __html: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": post.title,
      "description": post.excerpt,
      "author": {
        "@type": "Person",
        "name": post.author.name,
      },
      "datePublished": post.publishedAt,
      "dateModified": post.publishedAt,
    }),
  }}
/>
```

**H1 Pattern**:
- Blog post title as H1 in `BlogContent` component
- Category pages: `<h1>Category Name Posts</h1>`
- Blog index: `<h1>Agency Growth Resources</h1>`

---

### Platform Guides (Meta Ads, Google Ads, etc.)

**Metadata Pattern**:
```typescript
export const metadata: Metadata = {
  title: 'How to Get [Platform] Access for Agencies: Guide 2026',
  description: 'Quick answer + full guide in 150-160 characters',
  alternates: {
    canonical: 'https://authhub.co/guides/platform-access',
  },
  keywords: ['primary keyword', 'secondary keyword', 'variant'],
  openGraph: {
    title: 'How to Get [Platform] Access for Agencies: Guide 2026',
    description: 'Step-by-step guide...',
    type: 'article',
    url: 'https://authhub.co/guides/platform-access',
  },
};
```

**Structured Data (Required - HowTo Schema)**:
```tsx
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{
    __html: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "HowTo",
      "name": "How to Get [Platform] Access for Agencies",
      "description": "Step-by-step guide...",
      "step": [
        {
          "@type": "HowToStep",
          "name": "Step name",
          "text": "Step instructions",
        },
        // ... more steps
      ],
    }),
  }}
/>
```

**H1 Pattern**:
```tsx
<h1 className="font-dela text-3xl sm:text-4xl md:text-5xl text-ink">
  How to Get [Platform] Access for Agencies
</h1>
```

**Content Structure** (for featured snippets):
1. **Quick Answer** section - 2-3 sentence summary
2. **People Also Ask** - Expand on common questions
3. **Why Agencies Need This** - Context
4. **Step-by-Step** - Detailed instructions
5. **Common Problems** - Troubleshooting table
6. **Checklist** - Action items

---

### Legal Pages (Terms, Privacy)

**Metadata Pattern**:
```typescript
export const metadata: Metadata = {
  title: 'Page Name | AuthHub',
  description: 'Brief description of legal document',
  alternates: {
    canonical: 'https://authhub.co/page-path',
  },
};
```

**Note**: Legal pages typically don't need OpenGraph (rarely shared).

**H1 Pattern**:
```tsx
<h1 className="text-4xl font-bold tracking-tight text-foreground">
  Page Name
</h1>
```

---

## Metadata Field Reference

### Title Tags
- **Length**: 50-60 characters optimal
- **Format**: `Page Title | AuthHub` (or just `AuthHub - Tagline` for homepage)
- **Keywords**: Include primary keyword near the beginning

### Meta Descriptions
- **Length**: 150-160 characters
- **Content**: Compelling, includes value proposition, may include CTA
- **Format**: Complete sentences, not keyword lists

### Canonical URLs
- **Format**: Always `https://authhub.co/path` (no trailing slash on root, trailing slash on non-root is optional but be consistent)
- **Purpose**: Prevents duplicate content issues
- **Implementation**: Use `alternates.canonical` in metadata

### OpenGraph Tags
- **og:title**: Same as meta title or slightly longer
- **og:description**: Same as meta description
- **og:type**: `website` for pages, `article` for blog posts
- **og:url**: Full canonical URL
- **og:image**: 1200x630px recommended, absolute path or full URL

### Twitter Cards
- **card**: `summary_large_image` for most pages
- **images**: Same as OG image

---

## H1 Heading Rules

### DO ✅
- Use `<h1>` for the first heading on every page
- Include primary keyword naturally
- Keep under 70 characters when possible
- Use `font-dela` for marketing/hero sections
- Make it descriptive and user-focused

### DON'T ❌
- Use `<h1>` more than once per page
- Skip H1 and start with H2
- Use generic text like "Welcome" or "Introduction"
- Stuff keywords unnaturally

---

## Structured Data (JSON-LD)

### Article Schema (Blog Posts)
```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Post title",
  "description": "Post excerpt",
  "author": {
    "@type": "Person",
    "name": "Author name"
  },
  "datePublished": "2026-01-15",
  "dateModified": "2026-01-15",
  "image": "https://authhub.co/images/og-image.jpg"
}
```

### HowTo Schema (Platform Guides)
```json
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "How to Get Platform Access",
  "description": "Step-by-step guide...",
  "step": [
    {
      "@type": "HowToStep",
      "name": "Step 1",
      "text": "Instructions"
    }
  ]
}
```

### FAQ Schema (Optional)
```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Question text?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Answer text"
      }
    }
  ]
}
```

### Organization Schema (Root Layout - TODO)
```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "AuthHub",
  "url": "https://authhub.co",
  "logo": "https://authhub.co/authhub.png",
  "description": "Client access platform for marketing agencies",
  "sameAs": [
    "https://twitter.com/authhub",
    "https://linkedin.com/company/authhub"
  ]
}
```

---

## Common SEO Pitfalls to Avoid

1. **Duplicate content**: Always use canonical URLs
2. **Missing H1**: Every page needs one H1 tag
3. **Orphaned pages**: All pages should be in sitemap and internally linked
4. **Broken links**: Check internal links after page moves/deletions
5. **Slow images**: Optimize and compress all images, use WebP when possible
6. **Missing alt text**: Add descriptive alt text to all images
7. **Thin content**: Pages should have substantive content (300+ words for guides)
8. **Keyword cannibalization**: Don't target same keyword on multiple pages

---

## Content-Length Guidelines

| Page Type | Minimum Word Count | Target |
|-----------|-------------------|--------|
| Homepage | 200+ words | Hero + value props |
| Pricing | 300+ words | Plans + FAQ |
| Blog Post | 1,000+ words | Comprehensive guide |
| Platform Guide | 1,500+ words | Full walkthrough |
| Legal Pages | As needed | Complete coverage |

---

## File Organization

```
apps/web/src/app/
├── (marketing)/
│   ├── page.tsx                    # Homepage
│   ├── pricing/page.tsx            # Pricing
│   ├── blog/
│   │   ├── page.tsx                # Blog index
│   │   └── [slug]/page.tsx         # Blog posts
│   ├── guides/
│   │   ├── meta-ads-access/
│   │   └── google-ads-access/
│   ├── contact/page.tsx
│   ├── terms/page.tsx
│   └── privacy-policy/page.tsx
├── layout.tsx                      # Root layout
├── sitemap.ts                      # Dynamic sitemap
└── robots.ts                       # Robots.txt
```

---

## Deployment Checklist

Before deploying SEO changes:

- [ ] Run `npm run typecheck` - ensure no TypeScript errors
- [ ] Test sitemap: `https://authhub.co/sitemap.xml`
- [ ] Test robots.txt: `https://authhub.co/robots.txt`
- [ ] Verify canonical URLs in page source
- [ ] Check H1 tags on all pages
- [ ] Validate JSON-LD schema: [Google Rich Results Test](https://search.google.com/test/rich-results)
- [ ] Run Lighthouse audit (target 90+ score)
- [ ] Submit sitemap to Google Search Console
- [ ] Check for broken links with `npm run lint` or external tool

---

## Monitoring & Maintenance

**Weekly**:
- Check Google Search Console for coverage issues
- Monitor indexing status for new content

**Monthly**:
- Run Lighthouse audit
- Check for broken links
- Review organic search traffic in analytics

**Quarterly**:
- Audit top landing pages for SEO issues
- Update old blog posts with fresh content
- Review keyword rankings and adjust content strategy

---

## References

- [Next.js Metadata Documentation](https://nextjs.org/docs/app/building-your-application/optimizing/metadata)
- [Schema.org](https://schema.org/)
- [Google Search Central - SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)
- [Open Graph Protocol](https://ogp.me/)
- [Twitter Cards Documentation](https://developer.twitter.com/en/docs/twitter-for-websites/cards/overview/abouts-cards)
