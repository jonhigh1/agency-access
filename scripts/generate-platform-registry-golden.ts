/**
 * Regenerates the frozen literal blocks for the PLATFORMS registry goldens.
 *
 * GOLDEN CHANGE PROTOCOL (DEC-015, docs/DECISIONS.md):
 *   A golden literal may only change through a reviewed product decision.
 *   Run this script by hand with an explicit decision reference, review the
 *   diff it motivates, and update the provenance header in each golden file.
 *   Never regenerate in CI; never edit a golden literal without a decision.
 *
 * Usage:
 *   npx tsx scripts/generate-platform-registry-golden.ts --acknowledge=DEC-015
 *
 * The script refuses to run without --acknowledge=<decision-ref> so the
 * linkage between a golden change and its decision is enforced at the
 * command, not by convention. Imports shared SRC (not dist) by relative
 * path so output never depends on build freshness.
 */

interface Args {
  acknowledge?: string;
}

function parseArgs(argv: readonly string[]): Args {
  const ack = argv.find((a) => a.startsWith('--acknowledge='));
  return { acknowledge: ack?.split('=')[1] };
}

async function main(): Promise<void> {
  const { acknowledge } = parseArgs(process.argv.slice(2));
  if (!acknowledge) {
    console.error(
      'Refusing to regenerate goldens without --acknowledge=<decision-ref> (see docs/DECISIONS.md).'
    );
    process.exit(1);
  }

  // Imported after the guard so a bare run never touches the registry module.
  const { PLATFORMS, LEGACY_PAYLOAD_IDS, clientOAuthPlatforms, manualConfirmationPlatforms, platformIds } =
    await import('../packages/shared/src/platforms/registry.js');

  const today = new Date().toISOString().slice(0, 10);
  const header = (target: string): string =>
    [
      '// GOLDEN — regenerate only via:',
      '//   npx tsx scripts/generate-platform-registry-golden.ts --acknowledge=' + acknowledge,
      `// Provenance: acknowledged under ${acknowledge} (docs/DECISIONS.md), ${today}.`,
      '// Frozen literals; NEVER snapshots.',
      `// Target file: ${target}`,
    ].join('\n');

  const row = (id: string): string => {
    const entry: Record<string, unknown> = PLATFORMS[id as keyof typeof PLATFORMS];
    const parent = 'parent' in entry ? (entry['parent'] as string) : null;
    const clientAuth =
      'clientAuthorizable' in entry ? (entry['clientAuthorizable'] as boolean) : null;
    return JSON.stringify({ id, kind: entry['kind'], parent, clientAuthorizable: clientAuth });
  };

  console.log(header('packages/shared/src/__tests__/platform-registry.golden.test.ts'));
  console.log('// entries (id / kind / parent / clientAuthorizable), canonical declaration order:');
  console.log(platformIds.map(row).join(',\n'));
  console.log('');
  console.log('// clientOAuthPlatforms (' + clientOAuthPlatforms.length + '):');
  console.log(JSON.stringify(clientOAuthPlatforms));
  console.log('');
  console.log('// manualConfirmationPlatforms (' + manualConfirmationPlatforms.length + '):');
  console.log(JSON.stringify(manualConfirmationPlatforms));
  console.log('');
  console.log('// LEGACY_PAYLOAD_IDS (' + LEGACY_PAYLOAD_IDS.size + '):');
  console.log(JSON.stringify([...LEGACY_PAYLOAD_IDS]));
  console.log('');
  console.log(
    '// capabilities table: copy verbatim from the registry entries (characterized from'
  );
  console.log('// PLATFORM_TOKEN_CAPABILITIES, packages/shared/src/types.ts:60-208).');
  console.log('// displayName table: copy from the entries above; rider and legacy names are');
  console.log('// new author choices frozen in the golden.');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
