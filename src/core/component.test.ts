import { describe, expect, it } from "vitest";
import { defineComponent, RefType } from "./component";

describe("defineComponent", () => {
   it("should assign unique ids", () => {
      const a = defineComponent({
         name: "DefComp3",
         description: "",
         schema: { v: "u32" },
      });
      const b = defineComponent({
         name: "DefComp4",
         description: "",
         schema: { v: "u32" },
      });
      expect(a.id).not.toBe(b.id);
   });

   it("should warn and return same def on duplicate registration", () => {
      const def = defineComponent({
         name: "DefComp5",
         description: "",
         schema: { v: "u32" },
      });
      const originalId = def.id;
      const result = defineComponent(def);
      expect(result).toBe(def);
      expect(result.id).toBe(originalId);
   });
});

describe("RefType", () => {
   it("should add and get a value", () => {
      const ref = new RefType<string>(100);
      ref.add(1, "hello");
      expect(ref.get(1)).toBe("hello");
   });

   it("should throw on duplicate add", () => {
      const ref = new RefType<string>(100);
      ref.add(1, "hello");
      expect(() => ref.add(1, "world")).toThrow();
   });

   it("should delete a value (swap-remove)", () => {
      const ref = new RefType<string>(100);
      ref.add(1, "a");
      ref.add(2, "b");
      ref.add(3, "c");
      ref.delete(1);
      expect(ref.has(1)).toBe(false);
      expect(ref.get(1)).toBeUndefined();
      expect(ref.has(2)).toBe(true);
      expect(ref.has(3)).toBe(true);
   });
});
