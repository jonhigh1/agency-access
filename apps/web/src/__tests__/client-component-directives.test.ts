import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const srcDir = path.resolve(import.meta.dirname, '..');

function collectSourceFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(entryPath));
    } else if (entry.isFile() && /\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      files.push(entryPath);
    }
  }
  return files;
}

function isStringDirective(statement: ts.Statement): statement is ts.ExpressionStatement {
  return (
    ts.isExpressionStatement(statement) &&
    ts.isStringLiteral(statement.expression)
  );
}

describe('client component directives', () => {
  it("keeps 'use client' inside the file's directive prologue", () => {
    const violations: string[] = [];

    for (const file of collectSourceFiles(srcDir)) {
      const content = fs.readFileSync(file, 'utf8');
      const source = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true);

      for (let i = 0; i < source.statements.length; i += 1) {
        const statement = source.statements[i];
        if (!isStringDirective(statement)) continue;
        if (statement.expression.text !== 'use client') continue;

        const precedesPrologue = source.statements
          .slice(0, i)
          .every((earlier) => isStringDirective(earlier));
        if (!precedesPrologue) {
          violations.push(`${path.relative(srcDir, file)}: 'use client' at statement ${i} of ${source.statements.length}`);
        }
        break;
      }
    }

    expect(violations).toEqual([]);
  });
});
