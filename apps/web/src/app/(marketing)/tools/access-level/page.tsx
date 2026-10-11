import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { AccessLevelQuiz } from "./access-level-quiz";
import { ACCESS_LEVEL_TOOL_FAQS, ACCESS_LEVEL_TOOL_URL } from "@/lib/access-level-tool";
import { generateFAQSchema } from "@/lib/schema-generators";

const PAGE_TITLE = "Agency Access Level Tool | AuthHub";
const META_DESCRIPTION =
  "Pick the platform family and the job. AuthHub recommends admin, standard, read-only, or email-only — no signup, no Business Manager ID lookup.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: META_DESCRIPTION,
  alternates: {
    canonical: ACCESS_LEVEL_TOOL_URL,
  },
  openGraph: {
    title: PAGE_TITLE,
    description: META_DESCRIPTION,
    type: "website",
    url: ACCESS_LEVEL_TOOL_URL,
  },
};

const faqSchema = generateFAQSchema([...ACCESS_LEVEL_TOOL_FAQS]);

export default function AccessLevelToolPage() {
  return (
    <div className="min-h-screen bg-paper">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <section className="border-b-2 border-black">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
          <div className="max-w-3xl">
            <p className="label-micro text-danger-ink mb-4">
              <Link href={"/tools" as Route} className="hover:underline">
                Tools
              </Link>
            </p>
            <h1 className="font-dela text-3xl sm:text-4xl md:text-5xl text-ink mb-4 tracking-tight">
              Which access level should the agency request?
            </h1>
            <p className="font-mono text-base text-foreground">
              Platform family plus the job to be done. The result is a permission
              recommendation you can copy with attribution. Ungated — no Graph API,
              no account required.
            </p>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="max-w-xl">
          <AccessLevelQuiz />
        </div>
      </section>

      <section
        className="container mx-auto px-4 sm:px-6 lg:px-8 pb-16 md:pb-24"
        aria-labelledby="tool-faq-heading"
      >
        <div className="max-w-3xl">
          <h2
            id="tool-faq-heading"
            className="font-dela text-2xl md:text-3xl text-ink mb-6 border-b-2 border-black pb-2"
          >
            Frequently asked questions
          </h2>
          <dl className="space-y-6">
            {ACCESS_LEVEL_TOOL_FAQS.map((faq) => (
              <div key={faq.question}>
                <dt>
                  <h3 className="font-dela text-xl text-ink mb-2">{faq.question}</h3>
                </dt>
                <dd className="font-mono text-foreground leading-relaxed">{faq.answer}</dd>
              </div>
            ))}
          </dl>
          <p className="font-mono text-sm text-foreground mt-10">
            Next:{" "}
            <Link
              href={"/guides" as Route}
              className="font-bold text-danger-ink hover:underline"
            >
              platform access guides
            </Link>
            {" · "}
            <Link
              href={"/compare" as Route}
              className="font-bold text-danger-ink hover:underline"
            >
              compare tools
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
