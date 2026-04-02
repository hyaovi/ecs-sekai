import { MAX_ENTITIES } from "../core/constants";

export class SparseSet {
   dense: Uint32Array;
   sparse: Uint32Array;
   count: number;
   constructor(max: number = MAX_ENTITIES) {
      this.dense = new Uint32Array(max);
      this.sparse = new Uint32Array(max);
      this.count = 0;
   }
   add(eid: number) {
      const { sparse, dense, count } = this;

      const index = sparse[eid];
      const has = index < count && dense[index] === eid;

      if (has) return;

      dense[count] = eid;
      sparse[eid] = count;
      this.count++;
   }
   remove(eid: number) {
      if (!this.has(eid)) {
         return;
      }

      const indexToRemove = this.sparse[eid];

      const lastIndex = this.count - 1;
      const lastEid = this.dense[lastIndex];

      this.dense[indexToRemove] = lastEid;
      this.sparse[lastEid] = indexToRemove;

      this.count--;
   }
   has(eid: number): boolean {
      const index = this.sparse[eid];
      return index < this.count && this.dense[index] === eid;
   }
   reset() {
      this.count = 0;
   }

   get values() {
      return this.dense.subarray(0, this.count);
   }
}
// Maybe unify both sparsesets classes ?
export class SparseSetArray {
   dense: number[];
   sparse: Uint32Array;
   count: number;
   constructor(max: number = MAX_ENTITIES) {
      this.dense = [];
      this.sparse = new Uint32Array(max);
      this.count = 0;
   }
   add(eid: number) {
      const { sparse, dense, count } = this;
      const index = sparse[eid];
      if (index < count && dense[index] === eid) return;
      dense[count] = eid;
      sparse[eid] = count;
      this.count++;
   }
   remove(eid: number) {
      if (!this.has(eid)) return;

      const indexToRemove = this.sparse[eid];
      const lastIndex = this.count - 1;
      const lastEid = this.dense[lastIndex];

      this.dense[indexToRemove] = lastEid;
      this.sparse[lastEid] = indexToRemove;

      this.count--;

      // this might be bottleneck
      this.dense.length = this.count;
   }
   has(eid: number): boolean {
      const index = this.sparse[eid];
      return index < this.count && this.dense[index] === eid;
   }
   reset() {
      this.dense.length = 0;
      this.count = 0;
   }
   get values(): number[] {
      return this.dense;
   }
}
