# Sekai ECS — Benchmark Results

_Generated 2026-04-23T23:09:16.907Z_

## Environment

| Field | Value |
| --- | --- |
| Node | v25.9.0 |
| Platform | darwin arm64 |
| CPU | Apple M4 Pro (14 cores) |
| Memory | 48.0 GB |
| Bench time | 1000ms per task |
| Warmup | 200ms per task |

## Methodology notes

- Each task runs for 1000ms after a 200ms warmup.
- Numbers are reported as ops/sec (higher = better) and latency (lower = better).
- Sekai and bitECS are compared on equivalent workloads where the APIs align. Some Sekai features (deferred ops, serialization, tick pipeline) have no direct bitECS equivalent and are reported separately.
- Sekai's tick pipeline includes phase dispatch and deferred-op flushing; the bitECS comparison calls a plain function loop. They are not apples-to-apples and are labeled as such.

## Entity Lifecycle

_Bulk tests include world construction per iteration (end-to-end bootstrap cost)._

| Task name | Latency avg (ns) | Latency med (ns) | Throughput avg (ops/s) | Throughput med (ops/s) | Samples |
| --- | --- | --- | --- | --- | --- |
| Sekai: single create + destroy | 28.64 ± 0.04% | 41.00 ± 1.00 | 27437844 ± 0.01% | 24390244 ± 580720 | 34914993 |
| bitECS: single create + destroy | 100.65 ± 7.42% | 83.00 ± 0.00 | 11457915 ± 0.01% | 12048193 ± 0 | 9935671 |
| Sekai: bulk create 10k entities (incl. world init) | 104310 ± 2.96% | 93333 ± 7875.0 | 10687 ± 0.44% | 10714 ± 914 | 9587 |
| bitECS: bulk create 10k entities (incl. world init) | 610575 ± 1.72% | 564834 ± 15959 | 1720 ± 0.72% | 1770 ± 51 | 1638 |
| Sekai: bulk destroy 10k entities (incl. world init) | 216840 ± 1.22% | 206917 ± 8854.0 | 4771 ± 0.34% | 4833 ± 206 | 4612 |
| bitECS: bulk destroy 10k entities (incl. world init) | 1287805 ± 1.41% | 1225813 ± 24313 | 793 ± 0.82% | 816 ± 16 | 778 |
| Sekai: entity recycling (2x create/destroy) | 44.74 ± 0.04% | 42.00 ± 0.00 | 22781804 ± 0.01% | 23809524 ± 0 | 22351494 |
| bitECS: entity recycling (2x create/destroy) | 185.15 ± 4.97% | 167.00 ± 0.00 | 6104938 ± 0.01% | 5988024 ± 0 | 5401025 |

## Component Operations

_Add and remove are measured as pairs (symmetric setup/teardown per iteration). `updateComponent` and `hasComponent` are Sekai-only API shapes; no direct equivalent in bitECS (which exposes raw typed-array access instead)._

| Task name | Latency avg (ns) | Latency med (ns) | Throughput avg (ops/s) | Throughput med (ops/s) | Samples |
| --- | --- | --- | --- | --- | --- |
| Sekai: add + remove 1 component (pair) | 60.70 ± 0.04% | 42.00 ± 1.00 | 18643948 ± 0.02% | 23809524 ± 580720 | 16474356 |
| bitECS: add + remove 1 component (pair) | 90.63 ± 10.94% | 83.00 ± 0.00 | 12961422 ± 0.02% | 12048193 ± 0 | 11033856 |
| Sekai: add + remove 3 components (pair) | 220.20 ± 0.04% | 209.00 ± 1.00 | 4629035 ± 0.01% | 4784689 ± 23003 | 4541389 |
| bitECS: add + remove 3 components (pair) | 220.80 ± 4.40% | 208.00 ± 0.00 | 4916076 ± 0.01% | 4807692 ± 0 | 4528918 |
| Sekai: updateComponent (partial) [Sekai-only] | 80.15 ± 0.32% | 83.00 ± 0.00 | 13626100 ± 0.02% | 12048193 ± 1 | 12476122 |
| Sekai: hasComponent check | 19.45 ± 0.04% | 0.00 ± 0.00 | 38677590 ± 0.01% | 51416077 ± 0 | 51416078 |

## Query Performance

_Mixed archetype tests populate 2 archetypes to force archetype-fan-out on Sekai's query. `defineQuery (cached hit)` measures cache lookup cost vs. bitECS's `query()` which re-executes on every call._

