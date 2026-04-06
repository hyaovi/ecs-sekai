import type { ComponentInstance, RefType } from "./component";
import { MAX_ENTITIES } from "./constants";
import type { EntityId } from "./entity";
import type { Sekai } from "./world";

export interface EntityData {
   eid: EntityId;
   isAlive: number; // 0 || 1
   components: ComponentInstance<any>[];
}

export interface WorldSnapshot {
   entities: EntityData[];
   entityCursor: number;
}

function captureEntityData(eid: EntityId, world: Sekai): EntityData {
   const data: EntityData = {
      eid,
      isAlive: world.entities[eid] === 0 ? 0 : 1,
      components: [],
   };
   const stores = world.componentStoresArray;
   for (let i = 0; i < stores.length; i++) {
      const store = stores[i];
      if (store === undefined) continue;
      if (world.hasComponentMask(eid, store.bitFlag)) {
         const def = store.definition;
         const schema = def.schema;
         const componentData: any = {};
         const fieldKeys = Object.keys(schema);
         for (let i = 0; i < fieldKeys.length; i++) {
            const fieldKey = fieldKeys[i];
            const fieldType = schema[fieldKey];
            if (fieldType == "string" || fieldType == "ref") {
               componentData[fieldKey] = (store[fieldKey] as RefType).get(eid);
            } else {
               componentData[fieldKey] = store[fieldKey][eid];
            }
         }
         data.components.push({ name: def.name, data: componentData });
      }
   }
   return data;
}

export function captureWorldSnapshot(world: Sekai): WorldSnapshot {
   const eids: EntityData[] = [];
   // retrieve all alive entites via archetypes
   const archeTypes = [...world.archeTypeMap.values()];
   for (const archetype of archeTypes) {
      const archeTypeEids = archetype.values;
      for (const eid of archeTypeEids) {
         eids.push({ ...captureEntityData(eid, world) });
      }
   }
   const snapshot: WorldSnapshot = {
      entityCursor: world.entityCursor,
      entities: eids,
   };
   return snapshot;
}

function hydrateEntities(
   world: Sekai,
   eidsData: EntityData[],
   entityCursor: number,
) {
   if (entityCursor > MAX_ENTITIES) {
      const msg = `hydration: entityCursor ${entityCursor} exceeds max entities`;
      throw new Error(msg);
   }
   world.entityCursor = entityCursor;

   for (let i = 0; i < eidsData.length; i++) {
      const eidData = eidsData[i];
      const eid = eidData.eid;
      if (world.entities[eid] !== 0) {
         throw new Error(`hydrate: duplicate eid: ${eid}`);
      }
      if (eid < 0 || eid >= entityCursor) {
         throw new Error(`hydrate: eid out of range: ${eid}`);
      }
      world.entities[eid] = 1;
      world.aliveEids.add(eid);
   }
   // add all gaped eids into recycle bin, start from 1 as eid = 0 is NULL_ENTITY
   for (let i = 1; i < entityCursor; i++) {
      if (world.entities[i] === 0) {
         world.edoTensei.add(i);
      }
   }
}

export function restoreWorldSnapshot(
   world: Sekai,
   worldSnapshot: WorldSnapshot,
) {
   const eidsData: EntityData[] = worldSnapshot.entities;
   const entityCursor = worldSnapshot.entityCursor;

   world.reset();
   hydrateEntities(world, eidsData, entityCursor);

   for (let i = 0; i < eidsData.length; i++) {
      const data = eidsData[i];
      const eid = data.eid;
      if (data.components.length > 0) {
         const components = data.components;
         for (let i = 0; i < components.length; i++) {
            const component = components[i];
            const def = world.componentDefinitions.get(component.name);
            if (!def) throw new Error(`Component ${component.name} not found`);
            world.addComponent(eid, def);
            if (component.data) {
               world.updateComponent(eid, def, component.data);
            }
         }
      }
   }
}

export const serializers = {
   captureEntityData,
   captureWorldSnapshot,
   restoreWorldSnapshot,
};
