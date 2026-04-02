import { beforeEach, describe, expect, it } from "vitest";
import { Sekai } from "./world";
import { defineComponent } from "./component";
import { createTestSystem } from "../helpers.test-utils";

describe("ECS Core", () => {
   let world: Sekai;

   beforeEach(() => {
      world = new Sekai();
   });

   describe("Entities", () => {
      it("should create and destroy entities", () => {
         const e1 = world.createEntity();
         expect(world.isAlive(e1)).toBe(true);
         world.destructEntity(e1);
         expect(world.isAlive(e1)).toBe(false);
      });

      it("should recycle destroyed entities", () => {
         const e1 = world.createEntity();
         world.destructEntity(e1);
         const e2 = world.createEntity();
         expect(e2).toBe(e1);
      });

      it("should not recycle reserved entities", () => {
         const e1 = world.createAndReserve();
         world.destructEntity(e1);
         const e2 = world.createEntity();
         expect(e2).not.toBe(e1);
      });

      it("should reclaim a reserved entity", () => {
         const e1 = world.createAndReserve();
         world.destructEntity(e1);
         expect(world.isAlive(e1)).toBe(false);
         const reclaimed = world.reclaimEntity(e1);
         expect(reclaimed).toBe(e1);
         expect(world.isAlive(e1)).toBe(true);
      });
      it("Should never create or restore entity 0", () => {
         const e1 = world.createEntity();
         expect(e1).not.toBe(0);
         expect(() => world.reclaimEntity(0)).toThrow();
      });
   });

   describe("Components", () => {
      const Position = defineComponent({
         name: "TestPosition",
         description: "Position component",
         schema: { x: "f32", y: "f32", z: "f32" },
      });

      it("should add and remove components", () => {
         const e1 = world.createEntity();
         world.addComponent(e1, Position);
         expect(world.hasComponent(e1, Position)).toBe(true);
         world.removeComponent(e1, Position);
         expect(world.hasComponent(e1, Position)).toBe(false);
      });

      it("should auto-add component on updateComponent if missing", () => {
         const e1 = world.createEntity();
         world.updateComponent(e1, Position, { x: 5.0 });
         expect(world.hasComponent(e1, Position)).toBe(true);
         const store = world.getStore(Position);
         expect(store.x[e1]).toBe(5.0);
      });
   });

   describe("Deferred operations", () => {
      const A = defineComponent({
         name: "DeferA",
         description: "",
         schema: { v: "u32" },
      });

      it("should defer addComponent during tick", () => {
         const query = world.defineQuery({ all: [A] });
         const e1 = world.createEntity();

         const DeferAddSystem = createTestSystem("DeferAddSystem", () => {
            world.addComponent(e1, A);
         });

         world.addSystem(DeferAddSystem as any);
         world.tick(16);
         expect(query.entities).toContain(e1);
      });

      it("should defer destructEntity during tick", () => {
         const query = world.defineQuery({ all: [A] });
         const e1 = world.createEntity();
         world.addComponent(e1, A);

         const DeferDestructSystem = createTestSystem(
            "DeferDestructSystem",
            () => {
               world.destructEntity(e1);
            },
         );

         world.addSystem(DeferDestructSystem as any);
         world.tick(16);
         expect(world.isAlive(e1)).toBe(false);
         expect(query.entities).not.toContain(e1);
      });
   });

   describe("World reset", () => {
      it("world.reset should clear entityMask", () => {
         const A = defineComponent({
            name: "ResetMaskA",
            description: "",
            schema: { v: "u32" },
         });
         const e1 = world.createEntity();
         world.addComponent(e1, A);
         expect(world.entityMask[e1]).not.toBe(0);
         world.reset();
         expect(world.entityMask[e1]).toBe(0);
      });
   });
});
