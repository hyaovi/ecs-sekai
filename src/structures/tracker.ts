import { MAX_ENTITIES } from "../core/constants";
import type { EntityId } from "../core/entity";

export class SyncTracker {
   dirtySet: Uint32Array;
   changed: Uint32Array;
   count: number;
   constructor(length = MAX_ENTITIES) {
      this.dirtySet = new Uint32Array(length);
      this.changed = new Uint32Array(length);
      this.count = 0;
   }
   track(eid: EntityId) {
      if (this.dirtySet[eid]) return;
      this.changed[this.count] = eid;
      this.dirtySet[eid] = 1;
      this.count++;
   }
   drain(): Uint32Array {
      const eids = this.changed.subarray(0, this.count);
      for (let index = 0; index < this.count; index++) {
         const entity = this.changed[index];
         this.dirtySet[entity] = 0;
      }
      this.count = 0;
      return eids;
   }
}

export class Tracker {
   changed: Uint32Array;
   indexTracker: Uint32Array;
   dirtySet: Uint8Array;
   counter: number;
   constructor(max: number) {
      this.changed = new Uint32Array(max);
      this.dirtySet = new Uint8Array(max);
      this.indexTracker = new Uint32Array(max);
      this.counter = 0;
   }
   track(eid: EntityId) {
      if (this.dirtySet[eid] == 1) return;
      this.changed[this.counter] = eid;
      this.indexTracker[eid] = this.counter;
      this.counter++;
      this.dirtySet[eid] = 1;
   }
   flushEntity(eid: EntityId) {
      if (this.dirtySet[eid] === 0) return;
      const eidIndexToRemove = this.indexTracker[eid];

      const lastChangedEntity = this.changed[this.counter - 1];

      this.changed[eidIndexToRemove] = lastChangedEntity;
      this.indexTracker[lastChangedEntity] = eidIndexToRemove;

      this.dirtySet[eid] = 0;

      this.counter--;
   }
   flushAll() {
      for (let index = 0; index < this.counter; index++) {
         const entity = this.changed[index];
         this.dirtySet[entity] = 0;
      }
      this.counter = 0;
   }
   drain() {
      const eids = this.changed.subarray(0, this.counter);
      this.flushAll();
      return eids;
   }
}
