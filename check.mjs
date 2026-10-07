// Lists which page modules have a factory in the chunks that load for `/`.
// Run while `npm run dev` (or `npm run dev:webpack`) is up.
const port = process.argv[2] ?? '3456';
const base = `http://localhost:${port}`;
const modules = ['lib/a-page-only.js', 'lib/b-boundary.js', 'lib/c-shared.js', 'lib/d-boundary.js', 'lib/e-page.js'];

const get = async (path) => {
  const res = await fetch(base + path);
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.text();
};

const html = await get('/');
const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]);
const code = (await Promise.all(scripts.map(get))).join('\n');

// A require call also contains the module id, so match the factory definition only.
const isDefined = (mod) =>
  code.includes(`"[project]/${mod} [client] (ecmascript)", (`) || // Turbopack
  code.includes(`"(pages-dir-browser)/./${mod}":`); // webpack

for (const mod of modules) console.log(`${isDefined(mod) ? 'defined' : 'MISSING'}  ${mod}`);
