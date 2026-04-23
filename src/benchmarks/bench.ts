import { Bench } from "tinybench";
import {
   createWorld,
   addEntity,
   removeEntity,
   addComponent,
   removeComponent,
   query,
} from "bitecs";
import { Sekai } from "../core/world";
import { System, PhaseTypes } from "../core/system";
import type { TickFunction } from "../core/types";
import {
   defineComponent,
   Types,
   type ComponentDefinition,
} from "../core/component";
import {
   captureWorldSnapshot,
   restoreWorldSnapshot,
} from "../core/serialization";

// ─── Environment detection ──────────────────────────────────────────────────
const IS_NODE =
   typeof process !== "undefined" &&
   process.versions != null &&
   process.versions.node != null;

// ─── Shared Config ──────────────────────────────────────────────────────────
const BENCH_TIME = 1000;
const WARMUP_TIME = 200;
const OUTPUT_PATH = "./benchmarks/latest-results.md";

function benchDefaults(name: string) {
   return new Bench({ name, time: BENCH_TIME, warmupTime: WARMUP_TIME });
}

// ─── Component definitions for benchmarks ───────────────────────────────────
const Position = defineComponent({
   name: "Position",
   description: "XY position",
   schema: { x: Types.f32, y: Types.f32 },
});

const Velocity = defineComponent({
   name: "Velocity",
   description: "XY velocity",
   schema: { vx: Types.f32, vy: Types.f32 },
});

const Health = defineComponent({
   name: "Health",
   description: "Health points",
   schema: { hp: Types.f32, maxHp: Types.f32 },
});

// ─── Result collection ──────────────────────────────────────────────────────
interface BenchSection {
   name: string;
   notes?: string;
   bench: Bench;
}

const sections: BenchSection[] = [];

// ─── Result printer (console) ───────────────────────────────────────────────
function printResults(bench: Bench) {
   console.log(`\n━━━ ${bench.name} ━━━`);
   console.table(bench.table());

   console.log("\nDetailed:");
   for (const task of bench.tasks) {
      const r = task.result;
      if (!r || !("latency" in r)) continue;
      const opsPerSec = r.throughput.mean;
      const rme = r.latency.rme;
      console.log(
         `  ${task.name.padEnd(60)} ${formatNumber(opsPerSec)} ops/s  ` +
            `avg=${r.latency.mean.toFixed(4)}ms  ` +
            `samples=${r.latency.samplesCount}  ` +
            `RME=±${rme.toFixed(2)}%`,
      );
   }
}

function formatNumber(n: number): string {
   if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
   if (n >= 1_000) return (n / 1_000).toFixed(2) + "K";
   return n.toFixed(2);
}

// ─── Markdown writer (Node only) ────────────────────────────────────────────
function buildMarkdown(
   sections: BenchSection[],
   env: { node: string; platform: string; cpu: string; cores: number; memGB: string },
): string {
   const lines: string[] = [];

   lines.push(`# Sekai ECS — Benchmark Results`);
   lines.push("");
   lines.push(`_Generated ${new Date().toISOString()}_`);
   lines.push("");
   lines.push(`## Environment`);
   lines.push("");
   lines.push(`| Field | Value |`);
   lines.push(`| --- | --- |`);
   lines.push(`| Node | ${env.node} |`);
   lines.push(`| Platform | ${env.platform} |`);
   lines.push(`| CPU | ${env.cpu} (${env.cores} cores) |`);
   lines.push(`| Memory | ${env.memGB} GB |`);
   lines.push(`| Bench time | ${BENCH_TIME}ms per task |`);
   lines.push(`| Warmup | ${WARMUP_TIME}ms per task |`);
   lines.push("");

   lines.push(`## Methodology notes`);
   lines.push("");
   lines.push(
      `- Each task runs for ${BENCH_TIME}ms after a ${WARMUP_TIME}ms warmup.`,
   );
   lines.push(
      `- Numbers are reported as ops/sec (higher = better) and latency (lower = better).`,
   );
   lines.push(
      `- Sekai and bitECS are compared on equivalent workloads where the APIs align. Some Sekai features (deferred ops, serialization, tick pipeline) have no direct bitECS equivalent and are reported separately.`,
   );
   lines.push(
      `- Sekai's tick pipeline includes phase dispatch and deferred-op flushing; the bitECS comparison calls a plain function loop. They are not apples-to-apples and are labeled as such.`,
   );
   lines.push("");

   for (const section of sections) {
      lines.push(`## ${section.name}`);
      lines.push("");
      if (section.notes) {
         lines.push(`_${section.notes}_`);
         lines.push("");
      }

      const rows = section.bench.table();
      if (!rows || rows.length === 0) {
         lines.push(`_No results collected._`);
         lines.push("");
         continue;
      }

      const headers = Object.keys(rows[0] ?? {});
      lines.push(`| ${headers.join(" | ")} |`);
      lines.push(`| ${headers.map(() => "---").join(" | ")} |`);
      for (const row of rows) {
         const cells = headers.map((h) => {
            const v = (row as Record<string, unknown>)[h];
            if (v === null || v === undefined) return "";
            return String(v).replace(/\|/g, "\\|");
         });
         lines.push(`| ${cells.join(" | ")} |`);
      }
      lines.push("");
   }

   lines.push(`---`);
   lines.push(
      `_Reproduce locally with \`pnpm run bench\`. See \`src/benchmarks/bench.ts\` for workload definitions._`,
   );
   lines.push("");

   return lines.join("\n");
}

