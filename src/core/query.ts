import type { ArcheType } from "./archetype";
import type { ComponentDefinition } from "./component";

import { SparseSetArray } from "../structures/sparse-set";
import type { EntityId } from "./entity";

export interface QueryTerm {
   all?: ComponentDefinition[];
   any?: ComponentDefinition[];
   none?: ComponentDefinition[];
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
   archeMaskSet: Set<number>; //replaced sparset wit native Set
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
   }
   get entities() {
      if (this.needSort) this.sortResult();
      return this.sortedEntities;
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

      if (isMatch) this.entitiesSparset.add(eid);
      else this.entitiesSparset.remove(eid);
      this.needSort = true;
   }
   resetUpdated() {
      this.updated = false;
   }
   // this sort feature needs cleaner ac=rchitecture , maybe sort in sparseset ?
   sortResult() {
      const dense = this.entitiesSparset.dense;
      const count = this.entitiesSparset.count;
      for (let i = 0; i < count; i++) {
         this.sortedEntities[i] = dense[i];
      }
      this.sortedEntities.sort((a, b) => a - b);
      this.needSort = false;
   }
}
