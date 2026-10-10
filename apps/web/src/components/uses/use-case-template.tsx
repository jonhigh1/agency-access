import type { Route } from "next";
import Link from "next/link";
import type { UseCaseDefinition } from "@/lib/use-cases";
import { getUseCaseBySlug } from "@/lib/use-cases";

interface UseCaseTemplateProps {
  useCase: UseCaseDefinition;
}

export function UseCaseTemplate({ useCase }: UseCaseTemplateProps) {
  const related = useCase.relatedSlugs
    .map((slug) => getUseCaseBySlug(slug))
    .filter((item): item is UseCaseDefinition => item !== undefined);

  return (
    <div className="min-h-screen bg-paper">
      <section className="border-b-2 border-black">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
          <div className="max-w-3xl">
            <p className="label-micro text-danger-ink mb-4">
              <Link href={"/uses" as Route} className="hover:underline">
                Uses
              </Link>
            </p>
            <h1 className="font-dela text-3xl sm:text-4xl md:text-5xl text-ink mb-4 tracking-tight">
              {useCase.title}
            </h1>
            <p className="font-mono text-base text-foreground">{useCase.heroSummary}</p>
          </div>
        </div>
      </section>

      <section className="border-b-2 border-black bg-card">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="max-w-3xl">
            <h2 className="font-dela text-xl md:text-2xl text-ink mb-4">Platforms in this workflow</h2>
            <ul className="flex flex-wrap gap-2">
              {useCase.platforms.map((platform) => (
                <li
                  key={platform}
                  className="border-2 border-black bg-paper px-3 py-1 font-mono text-sm"
                >
                  {platform}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {useCase.sections.map((section) => (
        <section key={section.heading} className="border-b-2 border-black">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <div className="max-w-3xl">
              <h2 className="font-dela text-xl md:text-2xl text-ink mb-4">{section.heading}</h2>
              <p className="font-mono text-foreground leading-relaxed">{section.body}</p>
            </div>
          </div>
        </section>
      ))}

      <section className="border-b-2 border-black bg-card">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="max-w-3xl">
            <h2 className="font-dela text-xl md:text-2xl text-ink mb-4">Related uses</h2>
            <ul className="space-y-2 font-mono text-sm">
              {related.map((item) => (
                <li key={item.slug}>
                  <Link
                    href={`/uses/${item.slug}` as Route}
                    className="text-danger-ink font-bold hover:underline"
                  >
                    {item.title}
                  </Link>
                </li>
              ))}
            </ul>
            <p className="font-mono text-sm text-foreground mt-6">
              Next:{" "}
              <Link href={"/tools/access-level" as Route} className="text-danger-ink font-bold hover:underline">
                access-level tool
              </Link>
              {" · "}
              <Link href={"/guides" as Route} className="text-danger-ink font-bold hover:underline">
                platform guides
              </Link>
              {" · "}
              <Link href={"/compare" as Route} className="text-danger-ink font-bold hover:underline">
                compare tools
              </Link>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
