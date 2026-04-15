import { ArcheType } from "./archetype";
import {
   RefType,
   type ComponentDefinition,
   type ComponentSchema,
   type SchemaToValues,
} from "./component";
import { Store, type SchemaToStore } from "./component-store";
import { MAX_COMPONENTS, MAX_ENTITIES } from "./constants";
import { DeferredOpType, type DeferredOp } from "./deferred";
import { NULL_ENTITY, type EntityId } from "./entity";
import { Query, type QueryTerm } from "./query";
import { System } from "./system";
import type { TickFunction } from "./types";
import { SparseSet } from "../structures/sparse-set";

export class Sekai {
   entities: Uint8Array;
   entityMask: Uint32Array;
   edoTensei: SparseSet; //Freelist | Recycle bin
   reservedEntities: Uint8Array;
   aliveEids: SparseSet; // Real-time compacted list of livings entity IDs
   // systems
   systemsMap: WeakMap<new () => System, System>;
   systemsInstances: System[];
   systemsRunners: TickFunction[];

   entityCursor: number;
   maxEid = MAX_ENTITIES;
   componentDefinitions: Map<string, ComponentDefinition>;
   componentBitCounter: number;
   componentStoresArray: Store[];
   componentMasksArray: number[];
   deferring: boolean;
   deferredOps: DeferredOp[];
   // queries
   queryCache: Map<string, Query>;
   queries: Query[];
   archeTypeMap: Map<number, ArcheType>;

   rebuildSystems: boolean;
   frame: number;

   // runtime flag

   constructor() {
      // entities
      this.entities = new Uint8Array(MAX_ENTITIES);
      this.entityMask = new Uint32Array(MAX_ENTITIES);
      this.reservedEntities = new Uint8Array(MAX_ENTITIES);
      this.edoTensei = new SparseSet();
      this.aliveEids = new SparseSet();
      this.entityCursor = 1; // 0 is null entity and reserved for life
      // systems
      this.rebuildSystems = true;
      this.systemsMap = new WeakMap();
      this.systemsInstances = [];
      this.systemsRunners = [];
      // components
      this.componentBitCounter = 0;
      this.componentDefinitions = new Map();
      this.componentStoresArray = [];
      this.componentMasksArray = [];
      // queries
      this.queryCache = new Map();
      this.queries = [];

      // arhetype
      this.archeTypeMap = new Map();

      this.deferring = false;

      this.deferredOps = [];
      this.frame = 0;
   }
   reset() {
      this.queries.length = 0;
      this.queryCache.clear();

      this.rebuildSystems = true;
      this.archeTypeMap.clear();

      this.entityCursor = 1;
      this.edoTensei.reset();
      this.entities.fill(0);
      this.aliveEids.reset();
      this.entityMask.fill(0);
      this.reservedEntities.fill(0);

      for (const store of this.componentStoresArray) {
         if (store !== undefined) store.reset();
      }
   }

   createEntity(): EntityId {
      let eid: EntityId;
      if (this.edoTensei.count > 0) {
         eid = this.edoTensei.dense[this.edoTensei.count - 1];
         this.edoTensei.remove(eid);
      } else {
         if (this.entityCursor === MAX_ENTITIES) {
            throw new Error(`Sekai - max entity reach`);
         }
         eid = this.entityCursor++;
      }

      this.entities[eid] = 1;
      this.entityMask[eid] = 0;
      this.aliveEids.add(eid);

      return eid;
   }
   // the reservation feature is destined for editor interaction
   createAndReserve(): EntityId {
      const eid = this.createEntity();
      this.reservedEntities[eid] = 1;
      return eid;
   }