| Task name | Latency avg (ns) | Latency med (ns) | Throughput avg (ops/s) | Throughput med (ops/s) | Samples |
| --- | --- | --- | --- | --- | --- |
| Sekai: query iteration (10k entities) | 3148.3 ± 0.04% | 3166.0 ± 41.00 | 318869 ± 0.02% | 315856 ± 4144 | 317637 |
| bitECS: query iteration (10k entities) | 3135.8 ± 0.04% | 3125.0 ± 42.00 | 320171 ± 0.02% | 320000 ± 4244 | 318900 |
| Sekai: mixed archetypes query (10k, 2 archetypes) | 3145.0 ± 0.04% | 3166.0 ± 41.00 | 319180 ± 0.02% | 315856 ± 4144 | 317965 |
| bitECS: mixed archetypes query (10k, 2 archetypes) | 3132.3 ± 0.04% | 3125.0 ± 42.00 | 320662 ± 0.02% | 320000 ± 4244 | 319251 |
| Sekai: structural change + re-query | 79.45 ± 0.04% | 83.00 ± 0.00 | 13426517 ± 0.02% | 12048193 ± 1 | 12586230 |
| bitECS: structural change + re-query | 130.20 ± 8.36% | 125.00 ± 0.00 | 8633864 ± 0.02% | 8000000 ± 1 | 7680492 |
| Sekai: defineQuery (cached hit) | 194.51 ± 0.09% | 208.00 ± 1.00 | 5252962 ± 0.01% | 4807692 ± 23003 | 5141144 |
| bitECS: query() call (re-execute) | 140.51 ± 0.05% | 125.00 ± 0.00 | 7353722 ± 0.01% | 8000000 ± 1 | 7117000 |

## System Tick

_⚠️ The Sekai vs bitECS tick comparison is **not apples-to-apples**. Sekai's `tick()` runs the full pipeline (phase dispatch, deferred-op flushing, per-system runner invocation). bitECS has no equivalent scheduler, so its row is a plain function-call loop for reference only. Use these numbers to gauge Sekai's pipeline overhead, not to declare a winner._

| Task name | Latency avg (ns) | Latency med (ns) | Throughput avg (ops/s) | Throughput med (ops/s) | Samples |
| --- | --- | --- | --- | --- | --- |
| Sekai: tick 1 system [full pipeline, 10k] | 9810.3 ± 0.03% | 9791.0 ± 41.00 | 102108 ± 0.02% | 102135 ± 429 | 101935 |
| bitECS: plain function loop [no pipeline, 10k] | 9748.3 ± 0.04% | 9708.0 ± 41.00 | 102787 ± 0.02% | 103008 ± 437 | 102583 |
| Sekai: tick 5 systems [Sekai-only, 10k] | 9857.9 ± 0.05% | 9792.0 ± 42.00 | 101817 ± 0.03% | 102124 ± 436 | 101442 |
| Sekai: deferred ops flush (100 batched) [Sekai-only] | 6717.0 ± 0.16% | 6625.0 ± 125.00 | 149999 ± 0.03% | 150943 ± 2903 | 148876 |

## Iteration (Real ECS Pattern)

_Closest to real-world game-loop workloads: query once, read component data, write component data. Typed-array backing means both libraries should be in the same ballpark; delta here reflects query-access and iteration overhead._

| Task name | Latency avg (ns) | Latency med (ns) | Throughput avg (ops/s) | Throughput med (ops/s) | Samples |
| --- | --- | --- | --- | --- | --- |
| Sekai: query + update 10k (pos += vel) | 7125.7 ± 0.04% | 7084.0 ± 41.00 | 140681 ± 0.02% | 141163 ± 812 | 140338 |
| bitECS: query + update 10k (pos += vel) | 7126.8 ± 0.04% | 7084.0 ± 41.00 | 140668 ± 0.02% | 141163 ± 812 | 140315 |
| Sekai: multi-component iteration (3 stores, 10k) | 7157.8 ± 0.41% | 7042.0 ± 42.00 | 141948 ± 0.03% | 142005 ± 852 | 139709 |
| bitECS: multi-component iteration (3 stores, 10k) | 7085.8 ± 0.04% | 7042.0 ± 1.00 | 141566 ± 0.02% | 142005 ± 20 | 141128 |

## Fragmentation

_46k entities created across 16 archetypes (via modular tag composition), then half randomly deleted (deterministic LCG seed = 12345, same victim set on both sides). Measures iteration across many fragmented archetypes — the stress test closest to a mature game scene._

| Task name | Latency avg (ns) | Latency med (ns) | Throughput avg (ops/s) | Throughput med (ops/s) | Samples |
| --- | --- | --- | --- | --- | --- |
| Sekai: fragmented iteration (23k alive, 16 archetypes) | 51598 ± 0.10% | 52292 ± 2125.0 | 19461 ± 0.09% | 19123 ± 761 | 19381 |
| bitECS: fragmented iteration (23k alive, 16 archetypes) | 39569 ± 0.18% | 40417 ± 4500.0 | 25827 ± 0.19% | 24742 ± 2520 | 25273 |

---
_Reproduce locally with `pnpm run bench`. See `src/benchmarks/bench.ts` for workload definitions._
