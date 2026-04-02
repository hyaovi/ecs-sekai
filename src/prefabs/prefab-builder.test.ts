import { describe, expect, it } from "vitest";
import { defineComponent } from "../core/component";
import { definePrefab } from "./prefab-builder";

describe("PrefabBuilder", () => {
   const CompA = defineComponent({
      name: "PrefabA",
      description: "",
      schema: { x: "f32", y: "f32" },
   });
   const CompB = defineComponent({
      name: "PrefabB",
      description: "",
      schema: { v: "u32" },
   });

   it("should add components", () => {
      const prefab = definePrefab("WithComp")
         .add(CompA, { x: 1, y: 2 })
         .build();
      expect(prefab.components.length).toBe(1);
      expect(prefab.components[0].componentName).toBe("PrefabA");
      expect(prefab.components[0].data).toEqual({ x: 1, y: 2 });
   });

   it("should merge data on duplicate add", () => {
      const prefab = definePrefab("Merge")
         .add(CompA, { x: 1, y: 2 })
         .add(CompA, { x: 10 })
         .build();
      expect(prefab.components.length).toBe(1);
      expect(prefab.components[0].data).toEqual({ x: 10, y: 2 });
   });

   it("should extend with another prefab", () => {
      const base = definePrefab("Base").add(CompA, { x: 0, y: 0 }).build();
      const extended = definePrefab("Extended")
         .extendsWith(base)
         .add(CompB, { v: 42 })
         .build();
      expect(extended.components.length).toBe(2);
      const compA = extended.components.find(
         (c) => c.componentName === "PrefabA",
      );
      const compB = extended.components.find(
         (c) => c.componentName === "PrefabB",
      );
      expect(compA).toBeDefined();
      expect(compB).toBeDefined();
      expect(compB!.data).toEqual({ v: 42 });
   });
});