   releaseEntity(eid: EntityId) {
      if (eid === NULL_ENTITY) return;

      this.validateEid(eid);

      if (this.reservedEntities[eid] === 0) return;
      this.reservedEntities[eid] = 0;
      if (this.entities[eid] === 0) {
         this.edoTensei.add(eid);
      }
   }
   reclaimEntity(eid: EntityId): EntityId {
      this.validateEid(eid);
      if (this.reservedEntities[eid] === 0)
         throw new Error(`Entity ${eid} is not a reserved entity`);

      if (this.entities[eid] > 0)
         throw new Error(`Entity :${eid} is still alive`);

      this.entities[eid] = 1;
      this.entityMask[eid] = 0;
      this.aliveEids.add(eid);
      return eid;
   }
   // end of reservation feature methods
   destructEntity(eid: EntityId) {
      if (eid === NULL_ENTITY) return;
      if (this.deferring) {
         this.deferredOps.push({ type: DeferredOpType.DestructEntity, eid });
         return;
      }
      this.validateEid(eid);
      if (this.entities[eid] === 0) return;

      const prevMask = this.entityMask[eid];
      this.updateEntityMask(eid, 0);
      this.entities[eid] = 0;
      this.aliveEids.remove(eid);

      // reserved entities are not recycled
      if (this.reservedEntities[eid] === 0) this.edoTensei.add(eid);
      // reset the entity's state to its default values
      this.resetEntityData(eid, prevMask);
   }
   // safety util
   validateEid(eid: EntityId) {
      if (eid === 0) throw new Error(`eid: ${eid} is reserved`);
      if (eid < 0 || eid >= this.entityCursor)
         throw new Error(`Invalid eid: ${eid}`);
   }

   isAlive(eid: EntityId): boolean {
      return this.entities[eid] > 0;
   }
   resetEntityData(eid: EntityId, eidMask: number) {
      const stores = this.componentStoresArray;
      for (const store of stores) {
         if (store === undefined) continue;
         if ((eidMask & store.bitFlag) !== store.bitFlag) continue;
         store.resetEntity(eid);
      }
   }

   // archetype
   private ensureArchetype(bitMask: number) {
      let archetype = this.archeTypeMap.get(bitMask);
      if (!archetype) {
         archetype = new ArcheType(bitMask);
         this.archeTypeMap.set(bitMask, archetype);
         for (const query of this.queries) {
            if (
               !query.archeMaskSet.has(archetype.bitMask) &&
               query.match(archetype.bitMask)
            ) {
               query.archeTypes.push(archetype);
               query.archeMaskSet.add(archetype.bitMask);
            }
         }
      }

      return archetype;
   }
   private updateEntityMask(eid: EntityId, newMask: number) {
      const oldMask = this.entityMask[eid];
      if (oldMask === newMask) return;
      const currentArchetype = this.archeTypeMap.get(oldMask);
      if (currentArchetype) currentArchetype.remove(eid);

      if (newMask !== 0) {
         // newMask === 0 means entity is being destructed and removed from the world.
         const nextArchetype = this.ensureArchetype(newMask);
         nextArchetype.add(eid);
      }

      // notify queries, PS:I need to optmize this. and avoid iterating all queries
      const queries = this.queries;
      const queriesLength = queries.length;
      const changedBits = oldMask ^ newMask;
      for (let i = 0; i < queriesLength; i++) {
         const q = queries[i];
         if ((q.interestMask & changedBits) === 0) continue;
         q.notify(eid, oldMask, newMask);
      }

      this.entityMask[eid] = newMask;
   }

