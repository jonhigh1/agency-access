import type { Route } from "next";
import Link from "next/link";
import { ComparisonCTA } from "@/components/marketing/comparison-cta";
import { Schema } from "@/components/seo";
import {
  generateGuideSchemas,
  getGuideBySlug,
  type GuideDefinition,
} from "@/lib/guides";

const tableClass = "w-full border-collapse border-2 border-black font-mono text-sm";
const thClass = "border border-black p-3 text-left font-bold bg-ink text-white";
const tdClass = "border border-black p-3";

interface GuideTemplateProps {
  guide: GuideDefinition;
}

export function GuideTemplate({ guide }: GuideTemplateProps) {
  const related = guide.relatedSlugs
    .map((slug) => getGuideBySlug(slug))
    .filter((item): item is GuideDefinition => item !== undefined);

  return (
    <div className="min-h-screen bg-paper">
      <Schema schema={generateGuideSchemas(guide)} />

      <section className="border-b-2 border-black bg-coral/10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
          <div className="max-w-3xl mx-auto">
            <nav aria-label="Breadcrumb" className="mb-4 font-mono text-xs text-muted-foreground">
              <ol className="flex flex-wrap gap-2">
                <li>
                  <Link href="/" className="hover:text-danger-ink hover:underline">
                    Home
                  </Link>
                </li>
                <li aria-hidden="true">/</li>
                <li>
                  <Link href="/guides" className="hover:text-danger-ink hover:underline">
                    Guides
                  </Link>
                </li>
                <li aria-hidden="true">/</li>
                <li className="text-ink">{guide.breadcrumbName}</li>
              </ol>
            </nav>
            <p className="font-mono text-sm text-danger-ink font-bold uppercase tracking-wider mb-3">
              Platform Access Guide
            </p>
            <h1 className="font-dela text-3xl sm:text-4xl md:text-5xl text-ink mb-4 tracking-tight">
              {guide.title}
            </h1>
            <p className="font-mono text-xs text-muted-foreground mb-4">
              Updated <time dateTime={guide.updatedAt}>{guide.updatedAtDisplay}</time>
            </p>
            <p className="font-mono text-base text-foreground">{guide.heroSummary}</p>
          </div>
        </div>
      </section>

      <section className="border-b-2 border-black bg-card" aria-labelledby="quick-answer-heading">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="max-w-3xl mx-auto">
            <h2 id="quick-answer-heading" className="font-dela text-xl md:text-2xl text-ink mb-4">
              Quick Answer
            </h2>
            <p className="font-mono text-foreground mb-4">{guide.quickAnswer}</p>
            <ol className="list-decimal list-inside space-y-2 font-mono text-sm text-foreground marker:font-bold marker:text-coral">
              {guide.quickSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="border-b-2 border-black bg-paper" aria-labelledby="why-heading">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="max-w-3xl mx-auto">
            <h2 id="why-heading" className="font-dela text-xl md:text-2xl text-ink mb-4">
              {guide.whyHeading}
            </h2>
            <p className="font-mono text-foreground">{guide.whyBody}</p>
          </div>
        </div>
      </section>

      <section id="step-by-step" className="border-b-2 border-black bg-card" aria-labelledby="steps-heading">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="max-w-3xl mx-auto">
            <h2 id="steps-heading" className="font-dela text-xl md:text-2xl text-ink mb-6">
              {guide.stepsHeading}
            </h2>
            <h3 className="font-display text-lg font-semibold text-ink mb-3">
              Method 1: Manual process (free, time-consuming)
            </h3>
            <ol className="list-decimal list-inside space-y-3 font-mono text-sm text-foreground marker:font-bold marker:text-coral mb-8">
              {guide.manualSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            {guide.manualTip ? (
              <p className="font-mono text-xs text-muted-foreground mb-6">
                <strong>Pro tip:</strong> {guide.manualTip}
              </p>
            ) : null}
            <h3 className="font-display text-lg font-semibold text-ink mb-3">
              Method 2: Using AuthHub (5 minutes)
            </h3>
            <p className="font-mono text-sm text-foreground">{guide.authHubMethod}</p>
          </div>
        </div>
      </section>

      <section className="border-b-2 border-black bg-paper" aria-labelledby="problems-heading">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="max-w-3xl mx-auto">
            <h2 id="problems-heading" className="font-dela text-xl md:text-2xl text-ink mb-6">
              Common Problems and Solutions
            </h2>
            <div className="overflow-x-auto">
              <table className={tableClass}>
                <thead>
                  <tr>
                    <th className={thClass}>Problem</th>
                    <th className={thClass}>Solution</th>
                  </tr>
                </thead>
                <tbody className="bg-paper">
                  {guide.problems.map((row) => (
                    <tr key={row.problem}>
                      <td className={tdClass}>{row.problem}</td>
                      <td className={tdClass}>{row.solution}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {guide.problemsSourceHref && guide.problemsSourceLabel ? (
              <p className="mt-4 font-mono text-xs text-muted-foreground">
                Official reference:{" "}
                <a
                  href={guide.problemsSourceHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-danger-ink font-bold hover:underline"
                >
                  {guide.problemsSourceLabel}
                </a>
              </p>
            ) : null}
          </div>
        </div>
      </section>

      {guide.permissions ? (
        <section className="border-b-2 border-black bg-card" aria-labelledby="permissions-heading">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <div className="max-w-3xl mx-auto">
              <h2 id="permissions-heading" className="font-dela text-xl md:text-2xl text-ink mb-6">
                {guide.permissions.heading}
              </h2>
              <div className="overflow-x-auto">
                <table className={tableClass}>
                  <thead>
                    <tr>
                      {guide.permissions.columns.map((column) => (
                        <th key={column} className={thClass}>
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-paper">
                    {guide.permissions.rows.map((row) => (
                      <tr key={row.join("-")}>
                        {row.map((cell, index) => (
                          <td
                            key={`${row[0]}-${index}`}
                            className={index === 0 ? `${tdClass} font-bold` : tdClass}
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="border-b-2 border-black bg-paper" aria-labelledby="checklist-heading">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="max-w-3xl mx-auto">
            <h2 id="checklist-heading" className="font-dela text-xl md:text-2xl text-ink mb-6">
              {guide.checklistHeading}
            </h2>
            <ul className="space-y-2 font-mono text-sm text-foreground list-none">
              {guide.checklist.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="text-danger-ink font-bold" aria-hidden="true">
                    □
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="border-b-2 border-black bg-card" aria-labelledby="faq-heading">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="max-w-3xl mx-auto">
            <h2 id="faq-heading" className="font-dela text-xl md:text-2xl text-ink mb-6">
              Frequently asked questions
            </h2>
            <dl className="space-y-6">
              {guide.faqs.map((faq) => (
                <div key={faq.question}>
                  <dt>
                    <h3 className="font-display text-lg font-semibold text-ink mb-2">{faq.question}</h3>
                  </dt>
                  <dd className="font-mono text-sm text-foreground">{faq.answer}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      <section className="border-b-2 border-black bg-paper" aria-labelledby="related-heading">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="max-w-3xl mx-auto">
            <h2 id="related-heading" className="font-dela text-xl md:text-2xl text-ink mb-4">
              Related Platform Guides
            </h2>
            {guide.extraResource ? (
              <p className="font-mono text-sm text-foreground mb-4">
                {guide.extraResource.before}{" "}
                <Link
                  href={guide.extraResource.href as Route}
                  className="text-danger-ink font-bold hover:underline"
                >
                  {guide.extraResource.label}
                </Link>
                .
              </p>
            ) : null}
            <p className="font-mono text-sm text-foreground mb-4">
              Need access to other platforms? See the{" "}
              <Link href="/guides" className="text-danger-ink font-bold hover:underline">
                guides hub
              </Link>
              {related.map((item, index) => (
                <span key={item.slug}>
                  {index === 0 ? ", " : index === related.length - 1 ? ", and " : ", "}
                  <Link
                    href={`/guides/${item.slug}`}
                    className="text-danger-ink font-bold hover:underline"
                  >
                    {item.title}
                  </Link>
                </span>
              ))}
              . Also{" "}
              <Link href="/pricing" className="text-danger-ink font-bold hover:underline">
                AuthHub pricing
              </Link>
              .
            </p>
          </div>
        </div>
      </section>

      <section className="border-b-2 border-black bg-ink text-white" aria-labelledby="cta-heading">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="max-w-3xl mx-auto text-center">
            <h2 id="cta-heading" className="font-dela text-xl md:text-2xl mb-4">
              Simplify with AuthHub
            </h2>
            <p className="font-mono text-sm text-white/90 mb-6">{guide.ctaBody}</p>
            <ComparisonCTA variant="brutalist" size="xl">
              Start free trial
            </ComparisonCTA>
            <p className="mt-4 font-mono text-xs text-white/70">
              Or{" "}
              <Link href={guide.compareHref as Route} className="text-danger-ink font-bold hover:underline">
                {guide.compareLabel}
              </Link>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
