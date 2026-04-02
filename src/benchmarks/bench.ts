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

// declare const process: { version: string; platform: string; arch: string };

// ─── Shared Config ──────────────────────────────────────────────────────────
const BENCH_TIME = 1000;
const WARMUP_TIME = 200;

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

// ─── Result printer ─────────────────────────────────────────────────────────
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
         `  ${task.name.padEnd(55)} ${formatNumber(opsPerSec)} ops/s  ` +
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

// ═══════════════════════════════════════════════════════════════════════════════
// GROUP 1: Entity Lifecycle
// ═══════════════════════════════════════════════════════════════════════════════
async function runEntityLifecycle() {
   const bench = benchDefaults("Entity Lifecycle");

   // --- Sekai setup ---
   const worldS = new Sekai();

   // --- bitECS setup ---
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
      .add("Sekai: bulk create 10k entities", () => {
         const w = new Sekai();
         for (let i = 0; i < 10_000; i++) w.createEntity();
      })
      .add("bitECS: bulk create 10k entities", () => {
         const w = createWorld();
         for (let i = 0; i < 10_000; i++) addEntity(w);
      })
      .add("Sekai: bulk destroy 10k entities", () => {
         const w = new Sekai();
         const eids: number[] = [];
         for (let i = 0; i < 10_000; i++) eids.push(w.createEntity());
         for (let i = 0; i < 10_000; i++) w.destructEntity(eids[i]);
      })
      .add("bitECS: bulk destroy 10k entities", () => {
         const w = createWorld();
         const eids: number[] = [];
         for (let i = 0; i < 10_000; i++) eids.push(addEntity(w));
         for (let i = 0; i < 10_000; i++) removeEntity(w, eids[i]);
      })
      .add("Sekai: entity recycling (create/destroy/create)", () => {
         const eid1 = worldS.createEntity();
         worldS.destructEntity(eid1);
         const _eid2 = worldS.createEntity();
         worldS.destructEntity(_eid2);
      })
      .add("bitECS: entity recycling (create/destroy/create)", () => {
         const eid1 = addEntity(bitWorld);
         removeEntity(bitWorld, eid1);
         const _eid2 = addEntity(bitWorld);
         removeEntity(bitWorld, _eid2);
      });

   await bench.run();
   printResults(bench);
}

// ═══════════════════════════════════════════════════════════════════════════════
// GROUP 2: Component Operations
// ═══════════════════════════════════════════════════════════════════════════════
async function runComponentOps() {
   const bench = benchDefaults("Component Operations");

   // --- Sekai setup ---
   const worldS = new Sekai();
   worldS.ensureComponentBitFlag(Position);
   worldS.ensureComponentBitFlag(Velocity);
   worldS.ensureComponentBitFlag(Health);

   // --- bitECS setup ---
   const bitWorld = createWorld({
      components: {
         Pos: { x: new Float32Array(50001), y: new Float32Array(50001) },
         Vel: { vx: new Float32Array(50001), vy: new Float32Array(50001) },
         Hp: { hp: new Float32Array(50001), maxHp: new Float32Array(50001) },
      },
   });
   const { Pos, Vel, Hp } = bitWorld.components;

   // Pre-create entities for reuse
   let sEid = worldS.createEntity();
   let bEid = addEntity(bitWorld);

   bench
      .add("Sekai: addComponent (single)", () => {
         worldS.addComponent(sEid, Position);
         worldS.removeComponent(sEid, Position);
      })
      .add("bitECS: addComponent (single)", () => {
         addComponent(bitWorld, bEid, Pos);
         removeComponent(bitWorld, bEid, Pos);
      })
      .add("Sekai: add 3 components", () => {
         worldS.addComponent(sEid, Position);
         worldS.addComponent(sEid, Velocity);
         worldS.addComponent(sEid, Health);
         worldS.removeComponent(sEid, Position);
         worldS.removeComponent(sEid, Velocity);
         worldS.removeComponent(sEid, Health);
      })
      .add("bitECS: add 3 components", () => {
         addComponent(bitWorld, bEid, Pos);
         addComponent(bitWorld, bEid, Vel);
         addComponent(bitWorld, bEid, Hp);
         removeComponent(bitWorld, bEid, Pos);
         removeComponent(bitWorld, bEid, Vel);
         removeComponent(bitWorld, bEid, Hp);
      })
      .add("Sekai: removeComponent", () => {
         worldS.addComponent(sEid, Position);
         worldS.removeComponent(sEid, Position);
      })
      .add("bitECS: removeComponent", () => {
         addComponent(bitWorld, bEid, Pos);
         removeComponent(bitWorld, bEid, Pos);
      })
      .add("Sekai: updateComponent (partial)", () => {
         worldS.addComponent(sEid, Position);
         worldS.updateComponent(sEid, Position, { x: 10 });
         worldS.removeComponent(sEid, Position);
      })
      .add("Sekai: hasComponent check", () => {
         worldS.hasComponent(sEid, Position);
      })
      .add("bitECS: hasComponent check (bitmask)", () => {
         // bitECS v0.4: check via query or manual bitmask; use addComponent idempotency
         void Pos.x[bEid];
      });

   await bench.run();
   printResults(bench);
}

