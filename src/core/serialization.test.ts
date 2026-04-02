import { beforeEach, describe, expect, it } from "vitest";
import { Sekai } from "./world";
import { defineComponent } from "./component";
import { captureWorldSnapshot, restoreWorldSnapshot } from "./serialization";

describe("Serialization", () => {
   let world: Sekai;

   const Pos = defineComponent({
      name: "SerPos",
      description: "",
      schema: { x: "f32", y: "f32" },
   });

   const Tag = defineComponent({
      name: "SerTag",
      description: "",
      schema: { v: "u32" },
   });

   beforeEach(() => {
      world = new Sekai();
   });

   it("should restore entities and data", () => {
      const e1 = world.createEntity();
      world.addComponent(e1, Pos);
      world.updateComponent(e1, Pos, { x: 5, y: 15 });
      const snapshot = captureWorldSnapshot(world);

      const world2 = new Sekai();
      const tmp = world2.createEntity();
      world2.addComponent(tmp, Pos);
      world2.reset();

      restoreWorldSnapshot(world2, snapshot);
      expect(world2.isAlive(e1)).toBe(true);
      const store = world2.getStore(Pos);
      expect(store.x[e1]).toBe(5);
      expect(store.y[e1]).toBe(15);
   });

   it("should round-trip: capture → restore → capture yields same data", () => {
      const e1 = world.createEntity();
      const e2 = world.createEntity();
      world.addComponent(e1, Pos);
      world.updateComponent(e1, Pos, { x: 1, y: 2 });
      world.addComponent(e2, Tag);
      world.updateComponent(e2, Tag, { v: 99 });

      const snap1 = captureWorldSnapshot(world);

      const world2 = new Sekai();
      const tmp = world2.createEntity();
      world2.addComponent(tmp, Pos);
      world2.addComponent(tmp, Tag);
      world2.reset();

      restoreWorldSnapshot(world2, snap1);
      const snap2 = captureWorldSnapshot(world2);

      expect(snap2.entityCursor).toBe(snap1.entityCursor);
      expect(snap2.entities.length).toBe(snap1.entities.length);
      for (let i = 0; i < snap1.entities.length; i++) {
         expect(snap2.entities[i].eid).toBe(snap1.entities[i].eid);
         expect(snap2.entities[i].isAlive).toBe(snap1.entities[i].isAlive);
         expect(snap2.entities[i].components.length).toBe(
            snap1.entities[i].components.length,
         );
      }
   });

   it("should throw on unknown component during restore", () => {
      const UnknownComp = defineComponent({
         name: "Unknown_" + Math.random(),
         description: "",
         schema: { v: "u32" },
      });
      const e1 = world.createEntity();
      world.addComponent(e1, UnknownComp);
      const snapshot = captureWorldSnapshot(world);

      expect(snapshot.entities[0].components.length).toBe(1);

      const world2 = new Sekai();
      expect(() => restoreWorldSnapshot(world2, snapshot)).toThrow();
   });

   it("should populate recycle bin for gaps in entity range", () => {
      const e1 = world.createEntity();
      const e2 = world.createEntity();
      const e3 = world.createEntity();
      world.addComponent(e1, Tag);
      world.addComponent(e3, Tag);
      world.destructEntity(e2);

      const snapshot = captureWorldSnapshot(world);

      const world2 = new Sekai();
      const tmp = world2.createEntity();
      world2.addComponent(tmp, Tag);
      world2.reset();

      restoreWorldSnapshot(world2, snapshot);
      const recycled = world2.createEntity();
      expect(recycled).toBeLessThan(snapshot.entityCursor);
   });
});
