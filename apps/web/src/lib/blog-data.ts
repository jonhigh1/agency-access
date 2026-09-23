/**
 * Blog posts data
 * Content loaded from Markdown files in content/blog/
 * One file per post: {slug}.md with YAML frontmatter + body
 */

import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import type { BlogPost, BlogCategory, BlogStage } from "./blog-types";

const CONTENT_DIR = path.join(process.cwd(), "content", "blog");

const VALID_CATEGORIES: BlogCategory[] = [
  "onboarding",
  "tutorials",
  "comparisons",
  "security",
  "operations",
  "case-studies",
  "research",
];

const VALID_STAGES: BlogStage[] = [
  "awareness",
  "consideration",
  "decision",
];

type Frontmatter = Record<string, unknown>;
type AuthorFrontmatter = Record<"name", unknown> & Record<string, unknown>;
const postCache = new Map<string, BlogPost | undefined>();
let allPostsCache: BlogPost[] | undefined;

function isAuthorFrontmatter(value: unknown): value is AuthorFrontmatter {
  return typeof value === "object" && value !== null && "name" in value;
}

function parseMarkdown(raw: string): { data: Frontmatter; content: string } {
  if (!raw.startsWith("---")) {
    return { data: {}, content: raw };
  }

  const frontmatterEnd = raw.indexOf("\n---", 3);
  if (frontmatterEnd === -1) {
    return { data: {}, content: raw };
  }

  const yaml = raw.slice(3, frontmatterEnd).trim();
  const contentStart = raw.indexOf("\n", frontmatterEnd + 4);
  const content = contentStart === -1 ? "" : raw.slice(contentStart + 1);
  const parsed = parseYaml(yaml);

  return {
    data: parsed && typeof parsed === "object" ? (parsed as Frontmatter) : {},
    content,
  };
}

function parseFileToPost(filePath: string, slug: string): BlogPost {
  const raw = readFileSync(filePath, "utf-8");
  const { data, content } = parseMarkdown(raw);

  const category = data.category as string;
  const stage = data.stage as string;

  if (!VALID_CATEGORIES.includes(category as BlogCategory)) {
    console.warn(
      `[blog-data] Invalid category "${category}" in ${slug}.md, defaulting to "tutorials"`
    );
  }
  if (!VALID_STAGES.includes(stage as BlogStage)) {
    console.warn(
      `[blog-data] Invalid stage "${stage}" in ${slug}.md, defaulting to "consideration"`
    );
  }

  const author = data.author;
  const authorObj = isAuthorFrontmatter(author)
    ? {
        name: String(author.name ?? ""),
        role: String(author.role ?? ""),
        avatar: author.avatar ? String(author.avatar) : undefined,
      }
    : { name: "AuthHub Team", role: "Agency Operations Experts" };

  return {
    id: String(data.id ?? slug),
    slug,
    title: String(data.title ?? ""),
    excerpt: String(data.excerpt ?? ""),
    content: content.trim(),
    category: (VALID_CATEGORIES.includes(category as BlogCategory)
      ? category
      : "tutorials") as BlogCategory,
    stage: (VALID_STAGES.includes(stage as BlogStage)
      ? stage
      : "consideration") as BlogStage,
    publishedAt: String(data.publishedAt ?? ""),
    readTime: Number(data.readTime) || 5,
    author: authorObj,
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    metaTitle: data.metaTitle ? String(data.metaTitle) : undefined,
    metaDescription: data.metaDescription
      ? String(data.metaDescription)
      : undefined,
    openGraphDescription: data.openGraphDescription
      ? String(data.openGraphDescription)
      : undefined,
    relatedPosts: Array.isArray(data.relatedPosts)
      ? data.relatedPosts.map(String)
      : undefined,
    featuredImage: data.featuredImage ? String(data.featuredImage) : undefined,
    canonical: data.canonical ? String(data.canonical) : undefined,
  };
}

function getSlugs(): string[] {
  if (!existsSync(CONTENT_DIR)) {
    return [];
  }
  return readdirSync(CONTENT_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.replace(/\.md$/, ""));
}

function loadPostBySlug(slug: string): BlogPost | undefined {
  if (postCache.has(slug)) return postCache.get(slug);
  const filePath = path.join(CONTENT_DIR, `${slug}.md`);
  if (!existsSync(filePath)) {
    postCache.set(slug, undefined);
    return undefined;
  }
  const post = parseFileToPost(filePath, slug);
  postCache.set(slug, post);
  return post;
}

export function getBlogPosts(): BlogPost[] {
  if (allPostsCache) return allPostsCache;
  const slugs = getSlugs();
  const posts = slugs
    .map((slug) => loadPostBySlug(slug))
    .filter((p): p is BlogPost => p !== undefined);
  allPostsCache = posts.sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
  return allPostsCache;
}

export function getBlogPostBySlug(slug: string): BlogPost | undefined {
  return loadPostBySlug(slug);
}

export function getBlogPostsByCategory(category: string): BlogPost[] {
  return getBlogPosts().filter((post) => post.category === category);
}

export function getRelatedPosts(
  currentPostId: string,
  limit = 3
): BlogPost[] {
  const all = getBlogPosts();
  const current = all.find((p) => p.id === currentPostId);
  if (!current?.relatedPosts?.length) {
    return [];
  }
  const idToPost = new Map(all.map((p) => [p.id, p]));
  return current.relatedPosts
    .map((id) => idToPost.get(id))
    .filter((p): p is BlogPost => p !== undefined)
    .slice(0, limit);
}

export function getFeaturedPosts(limit = 3): BlogPost[] {
  return getBlogPosts()
    .filter((post) => post.tags.includes("featured"))
    .slice(0, limit);
}