// ═══════════════════════════════════════════════════════════════════════════════
// GROUP 3: Query Performance
// ═══════════════════════════════════════════════════════════════════════════════
async function runQueryPerf() {
   const bench = benchDefaults("Query Performance");
   const ENTITY_COUNT = 10_000;

   // --- Sekai setup ---
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
   // Force initial computation
   void sekaiQuery.entities;

   // --- bitECS setup ---
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

   // Mixed archetypes: add Health to half entities → 2 archetypes
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
}

// ═══════════════════════════════════════════════════════════════════════════════
// GROUP 4: System Tick
// ═══════════════════════════════════════════════════════════════════════════════
async function runSystemTick() {
   const bench = benchDefaults("System Tick");
   const ENTITY_COUNT = 10_000;

   // --- Sekai: 1 system ---
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
   worldS1.addSystem(MoveSystem);
   // Warm up runner build
   worldS1.tick(16);

   // --- bitECS: 1 system ---
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
      .add("Sekai: tick 1 system (10k entities)", () => {
         worldS1.tick(16);
      })
      .add("bitECS: tick 1 system (10k entities)", () => {
         bitMoveSystem();
      });

   // --- Sekai: 5 systems ---
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
         return () => {
            void q.entities.length;
         };
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
         return () => {
            void q.entities.length;
         };
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
         return () => {
            void q.entities.length;
         };
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
         return () => {
            void q.entities.length;
         };
      }
      init() {}
      destroy() {}
   }

   worldS5.addSystem(MoveSystem);
   worldS5.addSystem(NoopSystem1);
   worldS5.addSystem(NoopSystem2);
   worldS5.addSystem(NoopSystem3);
   worldS5.addSystem(NoopSystem4);
   worldS5.tick(16); // warm up

   bench.add("Sekai: tick 5 systems (10k entities)", () => {
      worldS5.tick(16);
   });

   // --- Deferred ops ---
   const worldD = new Sekai();
   worldD.ensureComponentBitFlag(Position);
   worldD.ensureComponentBitFlag(Velocity);
   // Pre-create entities
   const deferEids: number[] = [];
   for (let i = 0; i < 200; i++) {
      const eid = worldD.createEntity();
      worldD.addComponent(eid, Position);
      deferEids.push(eid);
   }

   bench.add("Sekai: deferred ops flush (100 batched)", () => {
      worldD.deferring = true;
      for (let i = 0; i < 100; i++) {
         worldD.addComponent(deferEids[i], Velocity);
      }
      worldD.deferring = false;
      worldD.flushDeferredOps();
      // Clean up for next iteration
      for (let i = 0; i < 100; i++) {
         worldD.removeComponent(deferEids[i], Velocity);
      }
   });

   await bench.run();
   printResults(bench);
}

