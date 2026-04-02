import { describe, expect, it, beforeEach } from "vitest";
import { SparseSet, SparseSetArray } from "./sparse-set";

describe("SparseSet", () => {
   let set: SparseSet;

   beforeEach(() => {
      set = new SparseSet(100);
   });

   it("should add an entity", () => {
      set.add(5);
      expect(set.has(5)).toBe(true);
      expect(set.count).toBe(1);
   });

   it("should ignore duplicate add (idempotent)", () => {
      set.add(5);
      set.add(5);
      expect(set.count).toBe(1);
   });

   it("should remove an entity", () => {
      set.add(5);
      set.remove(5);
      expect(set.has(5)).toBe(false);
      expect(set.count).toBe(0);
   });

   it("should use swap-remove order", () => {
      set.add(10);
      set.add(20);
      set.add(30);
      set.remove(10);
      expect(set.count).toBe(2);
      expect(set.has(20)).toBe(true);
      expect(set.has(30)).toBe(true);
      expect(set.has(10)).toBe(false);
   });
});

describe("SparseSetArray", () => {
   let set: SparseSetArray;

   beforeEach(() => {
      set = new SparseSetArray(100);
   });

   it("should add and remove entities", () => {
      set.add(5);
      expect(set.has(5)).toBe(true);
      expect(set.count).toBe(1);
      set.add(5);
      expect(set.count).toBe(1);
      set.remove(5);
      expect(set.has(5)).toBe(false);
      expect(set.count).toBe(0);
   });

   it("should truncate dense array on remove", () => {
      set.add(1);
      set.add(2);
      set.add(3);
      set.remove(2);
      expect(set.dense.length).toBe(2);
   });

   it("should reset to empty", () => {
      set.add(1);
      set.add(2);
      set.reset();
      expect(set.count).toBe(0);
      expect(set.dense.length).toBe(0);
   });
});