async function writeMarkdownNodeOnly(sections: BenchSection[]) {
   if (!IS_NODE) return;

   // Dynamic imports so bundlers (Vite in the browser) don't try to resolve
   // these when building for the browser.
   const [{ writeFileSync, mkdirSync }, { dirname }, os] = await Promise.all([
      import("node:fs"),
      import("node:path"),
      import("node:os"),
   ]);

   const env = {
      node: process.version,
      platform: `${process.platform} ${process.arch}`,
      cpu: os.cpus()[0]?.model ?? "unknown",
      cores: os.cpus().length,
      memGB: (os.totalmem() / 1024 / 1024 / 1024).toFixed(1),
   };

   const md = buildMarkdown(sections, env);
   try {
      mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
   } catch {
      // ignore
   }
   writeFileSync(OUTPUT_PATH, md, "utf8");
   console.log(`\n✓ Markdown written to ${OUTPUT_PATH}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// GROUP 1: Entity Lifecycle
// ═══════════════════════════════════════════════════════════════════════════════
async function runEntityLifecycle() {
   const bench = benchDefaults("Entity Lifecycle");

   const worldS = new Sekai();
   const bitWorld = createWorld();

   bench
      .add("Sekai: single create + destroy", () => {
         const eid = worldS.createEntity();
         worldS.destructEntity(eid);
      })
      .add("bitECS: single create + destroy", () => {
         const eid = addEntity(bitWorld);
         removeEntity(bitWorld, eid);
      })
      .add("Sekai: bulk create 10k entities (incl. world init)", () => {
         const w = new Sekai();
         for (let i = 0; i < 10_000; i++) w.createEntity();
      })
      .add("bitECS: bulk create 10k entities (incl. world init)", () => {
         const w = createWorld();
         for (let i = 0; i < 10_000; i++) addEntity(w);
      })
      .add("Sekai: bulk destroy 10k entities (incl. world init)", () => {
         const w = new Sekai();
         const eids: number[] = [];
         for (let i = 0; i < 10_000; i++) eids.push(w.createEntity());
         for (let i = 0; i < 10_000; i++) w.destructEntity(eids[i]);
      })
      .add("bitECS: bulk destroy 10k entities (incl. world init)", () => {
         const w = createWorld();
         const eids: number[] = [];
         for (let i = 0; i < 10_000; i++) eids.push(addEntity(w));
         for (let i = 0; i < 10_000; i++) removeEntity(w, eids[i]);
      })
      .add("Sekai: entity recycling (2x create/destroy)", () => {
         const eid1 = worldS.createEntity();
         worldS.destructEntity(eid1);
         const _eid2 = worldS.createEntity();
         worldS.destructEntity(_eid2);
      })
      .add("bitECS: entity recycling (2x create/destroy)", () => {
         const eid1 = addEntity(bitWorld);
         removeEntity(bitWorld, eid1);
         const _eid2 = addEntity(bitWorld);
         removeEntity(bitWorld, _eid2);
      });

   await bench.run();
   printResults(bench);
   sections.push({
      name: "Entity Lifecycle",
      notes:
         "Bulk tests include world construction per iteration (end-to-end bootstrap cost).",
      bench,
   });
}

// ═══════════════════════════════════════════════════════════════════════════════
// GROUP 2: Component Operations
// ═══════════════════════════════════════════════════════════════════════════════
async function runComponentOps() {
   const bench = benchDefaults("Component Operations");

   const worldS = new Sekai();
   worldS.ensureComponentBitFlag(Position);
   worldS.ensureComponentBitFlag(Velocity);
   worldS.ensureComponentBitFlag(Health);

   const bitWorld = createWorld({
      components: {
         Pos: { x: new Float32Array(50001), y: new Float32Array(50001) },
         Vel: { vx: new Float32Array(50001), vy: new Float32Array(50001) },
         Hp: { hp: new Float32Array(50001), maxHp: new Float32Array(50001) },
      },
   });
   const { Pos, Vel, Hp } = bitWorld.components;

   let sEid = worldS.createEntity();
   let bEid = addEntity(bitWorld);

   bench
      .add("Sekai: add + remove 1 component (pair)", () => {
         worldS.addComponent(sEid, Position);
         worldS.removeComponent(sEid, Position);
      })
      .add("bitECS: add + remove 1 component (pair)", () => {
         addComponent(bitWorld, bEid, Pos);
         removeComponent(bitWorld, bEid, Pos);
      })
      .add("Sekai: add + remove 3 components (pair)", () => {
         worldS.addComponent(sEid, Position);
         worldS.addComponent(sEid, Velocity);
         worldS.addComponent(sEid, Health);
         worldS.removeComponent(sEid, Position);
         worldS.removeComponent(sEid, Velocity);
         worldS.removeComponent(sEid, Health);
      })
      .add("bitECS: add + remove 3 components (pair)", () => {
         addComponent(bitWorld, bEid, Pos);
         addComponent(bitWorld, bEid, Vel);
         addComponent(bitWorld, bEid, Hp);
         removeComponent(bitWorld, bEid, Pos);
         removeComponent(bitWorld, bEid, Vel);
         removeComponent(bitWorld, bEid, Hp);
      })
      .add("Sekai: updateComponent (partial) [Sekai-only]", () => {
         worldS.addComponent(sEid, Position);
         worldS.updateComponent(sEid, Position, { x: 10 });
         worldS.removeComponent(sEid, Position);
      })
      .add("Sekai: hasComponent check", () => {
         worldS.hasComponent(sEid, Position);
      });

   await bench.run();
   printResults(bench);
   sections.push({
      name: "Component Operations",
      notes:
         "Add and remove are measured as pairs (symmetric setup/teardown per iteration). `updateComponent` and `hasComponent` are Sekai-only API shapes; no direct equivalent in bitECS (which exposes raw typed-array access instead).",
      bench,
   });
}

// ═══════════════════════════════════════════════════════════════════════════════
// GROUP 3: Query Performance
// ═══════════════════════════════════════════════════════════════════════════════
async function runQueryPerf() {
   const bench = benchDefaults("Query Performance");
   const ENTITY_COUNT = 10_000;

   const worldS = new Sekai();
   worldS.ensureComponentBitFlag(Position);
   worldS.ensureComponentBitFlag(Velocity);
   worldS.ensureComponentBitFlag(Health);

   for (let i = 0; i < ENTITY_COUNT; i++) {
      const eid = worldS.createEntity();
      worldS.addComponent(eid, Position);
      worldS.addComponent(eid, Velocity);
   }
   const sekaiQuery = worldS.defineQuery({ all: [Position, Velocity] });
   void sekaiQuery.entities;

   const bitWorld = createWorld({
      components: {
         Pos: {
            x: new Float32Array(ENTITY_COUNT + 1),
            y: new Float32Array(ENTITY_COUNT + 1),
         },
         Vel: {
            vx: new Float32Array(ENTITY_COUNT + 1),
            vy: new Float32Array(ENTITY_COUNT + 1),
         },
         Hp: { hp: new Float32Array(ENTITY_COUNT + 1) },
      },
   });
   const { Pos, Vel, Hp } = bitWorld.components;
   for (let i = 0; i < ENTITY_COUNT; i++) {
      const eid = addEntity(bitWorld);
      addComponent(bitWorld, eid, Pos);
      addComponent(bitWorld, eid, Vel);
   }
   const bitQ = query(bitWorld, [Pos, Vel]);

   bench
      .add("Sekai: query iteration (10k entities)", () => {
         const ents = sekaiQuery.entities;
         let sum = 0;
         for (let i = 0; i < ents.length; i++) sum += ents[i];
      })
      .add("bitECS: query iteration (10k entities)", () => {
         const ents = bitQ;
         let sum = 0;
         for (let i = 0; i < ents.length; i++) sum += ents[i];
      });

   // Mixed archetypes
   const worldM = new Sekai();
   worldM.ensureComponentBitFlag(Position);
   worldM.ensureComponentBitFlag(Velocity);
   worldM.ensureComponentBitFlag(Health);
   for (let i = 0; i < ENTITY_COUNT; i++) {
      const eid = worldM.createEntity();
      worldM.addComponent(eid, Position);
      worldM.addComponent(eid, Velocity);
      if (i % 2 === 0) worldM.addComponent(eid, Health);
   }
   const mixedQuery = worldM.defineQuery({ all: [Position, Velocity] });
   void mixedQuery.entities;

   const bitWorldM = createWorld({
      components: {
         Pos2: { x: new Float32Array(ENTITY_COUNT + 1) },
         Vel2: { vx: new Float32Array(ENTITY_COUNT + 1) },
         Hp2: { hp: new Float32Array(ENTITY_COUNT + 1) },
      },
   });
   const { Pos2, Vel2, Hp2 } = bitWorldM.components;
   for (let i = 0; i < ENTITY_COUNT; i++) {
      const eid = addEntity(bitWorldM);
      addComponent(bitWorldM, eid, Pos2);
      addComponent(bitWorldM, eid, Vel2);
      if (i % 2 === 0) addComponent(bitWorldM, eid, Hp2);
   }
   const bitMixedQ = query(bitWorldM, [Pos2, Vel2]);

   bench
      .add("Sekai: mixed archetypes query (10k, 2 archetypes)", () => {
         const ents = mixedQuery.entities;
         let sum = 0;
         for (let i = 0; i < ents.length; i++) sum += ents[i];
      })
      .add("bitECS: mixed archetypes query (10k, 2 archetypes)", () => {
         const ents = bitMixedQ;
         let sum = 0;
         for (let i = 0; i < ents.length; i++) sum += ents[i];
      });

   // Structural change + re-query
   const changerS = worldS.createEntity();
   worldS.addComponent(changerS, Position);
   worldS.addComponent(changerS, Velocity);

   const changerB = addEntity(bitWorld);
   addComponent(bitWorld, changerB, Pos);
   addComponent(bitWorld, changerB, Vel);

   bench
      .add("Sekai: structural change + re-query", () => {
         worldS.addComponent(changerS, Health);
         void sekaiQuery.entities.length;
         worldS.removeComponent(changerS, Health);
         void sekaiQuery.entities.length;
      })
      .add("bitECS: structural change + re-query", () => {
         addComponent(bitWorld, changerB, Hp);
         void bitQ.length;
         removeComponent(bitWorld, changerB, Hp);
         void bitQ.length;
      });

   // defineQuery: first vs cached
   bench
      .add("Sekai: defineQuery (cached hit)", () => {
         worldS.defineQuery({ all: [Position, Velocity] });
      })
      .add("bitECS: query() call (re-execute)", () => {
         query(bitWorld, [Pos, Vel]);
      });

   await bench.run();
   printResults(bench);
   sections.push({
      name: "Query Performance",
      notes:
         "Mixed archetype tests populate 2 archetypes to force archetype-fan-out on Sekai's query. `defineQuery (cached hit)` measures cache lookup cost vs. bitECS's `query()` which re-executes on every call.",
      bench,
   });
}

// ═══════════════════════════════════════════════════════════════════════════════
// GROUP 4: System Tick
// ═══════════════════════════════════════════════════════════════════════════════
async function runSystemTick() {
   const bench = benchDefaults("System Tick");
   const ENTITY_COUNT = 10_000;

   const worldS1 = new Sekai();
   for (let i = 0; i < ENTITY_COUNT; i++) {
      const eid = worldS1.createEntity();
      worldS1.addComponent(eid, Position);
      worldS1.addComponent(eid, Velocity);
   }
   worldS1.getStore(Position);
   worldS1.getStore(Velocity);

   class MoveSystem extends System {
      phase = PhaseTypes.preRender;
      enabled = true;
      readonly name = "MoveSystem";
      createRunner(world: Sekai): TickFunction | undefined {
         const q = world.defineQuery({ all: [Position, Velocity] });
         const ps = world.getStore(Position);
         const vs = world.getStore(Velocity);
         return (_dt: number) => {
            const ents = q.entities;
            for (let i = 0; i < ents.length; i++) {
               const e = ents[i];
               ps.x[e] += vs.vx[e];
               ps.y[e] += vs.vy[e];
            }
         };
      }
      init() {}
      destroy() {}
   }
   worldS1.addSystem(MoveSystem, () => new MoveSystem());
   worldS1.tick(16);

   const bitWorld1 = createWorld({
      components: {
         Pos: {
            x: new Float32Array(ENTITY_COUNT + 1),
            y: new Float32Array(ENTITY_COUNT + 1),
         },
         Vel: {
            vx: new Float32Array(ENTITY_COUNT + 1),
            vy: new Float32Array(ENTITY_COUNT + 1),
         },
      },
   });
   const bPos1 = bitWorld1.components.Pos;
   const bVel1 = bitWorld1.components.Vel;
   for (let i = 0; i < ENTITY_COUNT; i++) {
      const eid = addEntity(bitWorld1);
      addComponent(bitWorld1, eid, bPos1);
      addComponent(bitWorld1, eid, bVel1);
   }
   const bitQ1 = query(bitWorld1, [bPos1, bVel1]);

   const bitMoveSystem = () => {
      for (let i = 0; i < bitQ1.length; i++) {
         const e = bitQ1[i];
         bPos1.x[e] += bVel1.vx[e];
         bPos1.y[e] += bVel1.vy[e];
      }
   };

   bench
      .add("Sekai: tick 1 system [full pipeline, 10k]", () => {
         worldS1.tick(16);
      })
      .add("bitECS: plain function loop [no pipeline, 10k]", () => {
         bitMoveSystem();
      });

   const worldS5 = new Sekai();
   for (let i = 0; i < ENTITY_COUNT; i++) {
      const eid = worldS5.createEntity();
      worldS5.addComponent(eid, Position);
      worldS5.addComponent(eid, Velocity);
   }

   class NoopSystem1 extends System {
      phase = PhaseTypes.preRender;
      enabled = true;
      readonly name = "Noop1";
      createRunner(world: Sekai) {
         const q = world.defineQuery({ all: [Position] });
         return () => { void q.entities.length; };
      }
      init() {}
      destroy() {}
   }
   class NoopSystem2 extends System {
      phase = PhaseTypes.preRender;
      enabled = true;
      readonly name = "Noop2";
      createRunner(world: Sekai) {
         const q = world.defineQuery({ all: [Velocity] });
         return () => { void q.entities.length; };
      }
      init() {}
      destroy() {}
   }
   class NoopSystem3 extends System {
      phase = PhaseTypes.render;
      enabled = true;
      readonly name = "Noop3";
      createRunner(world: Sekai) {
         const q = world.defineQuery({ all: [Position, Velocity] });
         return () => { void q.entities.length; };
      }
      init() {}
      destroy() {}
   }
   class NoopSystem4 extends System {
      phase = PhaseTypes.render;
      enabled = true;
      readonly name = "Noop4";
      createRunner(world: Sekai) {
         const q = world.defineQuery({ all: [Position] });
         return () => { void q.entities.length; };
      }
      init() {}
      destroy() {}
   }

   worldS5.addSystem(MoveSystem, () => new MoveSystem());
   worldS5.addSystem(NoopSystem1, () => new NoopSystem1());
   worldS5.addSystem(NoopSystem2, () => new NoopSystem2());
   worldS5.addSystem(NoopSystem3, () => new NoopSystem3());
   worldS5.addSystem(NoopSystem4, () => new NoopSystem4());
   worldS5.tick(16);

   bench.add("Sekai: tick 5 systems [Sekai-only, 10k]", () => {
      worldS5.tick(16);
   });

   const worldD = new Sekai();
   worldD.ensureComponentBitFlag(Position);
   worldD.ensureComponentBitFlag(Velocity);
   const deferEids: number[] = [];
   for (let i = 0; i < 200; i++) {
      const eid = worldD.createEntity();
      worldD.addComponent(eid, Position);
      deferEids.push(eid);
   }

   bench.add("Sekai: deferred ops flush (100 batched) [Sekai-only]", () => {
      worldD.deferring = true;
      for (let i = 0; i < 100; i++) {
         worldD.addComponent(deferEids[i], Velocity);
      }
      worldD.deferring = false;
      worldD.flushDeferredOps();
      for (let i = 0; i < 100; i++) {
         worldD.removeComponent(deferEids[i], Velocity);
      }
   });

   await bench.run();
   printResults(bench);
   sections.push({
      name: "System Tick",
      notes:
         "⚠️ The Sekai vs bitECS tick comparison is **not apples-to-apples**. Sekai's `tick()` runs the full pipeline (phase dispatch, deferred-op flushing, per-system runner invocation). bitECS has no equivalent scheduler, so its row is a plain function-call loop for reference only. Use these numbers to gauge Sekai's pipeline overhead, not to declare a winner.",
      bench,
   });
}

// ═══════════════════════════════════════════════════════════════════════════════
// GROUP 5: Iteration (Real ECS Pattern)
// ═══════════════════════════════════════════════════════════════════════════════
async function runIteration() {
   const bench = benchDefaults("Iteration (Real ECS Pattern)");
   const ENTITY_COUNT = 10_000;

   const worldS = new Sekai();
   for (let i = 0; i < ENTITY_COUNT; i++) {
      const eid = worldS.createEntity();
      worldS.addComponent(eid, Position);
      worldS.addComponent(eid, Velocity);
   }
   const sQuery = worldS.defineQuery({ all: [Position, Velocity] });
   const posS = worldS.getStore(Position);
   const velS = worldS.getStore(Velocity);
   const sEnts = sQuery.entities;
   for (let i = 0; i < sEnts.length; i++) {
      velS.vx[sEnts[i]] = 1.0;
      velS.vy[sEnts[i]] = 0.5;
   }

   const bitWorld = createWorld({
      components: {
         Pos: {
            x: new Float32Array(ENTITY_COUNT + 1),
            y: new Float32Array(ENTITY_COUNT + 1),
         },
         Vel: {
            vx: new Float32Array(ENTITY_COUNT + 1),
            vy: new Float32Array(ENTITY_COUNT + 1),
         },
      },
   });
   const bPos = bitWorld.components.Pos;
   const bVel = bitWorld.components.Vel;
   for (let i = 0; i < ENTITY_COUNT; i++) {
      const eid = addEntity(bitWorld);
      addComponent(bitWorld, eid, bPos);
      addComponent(bitWorld, eid, bVel);
      bVel.vx[eid] = 1.0;
      bVel.vy[eid] = 0.5;
   }
   const bitQ = query(bitWorld, [bPos, bVel]);

   bench
      .add("Sekai: query + update 10k (pos += vel)", () => {
         const ents = sQuery.entities;
         for (let i = 0; i < ents.length; i++) {
            const e = ents[i];
            posS.x[e] += velS.vx[e];
            posS.y[e] += velS.vy[e];
         }
      })
      .add("bitECS: query + update 10k (pos += vel)", () => {
         for (let i = 0; i < bitQ.length; i++) {
            const e = bitQ[i];
            bPos.x[e] += bVel.vx[e];
            bPos.y[e] += bVel.vy[e];
         }
      });

   const worldM = new Sekai();
   for (let i = 0; i < ENTITY_COUNT; i++) {
      const eid = worldM.createEntity();
      worldM.addComponent(eid, Position);
      worldM.addComponent(eid, Velocity);
      worldM.addComponent(eid, Health);
   }
   const mQuery = worldM.defineQuery({ all: [Position, Velocity, Health] });
   const mPos = worldM.getStore(Position);
   const mVel = worldM.getStore(Velocity);
   const mHp = worldM.getStore(Health);
   const mEnts = mQuery.entities;
   for (let i = 0; i < mEnts.length; i++) {
      mVel.vx[mEnts[i]] = 1.0;
      mHp.hp[mEnts[i]] = 100;
   }

   const bitWorldM = createWorld({
      components: {
         Pos: {
            x: new Float32Array(ENTITY_COUNT + 1),
            y: new Float32Array(ENTITY_COUNT + 1),
         },
         Vel: {
            vx: new Float32Array(ENTITY_COUNT + 1),
            vy: new Float32Array(ENTITY_COUNT + 1),
         },
         Hp: {
            hp: new Float32Array(ENTITY_COUNT + 1),
            maxHp: new Float32Array(ENTITY_COUNT + 1),
         },
      },
   });
   const bPosM = bitWorldM.components.Pos;
   const bVelM = bitWorldM.components.Vel;
   const bHpM = bitWorldM.components.Hp;
   for (let i = 0; i < ENTITY_COUNT; i++) {
      const eid = addEntity(bitWorldM);
      addComponent(bitWorldM, eid, bPosM);
      addComponent(bitWorldM, eid, bVelM);
      addComponent(bitWorldM, eid, bHpM);
      bVelM.vx[eid] = 1.0;
      bHpM.hp[eid] = 100;
   }
   const bitQM = query(bitWorldM, [bPosM, bVelM, bHpM]);

   bench
      .add("Sekai: multi-component iteration (3 stores, 10k)", () => {
         const ents = mQuery.entities;
         for (let i = 0; i < ents.length; i++) {
            const e = ents[i];
            mPos.x[e] += mVel.vx[e] * (mHp.hp[e] / 100);
         }
      })
      .add("bitECS: multi-component iteration (3 stores, 10k)", () => {
         for (let i = 0; i < bitQM.length; i++) {
            const e = bitQM[i];
            bPosM.x[e] += bVelM.vx[e] * (bHpM.hp[e] / 100);
         }
      });

   await bench.run();
   printResults(bench);
   sections.push({
      name: "Iteration (Real ECS Pattern)",
      notes:
         "Closest to real-world game-loop workloads: query once, read component data, write component data. Typed-array backing means both libraries should be in the same ballpark; delta here reflects query-access and iteration overhead.",
      bench,
   });
}

// ═══════════════════════════════════════════════════════════════════════════════
// GROUP 6: Serialization (Sekai-only)
// ═══════════════════════════════════════════════════════════════════════════════
async function runSerialization() {
   const bench = benchDefaults("Serialization (Sekai-only)");
   const ENTITY_COUNT = 1_000;

   const worldS = new Sekai();
   worldS.ensureComponentBitFlag(Position);
   worldS.ensureComponentBitFlag(Velocity);
   worldS.ensureComponentBitFlag(Health);

   for (let i = 0; i < ENTITY_COUNT; i++) {
      const eid = worldS.createEntity();
      worldS.addComponent(eid, Position);
      worldS.addComponent(eid, Velocity);
      worldS.addComponent(eid, Health);
      worldS.updateComponent(eid, Position, { x: i * 1.5, y: i * 2.5 });
      worldS.updateComponent(eid, Velocity, { vx: 1.0, vy: 0.5 });
      worldS.updateComponent(eid, Health, { hp: 100, maxHp: 100 });
   }

   const snapshot = captureWorldSnapshot(worldS);

   bench
      .add("Sekai: captureWorldSnapshot (1k entities, 3 components)", () => {
         captureWorldSnapshot(worldS);
      })
      .add("Sekai: restoreWorldSnapshot (1k entities, 3 components)", () => {
         const freshWorld = new Sekai();
         freshWorld.ensureComponentBitFlag(Position);
         freshWorld.ensureComponentBitFlag(Velocity);
         freshWorld.ensureComponentBitFlag(Health);
         freshWorld.getStore(Position);
         freshWorld.getStore(Velocity);
         freshWorld.getStore(Health);
         restoreWorldSnapshot(freshWorld, snapshot);
      });

   await bench.run();
   printResults(bench);
   sections.push({
      name: "Serialization (Sekai-only)",
      notes:
         "No bitECS equivalent; snapshot/restore is a Sekai feature. Reported for reference on Sekai's own overhead.",
      bench,
   });
}

// ═══════════════════════════════════════════════════════════════════════════════
// GROUP 7: Fragmentation
// ═══════════════════════════════════════════════════════════════════════════════
async function runFragmentation() {
   const bench = benchDefaults(
      "Fragmentation (46k create, 23k delete, iterate)",
   );
   const ENTITY_COUNT = 46_000;

   const Tag1 = defineComponent({
      name: "FTag1",
      description: "tag",
      schema: { v: Types.u8 },
   });
   const Tag2 = defineComponent({
      name: "FTag2",
      description: "tag",
      schema: { v: Types.u8 },
   });
   const Tag3 = defineComponent({
      name: "FTag3",
      description: "tag",
      schema: { v: Types.u8 },
   });

   const allDefs: ComponentDefinition[] = [
      Position,
      Velocity,
      Health,
      Tag1,
      Tag2,
      Tag3,
   ];

   function lcgShuffle(arr: number[]) {
      const out = arr.slice();
      let s = 12345;
      for (let i = out.length - 1; i > 0; i--) {
         s = (s * 1103515245 + 12345) & 0x7fffffff;
         const j = s % (i + 1);
         const tmp = out[i];
         out[i] = out[j];
         out[j] = tmp;
      }
      return out;
   }

   const worldS = new Sekai();
   allDefs.forEach((d) => worldS.ensureComponentBitFlag(d));

   const sekaiEids: number[] = [];
   for (let i = 0; i < ENTITY_COUNT; i++) {
      const eid = worldS.createEntity();
      worldS.addComponent(eid, Position);
      worldS.addComponent(eid, Velocity);
      if (i % 2 === 0) worldS.addComponent(eid, Health);
      if (i % 3 === 0) worldS.addComponent(eid, Tag1);
      if (i % 5 === 0) worldS.addComponent(eid, Tag2);
      if (i % 7 === 0) worldS.addComponent(eid, Tag3);
      sekaiEids.push(eid);
   }

   const toDeleteS = lcgShuffle(sekaiEids).slice(0, ENTITY_COUNT / 2);
   for (const eid of toDeleteS) worldS.destructEntity(eid);

   const posS = worldS.getStore(Position);
   const velS = worldS.getStore(Velocity);
   const fragQueryS = worldS.defineQuery({ all: [Position, Velocity] });
   void fragQueryS.entities;

   const bitWorld = createWorld({
      components: {
         FPos: {
            x: new Float32Array(ENTITY_COUNT + 1),
            y: new Float32Array(ENTITY_COUNT + 1),
         },
         FVel: {
            vx: new Float32Array(ENTITY_COUNT + 1),
            vy: new Float32Array(ENTITY_COUNT + 1),
         },
         FHp: { hp: new Float32Array(ENTITY_COUNT + 1) },
         FT1: { v: new Uint8Array(ENTITY_COUNT + 1) },
         FT2: { v: new Uint8Array(ENTITY_COUNT + 1) },
         FT3: { v: new Uint8Array(ENTITY_COUNT + 1) },
      },
   });
   const { FPos, FVel, FHp, FT1, FT2, FT3 } = bitWorld.components;

   const bitEids: number[] = [];
   for (let i = 0; i < ENTITY_COUNT; i++) {
      const eid = addEntity(bitWorld);
      addComponent(bitWorld, eid, FPos);
      addComponent(bitWorld, eid, FVel);
      if (i % 2 === 0) addComponent(bitWorld, eid, FHp);
      if (i % 3 === 0) addComponent(bitWorld, eid, FT1);
      if (i % 5 === 0) addComponent(bitWorld, eid, FT2);
      if (i % 7 === 0) addComponent(bitWorld, eid, FT3);
      bitEids.push(eid);
   }

   const toDeleteB = lcgShuffle(bitEids).slice(0, ENTITY_COUNT / 2);
   for (const eid of toDeleteB) removeEntity(bitWorld, eid);

   const bitFragQ = query(bitWorld, [FPos, FVel]);

   bench
      .add("Sekai: fragmented iteration (23k alive, 16 archetypes)", () => {
         const ents = fragQueryS.entities;
         for (let i = 0; i < ents.length; i++) {
            const e = ents[i];
            posS.x[e] += velS.vx[e];
            posS.y[e] += velS.vy[e];
         }
      })
      .add("bitECS: fragmented iteration (23k alive, 16 archetypes)", () => {
         const ents = bitFragQ;
         for (let i = 0; i < ents.length; i++) {
            const e = ents[i];
            FPos.x[e] += FVel.vx[e];
            FPos.y[e] += FVel.vy[e];
         }
      });

   await bench.run();
   printResults(bench);
   sections.push({
      name: "Fragmentation",
      notes:
         "46k entities created across 16 archetypes (via modular tag composition), then half randomly deleted (deterministic LCG seed = 12345, same victim set on both sides). Measures iteration across many fragmented archetypes — the stress test closest to a mature game scene.",
      bench,
   });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════════════════════
async function runAll() {
   console.log("Sekai ECS Benchmark Suite");
   console.log("═".repeat(60));
   console.log(`Environment: ${IS_NODE ? "Node" : "Browser"}`);
   console.log(`Bench time: ${BENCH_TIME}ms | Warmup: ${WARMUP_TIME}ms`);
   console.log("═".repeat(60));

   await runEntityLifecycle();
   await runComponentOps();
   await runQueryPerf();
   await runSystemTick();
   await runIteration();
   // await runSerialization();
   await runFragmentation();

   console.log("\n" + "═".repeat(60));
   console.log("All benchmarks complete.");

   await writeMarkdownNodeOnly(sections);
}

runAll();