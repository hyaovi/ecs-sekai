import { beforeEach, describe, expect, it } from "vitest";
import { Sekai } from "./world";
import { defineComponent } from "./component";

describe("Queries", () => {
   let world: Sekai;

   beforeEach(() => {
      world = new Sekai();
   });

   describe("Real-time Updates", () => {
      const A = defineComponent({
         name: "QA",
         description: "",
         schema: { v: "u32" },
      });
      const B = defineComponent({
         name: "QB",
         description: "",
         schema: { v: "u32" },
      });

      it("should add entity to query on addComponent", () => {
         const query = world.defineQuery({ all: [A] });
         const e1 = world.createEntity();
         expect(query.entities).not.toContain(e1);
         world.addComponent(e1, A);
         expect(query.entities).toContain(e1);
      });

      it("should remove entity from query on removeComponent", () => {
         const query = world.defineQuery({ all: [A] });
         const e1 = world.createEntity();
         world.addComponent(e1, A);
         expect(query.entities).toContain(e1);
         world.removeComponent(e1, A);
         expect(query.entities).not.toContain(e1);
      });

      it("should remove entity from query on destructEntity", () => {
         const query = world.defineQuery({ all: [A] });
         const e1 = world.createEntity();
         world.addComponent(e1, A);
         expect(query.entities).toContain(e1);
         world.destructEntity(e1);
         expect(query.entities).not.toContain(e1);
      });

      it("should not add entity until all required components present", () => {
         const query = world.defineQuery({ all: [A, B] });
         const e1 = world.createEntity();
         world.addComponent(e1, A);
         expect(query.entities).not.toContain(e1);
         world.addComponent(e1, B);
         expect(query.entities).toContain(e1);
      });
   });

   describe("none mask", () => {
      const A = defineComponent({
         name: "NoneA",
         description: "",
         schema: { v: "u32" },
      });
      const Poison = defineComponent({
         name: "Poison",
         description: "",
         schema: { v: "u32" },
      });

      it("should exclude entities with none component", () => {
         const query = world.defineQuery({ all: [A], none: [Poison] });
         const e1 = world.createEntity();
         world.addComponent(e1, A);
         expect(query.entities).toContain(e1);
         world.addComponent(e1, Poison);
         expect(query.entities).not.toContain(e1);
      });

      it("none-only query without all/any does not track bare entities", () => {
         const query = world.defineQuery({ none: [Poison] });
         const e1 = world.createEntity();
         expect(query.entities).not.toContain(e1);
      });
   });

   describe("any mask", () => {
      const A = defineComponent({
         name: "AnyA",
         description: "",
         schema: { v: "u32" },
      });
      const B = defineComponent({
         name: "AnyB",
         description: "",
         schema: { v: "u32" },
      });
      const C = defineComponent({
         name: "AnyC",
         description: "",
         schema: { v: "u32" },
      });

      it("should match entity with any one of the listed components", () => {
         const query = world.defineQuery({ any: [A, B] });
         const e1 = world.createEntity();
         world.addComponent(e1, A);
         expect(query.entities).toContain(e1);
      });

      it("should not match entity with none of the any components", () => {
         const query = world.defineQuery({ any: [A, B] });
         const e1 = world.createEntity();
         world.addComponent(e1, C);
         expect(query.entities).not.toContain(e1);
      });

      it("should keep entity when one of two any components is removed", () => {
         const query = world.defineQuery({ any: [A, B] });
         const e1 = world.createEntity();
         world.addComponent(e1, A);
         world.addComponent(e1, B);
         world.removeComponent(e1, A);
         expect(query.entities).toContain(e1);
      });
   });

   describe("combined masks", () => {
      const A = defineComponent({
         name: "CombA",
         description: "",
         schema: { v: "u32" },
      });
      const B = defineComponent({
         name: "CombB",
         description: "",
         schema: { v: "u32" },
      });
      const C = defineComponent({
         name: "CombC",
         description: "",
         schema: { v: "u32" },
      });
      const Poison = defineComponent({
         name: "CombPoison",
         description: "",
         schema: { v: "u32" },
      });

      it("all + any + none combined", () => {
         const query = world.defineQuery({
            all: [A],
            any: [B, C],
            none: [Poison],
         });
         const e1 = world.createEntity();
         world.addComponent(e1, A);
         expect(query.entities).not.toContain(e1);
         world.addComponent(e1, B);
         expect(query.entities).toContain(e1);
         world.addComponent(e1, Poison);
         expect(query.entities).not.toContain(e1);
         world.removeComponent(e1, Poison);
         expect(query.entities).toContain(e1);
      });
   });

   describe("seeding", () => {
      const A = defineComponent({
         name: "SeedA",
         description: "",
         schema: { v: "u32" },
      });

      it("should seed query with pre-existing entities", () => {
         const e1 = world.createEntity();
         const e2 = world.createEntity();
         world.addComponent(e1, A);
         world.addComponent(e2, A);
         const query = world.defineQuery({ all: [A] });
         expect(query.entities).toContain(e1);
         expect(query.entities).toContain(e2);
         expect(query.entities.length).toBe(2);
      });
   });

   describe("caching", () => {
      const A = defineComponent({
         name: "CacheA",
         description: "",
         schema: { v: "u32" },
      });

      it("should return the same query instance for identical terms", () => {
         const q1 = world.defineQuery({ all: [A] });
         const q2 = world.defineQuery({ all: [A] });
         expect(q1).toBe(q2);
      });
   });

   describe("multiple queries", () => {
      const A = defineComponent({
         name: "MultiA",
         description: "",
         schema: { v: "u32" },
      });
      const B = defineComponent({
         name: "MultiB",
         description: "",
         schema: { v: "u32" },
      });

      it("removing one component should only affect relevant queries", () => {
         const qA = world.defineQuery({ all: [A] });
         const qAB = world.defineQuery({ all: [A, B] });
         const e1 = world.createEntity();
         world.addComponent(e1, A);
         world.addComponent(e1, B);
         expect(qA.entities).toContain(e1);
         expect(qAB.entities).toContain(e1);
         world.removeComponent(e1, B);
         expect(qA.entities).toContain(e1);
         expect(qAB.entities).not.toContain(e1);
      });
   });

   describe("query.updated", () => {
      const A = defineComponent({
         name: "UpdA",
         description: "",
         schema: { v: "u32" },
      });

      it("should be true after entity enters or exits", () => {
         const query = world.defineQuery({ all: [A] });
         const e1 = world.createEntity();
         world.addComponent(e1, A);
         expect(query.updated).toBe(true);
         query.resetUpdated();
         world.removeComponent(e1, A);
         expect(query.updated).toBe(true);
      });

      it("should reset at start of next tick", () => {
         const query = world.defineQuery({ all: [A] });
         const e1 = world.createEntity();
         world.addComponent(e1, A);
         expect(query.updated).toBe(true);
         world.tick(0);
         expect(query.updated).toBe(false);
      });

      it("should be true after deferred ops flush", () => {
         const query = world.defineQuery({ all: [A] });
         const e1 = world.createEntity();
         world.deferring = true;
         world.addComponent(e1, A);
         expect(query.updated).toBe(false);
         world.deferring = false;
         world.flushDeferredOps();
         expect(query.updated).toBe(true);
      });
   });

   describe("edge cases", () => {
      const A = defineComponent({
         name: "EdgeA",
         description: "",
         schema: { v: "u32" },
      });

      it("world.reset should clear all queries", () => {
         const e1 = world.createEntity();
         world.addComponent(e1, A);
         const query = world.defineQuery({ all: [A] });
         expect(query.entities.length).toBe(1);
         world.reset();
         expect(world.queries.length).toBe(0);
      });
   });
});
