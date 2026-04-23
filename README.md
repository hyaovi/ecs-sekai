# Sekai ECS

A TypeScript Entity Component System benchmarked against [bitECS](https://github.com/NateTheGreatt/bitECS), one of the fastest ECS libraries available for JavaScript. Built as a research project to explore how far browser performance can be pushed through archetype-based storage, typed-array layout, and JIT-friendly access patterns.

## Benchmarks

Sekai is competitive with bitECS across the workloads tested, with measurable wins on query iteration and fragmented archetype scenarios. Full methodology and per-task numbers are in [`benchmarks/latest-results.md`](./benchmarks/latest-results.md). Reproducible via the scripts below.

| Workload | Sekai | bitECS | Notes |
|----------|-------|--------|-------|
| _TODO: fill from latest-results.md after a clean run_ |  |  | |

Where bitECS wins, it's called out explicitly in the results file rather than hidden. The goal here is to understand the performance space, not to claim a blanket win.

### Run the benchmarks

```bash
pnpm install
pnpm run bench            # Node benchmarks via tinybench, writes ./benchmarks/latest-results.md
pnpm run bench:browser    # Same benchmarks in the browser; open devtools to see results
```

The browser run loads `bench.ts` via `bench.html` and streams results to the browser devtools console. For a rendered markdown version, use the Node run and read `benchmarks/latest-results.md`.

## Design

- **Bitmask archetype system** — entities grouped by component signature, queries resolve to O(archetypes) not O(entities).
- **Typed-array component stores** — contiguous memory, cache-friendly iteration.
- **Cached queries** — query definitions resolve once, entity sets update incrementally on structural change.
- **Deferred operations** — safe mutation during iteration without copying the entity set.

## Scripts

```bash
pnpm run test             # Vitest test suite
pnpm run bench            # Node benchmarks (tinybench), writes markdown report
pnpm run bench:browser    # Browser benchmarks (Vite), console output
```

## Notes

Research project focused on performance exploration. API is subject to change. bitECS version used for comparison is pinned in `package.json` and recorded in each [`latest-results.md`](./benchmarks/latest-results.md) run.