   // components
   private getNewComponentBitFlag(): number {
      if (this.componentBitCounter >= MAX_COMPONENTS) {
         throw new Error(`Max component bitFlag reached `);
      }
      const bitFlag = 1 << this.componentBitCounter++;
      return bitFlag;
   }
   ensureComponentBitFlag<TSchema extends ComponentSchema>(
      def: ComponentDefinition<TSchema>,
   ): number {
      const registeredBitFlag = this.componentMasksArray[def.id];
      if (registeredBitFlag !== undefined) return registeredBitFlag;

      const bitFlag = this.getNewComponentBitFlag();
      this.componentMasksArray[def.id] = bitFlag;
      this.componentDefinitions.set(def.name, def);
      return bitFlag;
   }
   registerComponents(...componentDefinitions: ComponentDefinition[]) {
      for (const definition of componentDefinitions) {
         this.ensureComponentBitFlag(definition);
      }
   }
   addComponent<TSchema extends ComponentSchema>(
      eid: EntityId,
      componentDef: ComponentDefinition<TSchema>,
   ) {
      if (eid === NULL_ENTITY) return;
      if (this.entities[eid] === 0) return;

      if (this.deferring) {
         this.deferredOps.push({
            type: DeferredOpType.AddComponent,
            eid,
            componentDef,
         });
         return;
      }
      const componentBitFlag = this.ensureComponentBitFlag(componentDef);
      this.getStore(componentDef);
      const newFlag = this.entityMask[eid] | componentBitFlag;
      this.updateEntityMask(eid, newFlag);
   }
   removeComponent<TSchema extends ComponentSchema>(
      eid: EntityId,
      componentDef: ComponentDefinition<TSchema>,
   ) {
      if (eid === NULL_ENTITY) return;
      if (this.entities[eid] === 0) return;

      if (this.deferring) {
         this.deferredOps.push({
            type: DeferredOpType.RemoveComponent,
            eid,
            componentDef,
         });
         return;
      }
      const componentBitFlag = this.ensureComponentBitFlag(componentDef);

      const newFlag = this.entityMask[eid] & ~componentBitFlag;
      // maybe reset component's data ?
      this.updateEntityMask(eid, newFlag);
      const store = this.componentStoresArray[componentDef.id];
      if (store !== undefined) store.resetEntity(eid);
   }
   updateComponent<TSchema extends ComponentSchema>(
      eid: EntityId,
      componentDef: ComponentDefinition<TSchema>,
      data: Partial<SchemaToValues<TSchema>>,
   ) {
      if (eid === NULL_ENTITY) return;
      if (this.entities[eid] === 0) return;

      if (this.deferring) {
         this.deferredOps.push({
            type: DeferredOpType.UpdateComponent,
            eid,
            componentDef,
            data,
         });
         return;
      }
      const store = this.getStore(componentDef);

      if (!store) return;

      const hasComponent = this.hasComponentMask(eid, store.bitFlag);
      if (!hasComponent) {
         this.addComponent(eid, componentDef);
      }
      const schema = componentDef.schema;
      const dataKeys = Object.keys(data);
      for (let i = 0; i < dataKeys.length; i++) {
         const key = dataKeys[i];
         const value = data[key];
         const fieldType = schema[key];

         if (fieldType === undefined) continue;
         if (value === undefined) continue;

         // another option:  ArrayBuffer.isView(store[key])
         if (fieldType === "string" || fieldType === "ref") {
            (store[key] as RefType).set(eid, value);
         } else {
            (store[key] as Uint32Array)[eid] = value as number;
         }
      }
      store.changedTick[eid] = this.frame;
   }
   hasComponent(eid: EntityId, definition: ComponentDefinition): boolean {
      if (this.entities[eid] === 0) return false;
      const componentBitFlag = this.ensureComponentBitFlag(definition);
      return this.hasComponentMask(eid, componentBitFlag);
   }

   hasComponentMask(eid: EntityId, componentMask: number) {
      const eidMask = this.entityMask[eid];
      const hasComponent = (eidMask & componentMask) === componentMask;
      return hasComponent;
   }

   createStore<TSchema extends ComponentSchema = ComponentSchema>(
      def: ComponentDefinition<TSchema>,
   ): SchemaToStore<TSchema> {
      if (this.componentStoresArray[def.id]) {
         throw new Error(`Store has been created for ${def.name}`);
      }
      const componentBitFlag = this.ensureComponentBitFlag(def);

      const store = new Store(def, componentBitFlag);

      this.componentStoresArray[def.id] = store;
      return store as SchemaToStore<TSchema>;
   }
   getStore<TSchema extends ComponentSchema = ComponentSchema>(
      def: ComponentDefinition<TSchema>,
   ) {
      let store = this.componentStoresArray[def.id];
      if (!store) {
         store = this.createStore(def);
      }
      return store as SchemaToStore<TSchema>;
   }

