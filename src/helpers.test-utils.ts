import { defineComponent } from "./core/component";
import { PhaseTypes, System } from "./core/system";
import type { Sekai } from "./core/world";
import type { TickFunction } from "./core/types";

export function createTagComponent(name: string) {
   return defineComponent({ name, description: "", schema: { v: "u32" } });
}

export function createPositionComponent(name: string) {
   return defineComponent({
      name,
      description: "",
      schema: { x: "f32", y: "f32", z: "f32" },
   });
}

export function createTestSystem(
   name: string,
   onTick: (dt: number) => void,
   phase: (typeof PhaseTypes)[keyof typeof PhaseTypes] = PhaseTypes.render,
) {
   return class extends System {
      phase = phase;
      enabled = true;
      name = name;
      createRunner(_world: Sekai): TickFunction {
         return onTick;
      }
      init() {}
      destroy() {}
   };
}
