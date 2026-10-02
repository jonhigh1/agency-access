from pathlib import Path
import gzip, json, sys
if len(sys.argv) != 2:
    raise SystemExit("Usage: python3 scripts/perf/measure-route-bundles.py <Next build directory>")
build = Path(sys.argv[1])
rows = []
for route in ['clients', 'dashboard', 'access-requests/new']:
    source = (build/'server/app/(authenticated)'/route/'page_client-reference-manifest.js').read_text()
    assignment = source.strip().split('\n')[-1].split(' = ', 1)[1].removesuffix(';')
    manifest = json.loads(assignment)
    key = '[project]/apps/web/src/app/(authenticated)/'+route+'/page'
    files = sorted(set(manifest['entryJSFiles'][key]))
    assert files and all(file.startswith('static/chunks/') for file in files)
    chunks = [(build/file).read_bytes() for file in files]
    rows.append({'route': '/'+route, 'initialChunks': len(files), 'rawBytes': sum(map(len,chunks)), 'gzipBytes': sum(len(gzip.compress(c,mtime=0)) for c in chunks), 'files': files})
print(json.dumps(rows, indent=2))
