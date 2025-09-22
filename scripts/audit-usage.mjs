import fs from 'fs'; import path from 'path';
import { walk, readText, rel } from './util/fs-scan.mjs';

const SRC = path.join(process.cwd(),'src');
const SERVER = path.join(process.cwd(),'server');
const REPORT_DIR = path.join(process.cwd(),'audit');
fs.mkdirSync(REPORT_DIR, { recursive: true });

const files = {
  src: fs.existsSync(SRC) ? walk(SRC) : [],
  server: fs.existsSync(SERVER) ? walk(SERVER) : [],
};

const reImport = /import\s+(?:.+?\s+from\s+)?['"]([^'"]+)['"]/g;
const reRequire = /require\(\s*['"]([^'"]+)['"]\s*\)/g;
const reExportFn = /export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)/g;
const reRoute = /\brouter\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g;
const reAppUse = /\bapp\.use\s*\(\s*['"`]([^'"`]+)['"`]/g;
const reFetch = /\bfetch\s*\(\s*['"`]([^'"`]+)['"`]/g;
const reRequestCall = /\brequest\s*\(\s*['"`]([^'"`]+)['"`]/g;
const reRoutePath = /path\s*=\s*['"`]([^'"`]+)['"`]/g;
const reNavTo = /(?:to|href)\s*[:=]\s*['"`]([^'"`]+)['"`]/g;

function collectImports(map, content, from){
  for(const re of [reImport, reRequire]){
    re.lastIndex = 0;
    let m; while((m = re.exec(content))) {
      if(!map[m[1]]) map[m[1]] = new Set();
      map[m[1]].add(from);
    }
  }
}

// 1) Frontend scan
const frontend = {
  routes: new Set(),
  sidebarTo: new Set(),
  ui: new Map(), hooks: new Map(), services: new Map(), pages: new Map(),
  calls: new Set(),
};

for(const f of files.src){
  const t = readText(f);
  const short = rel(f);

  // Routes from App.tsx
  if(short.endsWith('src/App.tsx')){
    reRoutePath.lastIndex = 0; let m;
    while((m = reRoutePath.exec(t))) frontend.routes.add(m[1]);
  }

  // Sidebar links
  if(short.includes('src/components/layout/Sidebar')){
    reNavTo.lastIndex = 0; let m;
    while((m = reNavTo.exec(t))) frontend.sidebarTo.add(m[1]);
  }

  // imports
  collectImports(frontend.pages, t, short);

  // Buckets
  if(short.includes('src/components/ui/')){
    frontend.ui.set(short, t);
  }
  if(short.includes('src/hooks/')){
    frontend.hooks.set(short, t);
  }
  if(short.includes('src/services/')){
    // exported functions
    const fns = []; reExportFn.lastIndex = 0; let m;
    while((m = reExportFn.exec(t))) fns.push(m[1]);
    frontend.services.set(short, { text: t, fns });
  }

  // API calls
  for(const re of [reFetch, reRequestCall]){
    re.lastIndex = 0; let m;
    while((m = re.exec(t))){
      const url = m[1];
      if(url.startsWith('/api') || url.startsWith('http') || url.startsWith('/')) frontend.calls.add(url);
    }
  }
}

// Build importers map for specific folders
function reverseImporters(folderRegex){
  const importers = new Map();
  for(const [spec, fromSet] of frontend.pages.entries()){
    if(!spec) continue;
    if(folderRegex.test(spec)) continue; // we want spec like '@/components/ui/Button' in import spec, but we have only keys as specs? we used 'pages' for spec strings
  }
  // Re-scan to get spec → importers properly
  const specToImporters = new Map();
  for(const f of files.src){
    const t = readText(f); const short = rel(f);
    reImport.lastIndex = 0; let m;
    while((m = reImport.exec(t))){
      const spec = m[1];
      if(!specToImporters.has(spec)) specToImporters.set(spec, new Set());
      specToImporters.get(spec).add(short);
    }
  }
  return specToImporters;
}
const specImporters = reverseImporters(/$/);

// 2) Backend scan
const backend = { appUses: [], routes: [] };
for(const f of files.server){
  const t = readText(f); const short = rel(f);

  // app.use mounts (order sensitive) - check multiple server files
  if(short.includes('server/') && (short.endsWith('.js') || short.endsWith('.ts'))){
    reAppUse.lastIndex = 0; let m;
    while((m = reAppUse.exec(t))) backend.appUses.push({ path: m[1], file: short, index: m.index });
  }

  // router paths
  reRoute.lastIndex = 0; let m;
  while((m = reRoute.exec(t))){
    backend.routes.push({ method: m[1], path: m[2], file: short });
  }
}

// 3) Unused detectors
function listFolder(prefix){
  return [...new Set(files.src.filter(p => rel(p).startsWith('src/'+prefix) && p.match(/\.(ts|tsx)$/)).map(rel))];
}
const uiFiles = listFolder('components/ui');
const hookFiles = listFolder('hooks');
const pageFiles = listFolder('components').filter(p => !p.includes('/ui/') && !p.includes('/layout/'));
const serviceFiles = listFolder('services');

function wasImported(spec){
  // check by import spec or relative resolution
  for(const [s, froms] of specImporters.entries()){
    if(s.includes(spec) || spec.includes(s)) return true;
  }
  return false;
}

const unused = {
  ui: uiFiles.filter(f => !wasImported(path.basename(f).replace(/\.(tsx|ts)$/,''))),
  hooks: hookFiles.filter(f => !wasImported(path.basename(f).replace(/\.(tsx|ts)$/,''))),
  services: [],
  pages: [],
};

// exported service functions never referenced by name anywhere (best-effort regex)
const allSourceText = files.src.map(readText).join('\n');
for(const [svcPath, meta] of frontend.services.entries()){
  const missingFns = (meta.fns||[]).filter(fn => !new RegExp(`\\b${fn}\\s*\\(`).test(allSourceText));
  if(missingFns.length) unused.services.push({ file: rel(svcPath), fns: missingFns });
}

// Pages never imported anywhere (heuristic)
for(const p of pageFiles){
  const base = path.basename(p).replace(/\.(tsx|ts)$/,'');
  if(!wasImported(base)) unused.pages.push(p);
}

// 4) Route coverage (Sidebar ↔ Routes)
const routes = [...frontend.routes];
const sidebar = [...frontend.sidebarTo];
const sidebarMissingRoutes = sidebar.filter(to => !routes.includes(to));
const routesUnlinked = routes.filter(rt => !sidebar.includes(rt));

// 5) API cross-check
const clientCalls = [...frontend.calls];
const serverPaths = backend.routes.map(r => r.path);
const calledNotDefined = clientCalls.filter(u => u.startsWith('/api') && !serverPaths.some(p => u.includes(p)));
const definedNotCalled = backend.routes.filter(r => !clientCalls.some(u => u.includes(r.path)));

const summary = {
  counts: {
    srcFiles: files.src.length, serverFiles: files.server.length,
    uiFiles: uiFiles.length, hooksFiles: hookFiles.length, servicesFiles: serviceFiles.length, pageFiles: pageFiles.length
  },
  routes: { defined: routes, sidebar, sidebarMissingRoutes, routesUnlinked },
  backend: { appUses: backend.appUses, routes: backend.routes },
  usage: { clientCalls, serverPaths },
  gaps: { calledNotDefined, definedNotCalled, unused },
};

// Write JSON + Markdown
const stamp = new Date().toISOString().replace(/[:.]/g,'-');
const jsonPath = path.join(REPORT_DIR, `usage-summary-${stamp}.json`);
fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2), 'utf-8');

function mdList(arr){ return arr.length ? arr.map(x => `- ${typeof x === 'string' ? x : JSON.stringify(x)}`).join('\n') : '- (none)'; }

const md = `# Project Usage Audit

Generated: ${new Date().toISOString()}

## Counts
- src files: ${summary.counts.srcFiles}
- server files: ${summary.counts.serverFiles}
- UI components: ${summary.counts.uiFiles}
- hooks: ${summary.counts.hooksFiles}
- services: ${summary.counts.servicesFiles}
- pages: ${summary.counts.pageFiles}

## Routing
**Defined routes (App.tsx):**
${mdList(summary.routes.defined)}

**Sidebar links:**
${mdList(summary.routes.sidebar)}

**⚠ Sidebar targets missing matching Route:**
${mdList(summary.routes.sidebarMissingRoutes)}

**⚠ Routes not reachable from Sidebar:**
${mdList(summary.routes.routesUnlinked)}

## Backend
**app.use mounts (order sensitive):**
${mdList(summary.backend.appUses)}

**API routes (method path file):**
${mdList(summary.backend.routes.map(r => `${r.method.toUpperCase()} ${r.path} (${r.file})`))}

## Client API Calls
${mdList(summary.usage.clientCalls)}

**Server API paths:**
${mdList(summary.usage.serverPaths)}

**⚠ Client calls without server definition:**
${mdList(summary.gaps.calledNotDefined)}

**⚠ Server endpoints never called by client:**
${mdList(summary.gaps.definedNotCalled)}

## Unused / Underused
**UI components possibly unused:**
${mdList(summary.gaps.unused.ui)}

**Hooks possibly unused:**
${mdList(summary.gaps.unused.hooks)}

**Service functions exported but never used:**
${mdList(summary.gaps.unused.services)}

**Components/pages never imported:**
${mdList(summary.gaps.unused.pages)}

---

> Heuristics are regex-based; confirm critical items manually. This audit did **not** mutate any source file.
`;

const mdPath = path.join(REPORT_DIR, `usage-report-${stamp}.md`);
fs.writeFileSync(mdPath, md, 'utf-8');

console.log('OK :: wrote', rel(jsonPath), 'and', rel(mdPath));