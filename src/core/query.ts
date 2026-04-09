import type { ArcheType } from "./archetype";
import type { ComponentDefinition } from "./component";

import { SparseSetArray } from "../structures/sparse-set";
import type { EntityId } from "./entity";

export interface QueryTerm {
   all?: ComponentDefinition[];
   any?: ComponentDefinition[];
   none?: ComponentDefinition[];
}
export interface QueryTracker {
   entered: EntityId[];
   exited: EntityId[];
   unTrack: () => void;
   clear: () => void;
}

export class Query {
   allMask: number;
   anyMask: number;
   noneMask: number;
   interestMask: number;
   key: string;
   entitiesSparset: SparseSetArray;
   updated: boolean;
   sortedEntities: EntityId[];
   needSort: boolean;
   archeTypes: ArcheType[];
   archeMaskSet: Set<number>;

   trackers: QueryTracker[];
   constructor(
      {
         allMask,
         anyMask,
         noneMask,
      }: {
         allMask: number;
         anyMask: number;
         noneMask: number;
      },
      arches: ArcheType[] = [],
   ) {
      this.entitiesSparset = new SparseSetArray();
      this.needSort = true;
      this.sortedEntities = [];
      this.allMask = allMask;
      this.noneMask = noneMask;
      this.anyMask = anyMask;
      this.key = `${allMask}--${anyMask}--${noneMask}`;
      this.updated = false;

      this.archeMaskSet = new Set();
      this.interestMask = allMask | anyMask | noneMask;
      this.archeTypes = arches;

      this.trackers = [];
   }
   get entities() {
      return this.entitiesSparset.dense;

      // this seems to be a bottle neck , ops/s rate drop when i use the sorting logic
      // if (this.needSort) this.sortResult();
      // return this.sortedEntities;
   }
   match(entityMask: number): boolean {
      const hasAny = this.anyMask > 0;

      if ((entityMask & this.noneMask) !== 0) return false;

      if ((entityMask & this.allMask) !== this.allMask) return false;

      if (hasAny && (entityMask & this.anyMask) === 0) return false;

      return true;
   }
   notify(eid: EntityId, oldMask: number, newMask: number) {
      if (eid === undefined) return;
      const wasMatch = this.match(oldMask);
      const isMatch = this.match(newMask);
      if (wasMatch === isMatch) return;

      this.updated = true;

      if (isMatch) {
         this.entitiesSparset.add(eid);
         for (let i = 0; i < this.trackers.length; i++) {
            this.trackers[i].entered.push(eid);
         }
      } else {
         this.entitiesSparset.remove(eid);
         for (let i = 0; i < this.trackers.length; i++) {
            this.trackers[i].exited.push(eid);
         }
      }
      this.needSort = true;
   }
   resetUpdated() {
      this.updated = false;
      const trackers = this.trackers;
      for (let i = 0; i < trackers.length; i++) {
         trackers[i].entered.length = 0;
         trackers[i].exited.length = 0;
      }
   }
   sortResult() {
      const dense = this.entitiesSparset.dense;
      const count = this.entitiesSparset.count;
      this.sortedEntities.length = count;
      for (let i = 0; i < count; i++) {
         this.sortedEntities[i] = dense[i];
      }
      this.sortedEntities.sort((a, b) => a - b);
      this.needSort = false;
   }
   track(): QueryTracker {
      const entered: number[] = [];
      const exited: number[] = [];
      const eids = this.entities;

      const tracker: QueryTracker = {
         entered,
         exited,
         clear: () => {
            entered.length = 0;
            exited.length = 0;
         },
         unTrack: () => {
            const idx = this.trackers.indexOf(tracker);
            entered.length = 0;
            exited.length = 0;
            if (idx !== -1) {
               this.trackers.splice(idx, 1);
            }
         },
      };

      // seed
      for (let i = 0; i < eids.length; i++) {
         tracker.entered.push(eids[i]);
      }

      this.trackers.push(tracker);
      return tracker;
   }
}