// ═══════════════════════════════════════════════════════════════════════════════
// GROUP 5: Real ECS Iteration Pattern
// ═══════════════════════════════════════════════════════════════════════════════
async function runIteration() {
   const bench = benchDefaults("Iteration (Real ECS)");
   const ENTITY_COUNT = 10_000;

   // --- Sekai: query + read/write ---
   const worldS = new Sekai();
   for (let i = 0; i < ENTITY_COUNT; i++) {
      const eid = worldS.createEntity();
      worldS.addComponent(eid, Position);
      worldS.addComponent(eid, Velocity);
   }
   const sQuery = worldS.defineQuery({ all: [Position, Velocity] });
   const posS = worldS.getStore(Position);
   const velS = worldS.getStore(Velocity);
   // Initialize velocity
   const sEnts = sQuery.entities;
   for (let i = 0; i < sEnts.length; i++) {
      velS.vx[sEnts[i]] = 1.0;
      velS.vy[sEnts[i]] = 0.5;
   }

   // --- bitECS: query + read/write ---
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

   // Multi-component: read from 2 stores, write to 1
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
}

// ═══════════════════════════════════════════════════════════════════════════════
// GROUP 6: Serialization (Sekai-only)
// ═══════════════════════════════════════════════════════════════════════════════
async function runSerialization() {
   const bench = benchDefaults("Serialization (Sekai-only)");
   const ENTITY_COUNT = 1_000;

   // Setup: world with 1k entities, each with 3 components
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

   // Pre-capture a snapshot for restore benchmark
   const snapshot = captureWorldSnapshot(worldS);

   bench
      .add("Sekai: captureWorldSnapshot (1k entities, 3 components)", () => {
         captureWorldSnapshot(worldS);
      })
      .add("Sekai: restoreWorldSnapshot (1k entities, 3 components)", () => {
         const freshWorld = new Sekai();
         // Register component definitions so restore can find them
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
}

// ═══════════════════════════════════════════════════════════════════════════════
// GROUP 7: Fragmentation
// ═══════════════════════════════════════════════════════════════════════════════
async function runFragmentation() {
   const bench = benchDefaults(
      "Fragmentation (46k create, 23k delete, iterate)",
   );
   const ENTITY_COUNT = 46_000;

   // Extra tag components to create archetype variety
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

   // Deterministic shuffle via LCG
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

   // --- Sekai setup ---
   const worldS = new Sekai();
   allDefs.forEach((d) => worldS.ensureComponentBitFlag(d));

   const sekaiEids: number[] = [];
   for (let i = 0; i < ENTITY_COUNT; i++) {
      const eid = worldS.createEntity();
      worldS.addComponent(eid, Position);
      worldS.addComponent(eid, Velocity);
      // Vary optional components → 2^4 = 16 archetypes
      if (i % 2 === 0) worldS.addComponent(eid, Health);
      if (i % 3 === 0) worldS.addComponent(eid, Tag1);
      if (i % 5 === 0) worldS.addComponent(eid, Tag2);
      if (i % 7 === 0) worldS.addComponent(eid, Tag3);
      sekaiEids.push(eid);
   }

   // Delete half randomly
   const toDeleteS = lcgShuffle(sekaiEids).slice(0, ENTITY_COUNT / 2);
   for (const eid of toDeleteS) worldS.destructEntity(eid);

   const posS = worldS.getStore(Position);
   const velS = worldS.getStore(Velocity);
   const fragQueryS = worldS.defineQuery({ all: [Position, Velocity] });
   fragQueryS.entities;

   // --- bitECS setup ---
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

   // Delete same half (same seed)
   const toDeleteB = lcgShuffle(bitEids).slice(0, ENTITY_COUNT / 2);
   for (const eid of toDeleteB) removeEntity(bitWorld, eid);

   const bitFragQ = query(bitWorld, [FPos, FVel]);
   // const entSekai = fragQueryS.entities;

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
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════════════════════
async function runAll() {
   console.log("Sekai ECS Benchmark Suite");
   console.log("═".repeat(60));
   // console.log(`Node ${process.version} | ${process.platform} ${process.arch}`);
   console.log(`Bench time: ${BENCH_TIME}ms | Warmup: ${WARMUP_TIME}ms`);
   console.log("═".repeat(60));

   await runEntityLifecycle();
   await runComponentOps();
   await runQueryPerf();
   await runSystemTick();
   await runIteration();
   await runSerialization();
   await runFragmentation();

   console.log("\n" + "═".repeat(60));
   console.log("All benchmarks complete.");
}

runAll();
