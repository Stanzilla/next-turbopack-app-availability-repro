# Turbopack dev: page modules shared with `_app` drop page-only modules ("module factory is not available")

Minimal Pages Router repro for a Turbopack dev regression in Next.js 16.4.0. It starts with [#97664](https://github.com/vercel/next.js/pull/97664) "Turbopack: deduplicate Pages Router app chunks".

## Reproduce

```bash
npm install
npm run dev
```

Open http://localhost:3456/. The browser shows:

```
Module [project]/lib/a-page-only.js [client] (ecmascript) was instantiated because it was required from module [project]/pages/index.js [client] (ecmascript), but the module factory is not available.
```

The page server-renders, then crashes during hydration. A clean `.next`, a hard reload and disabled browser cache give the same result.

To list which modules the loaded chunks define, keep the dev server running and run:

```bash
npm run check
```

```
MISSING  lib/a-page-only.js
MISSING  lib/b-boundary.js
defined  lib/c-shared.js
defined  lib/d-boundary.js
defined  lib/e-page.js
```

`npm run dev:webpack` defines all five modules. `npm run build && npm run start` renders the page.

## Shape

- `pages/_app.js` imports `lib/c-shared.js` and calls `import('../lib/app-dyn')`, which also imports `c-shared`.
- `pages/index.js` imports `a-page-only`, `b-boundary`, `c-shared`, `d-boundary`, `e-page` in that order, and calls `import('../lib/page-dyn')`, which imports `b-boundary` and `d-boundary`.

The dynamic imports make `b` and `d` chunk-group boundaries. If the `d-boundary` import is removed from `pages/index.js`, the page works.

## Results

Fresh `npm install` for each row, no `next.config`, no lockfile from another version. "defined" means a chunk loaded for `/` contains the module factory of `a-page-only` and `b-boundary`.

| next | bundler | Node | `a-page-only` / `b-boundary` |
| --- | --- | --- | --- |
| 16.3.0-canary.107 (last canary before #97664) | Turbopack dev | 24.21.0 | defined |
| 16.3.8 | Turbopack dev | 24.21.0 | defined |
| 16.4.0-canary.0 (2 commits after #97664) | Turbopack dev | 24.21.0 | MISSING |
| 16.4.0 | Turbopack dev | 24.21.0 | MISSING |
| 16.4.0 | Turbopack dev | 22.22.2 | MISSING |
| 16.5.0-canary.2 | Turbopack dev | 24.21.0 | MISSING |
| 16.4.0 | webpack dev | 24.21.0 | defined |
| 16.4.0 | `next build` + `next start` | 24.21.0 | renders |

`e-page`, imported after the last boundary, is defined in every row.

## Analysis

#97664 changes `crates/next-api/src/pages.rs` so that every non-`_app` page's client chunk group starts from the `availability_info` of the `/_app` chunk group, not from `AvailabilityInfo::root()`.

In `next build`, `/_app` and the pages share one module graph, so the availability is consistent. In `next dev`, each entry is chunked from its own per-page module graph. The e2e test that #97664 adds (`test/e2e/app-document-import-order`, "loads modules shared by _app and the page only once") is skipped in dev for this reason.

The availability items from the `/_app` graph do not mean the same thing in the page graph:

1. In `module_batches.rs`, the pre-batch for the page entry is `[a, Ref(b), c, Ref(d), e, index]`. Modules are pushed in DFS post-order, and boundary modules become `ParallelReference` items.
2. The pass that splits batches so that references come before modules turns this into `N1 = [a]`, `N2 = [Ref(N1), Ref(b), c]` and `entry = [Ref(N2), Ref(d), e, index]`.
3. `N2` has one direct module, so it becomes `ModuleOrBatch::Module(c)`. It still holds the references to `N1` and `b`. Those are siblings that come earlier in the import order. They are not dependencies of `c`.
4. The `/_app` graph has `Module(c)` as an available item. `chunk_group_content` finds the page node `Module(c)` in the available set, marks it available and returns `GraphTraversalAction::Exclude`. That skips its whole subtree, so `a` and `b` are never put in a chunk.

The same can happen with `Batch` items. `ModuleBatch` identity is `(direct modules, chunk_groups bitmap)`, and the bitmaps are local to each graph. Both `/_app` and the page are group 0 in their own graphs, so batches from different graphs can compare equal.

`BatchingConfig` only has `use_heuristic`, so we found no config option that avoids this.

## Real-world impact

In our Pages Router app, the `_app` chunks alone define about 5,700 client modules. `next dev` on 16.4.0 fails on every page we tried (`/en`, `/en/home`, `/subscriptions`). For example, the `/[locale]/home` entry requires `packages/navigation/Redirect/index.tsx`, and none of the 114 `_app` chunks or the 4 page chunks define it. Production builds are not affected.

## Environment

```
Operating System:
  Platform: darwin
  Arch: arm64
Binaries:
  Node: 24.21.0
  npm: 11.19.0
Relevant Packages:
  next: 16.4.0
  react: 19.3.0
  react-dom: 19.3.0
Next.js Config:
  output: N/A
```
