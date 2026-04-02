import { MAX_ENTITIES } from "./constants";

export class ArcheType {
   dense: Uint32Array;
   sparse: Uint32Array;
   count: number;
   bitMask: number;
   constructor(bitMask: number, max: number = MAX_ENTITIES) {
      this.bitMask = bitMask;
      this.dense = new Uint32Array(max);
      this.sparse = new Uint32Array(max);
      this.count = 0;
   }
   add(eid: number) {
      if (this.has(eid)) return;
      this.dense[this.count] = eid;
      this.sparse[eid] = this.count;
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
