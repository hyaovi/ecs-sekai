import { beforeEach, describe, expect, it } from "vitest";
import { Sekai } from "./world";
import { PhaseTypes, System } from "./system";

describe("Systems", () => {
   let world: Sekai;
   let tickCount: number;

   beforeEach(() => {
      world = new Sekai();
      tickCount = 0;
   });

   class TestSystem extends System {
      phase = PhaseTypes.render;
      enabled = true;
      name = "TestSystem";

      createRunner(_world: Sekai) {
         return (_dt: number) => {
            tickCount++;
         };
      }

      init(_world: Sekai) {}
      destroy() {}
   }

   it("should execute systems on tick", () => {
      world.addSystem(TestSystem as any);
      world.tick(16);
      expect(tickCount).toBe(1);
   });

   it("should not execute disabled systems", () => {
      const sys = world.addSystem(TestSystem as any)!;
      sys.enabled = false;
      (world as any).rebuildSystems = true;
      world.tick(16);
      expect(tickCount).toBe(0);
   });

   it("should remove system", () => {
      world.addSystem(TestSystem as any);
      world.tick(16);
      expect(tickCount).toBe(1);
      world.removeSystem(TestSystem as any);
      world.tick(16);
      expect(tickCount).toBe(1);
   });

   it("should order systems by phase", () => {
      const order: string[] = [];

      class PreSystem extends System {
         phase = PhaseTypes.preRender;
         enabled = true;
         name = "PreSystem";
         createRunner() {
            return () => {
               order.push("pre");
            };
         }
         init() {}
         destroy() {}
      }
      class PostSystem extends System {
         phase = PhaseTypes.postRender;
         enabled = true;
         name = "PostSystem";
         createRunner() {
            return () => {
               order.push("post");
            };
         }
         init() {}
         destroy() {}
      }

      world.addSystem(PostSystem as any);
      world.addSystem(PreSystem as any);
      world.tick(16);
      expect(order).toEqual(["pre", "post"]);
   });
});