   addSystem(
      systemClass: new (...args: any[]) => System,
      creator: () => System,
   ) {
      if (this.systemsMap.has(systemClass)) return;

      const system = creator();

      this.systemsMap.set(systemClass, system);
      this.systemsInstances.push(system);

      this.rebuildSystems = true;

      return system;
   }
   removeSystem(systemClass: new () => System) {
      const system = this.systemsMap.get(systemClass);
      if (!system) return;

      // remove from instance array
      const instanceIndex = this.systemsInstances.findIndex((i) => i == system);
      if (instanceIndex !== -1) this.systemsInstances.splice(instanceIndex, 1);

      const runner = system.getRunner(this);
      if (runner) {
         const idx = this.systemsRunners.findIndex((r) => r == runner);
         if (idx !== -1) this.systemsRunners.splice(idx, 1);
      }

      this.systemsMap.delete(systemClass);
      system.destroy();
   }
   getSystem(systemClass: new () => System): System | undefined {
      return this.systemsMap.get(systemClass);
   }

   private buildSystemRunners() {
      if (!this.rebuildSystems) return;
      const systems = this.systemsInstances
         .slice()
         .sort((s1, s2) => s1.phase - s2.phase);

      this.systemsRunners.length = 0;

      for (let i = 0; i < systems.length; i++) {
         const system = systems[i];
         if (!system.enabled) continue;

         const runner = system.getRunner(this);
         if (runner !== undefined) {
            this.systemsRunners.push(runner);
         }
      }
      this.rebuildSystems = false;
   }
   // queries
   defineQuery(queryTerm: QueryTerm) {
      const buildMask = (defs: ComponentDefinition[] = []) => {
         let queryMask = 0;
         defs.forEach((def) => {
            queryMask |= this.ensureComponentBitFlag(def);
         });
         return queryMask;
      };
      const anyMask = buildMask(queryTerm.any);
      const allMask = buildMask(queryTerm.all);
      const noneMask = buildMask(queryTerm.none);
      const key = `${allMask}--${anyMask}--${noneMask}`;

      const cachedQuery = this.queryCache.get(key);
      if (cachedQuery) return cachedQuery;

      const match = (entityMask: number) => {
         const hasAny = anyMask > 0;

         if ((entityMask & noneMask) !== 0) return false;

         if ((entityMask & allMask) !== allMask) return false;

         if (hasAny && (entityMask & anyMask) === 0) return false;

         return true;
      };
      const arches = [...this.archeTypeMap.values()].filter((a) =>
         match(a.bitMask),
      );

      const query = new Query({ allMask, anyMask, noneMask }, arches);

      this.queryCache.set(key, query);
      this.queries.push(query);
      // Seed SparseSet from existing matching archetypes
      for (let i = 0; i < arches.length; i++) {
         const arch = arches[i];
         for (let j = 0; j < arch.count; j++) {
            query.entitiesSparset.add(arch.dense[j]);
         }
      }
      return query;
   }

   flushDeferredOps() {
      const ops = this.deferredOps;
      const count = ops.length;
      for (let i = 0; i < count; i++) {
         const op = ops[i];
         switch (op.type) {
            case DeferredOpType.DestructEntity:
               this.destructEntity(op.eid);
               break;
            case DeferredOpType.AddComponent:
               this.addComponent(op.eid, op.componentDef);
               break;
            case DeferredOpType.RemoveComponent:
               this.removeComponent(op.eid, op.componentDef);
               break;
            case DeferredOpType.UpdateComponent:
               this.updateComponent(op.eid, op.componentDef, op.data);
               break;
         }
      }
      this.deferredOps.length = 0;
   }

   tick(dt: number) {
      this.frame++;
      if (this.rebuildSystems) this.buildSystemRunners();
      const runners = this.systemsRunners;

      this.deferring = true;
      for (let i = 0; i < runners.length; i++) {
         runners[i](dt);
      }
      this.deferring = false;

      this.flushDeferredOps();

      const queries = this.queries;
      for (let i = 0; i < queries.length; i++) {
         queries[i].resetUpdated();
      }
   }
}
