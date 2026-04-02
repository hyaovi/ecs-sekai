import { describe, expect, it, vi } from "vitest";
import { DenDenMushi, DenDenStation } from "./event-bus";

describe("DenDenMushi", () => {
   it("should call listener on emit", () => {
      const mushi = new DenDenMushi<number>();
      const fn = vi.fn();
      mushi.on(fn);
      mushi.emit(42);
      expect(fn).toHaveBeenCalledWith(42);
   });

   it("should remove listener with off", () => {
      const mushi = new DenDenMushi<number>();
      const fn = vi.fn();
      mushi.on(fn);
      mushi.off(fn);
      mushi.emit(1);
      expect(fn).not.toHaveBeenCalled();
   });

   it("should clear all listeners", () => {
      const mushi = new DenDenMushi<number>();
      const fn1 = vi.fn();
      const fn2 = vi.fn();
      mushi.on(fn1);
      mushi.on(fn2);
      mushi.clear();
      mushi.emit(1);
      expect(fn1).not.toHaveBeenCalled();
      expect(fn2).not.toHaveBeenCalled();
   });

   it("should not crash when listener calls off during emit", () => {
      const mushi = new DenDenMushi<number>();
      const fn2 = vi.fn();
      mushi.on(() => {
         mushi.off(fn2);
      });
      mushi.on(fn2);
      expect(() => mushi.emit(1)).not.toThrow();
   });
});

describe("DenDenStation", () => {
   interface TestSchema {
      move: { x: number; y: number };
      jump: { height: number };
   }

   it("should route events by key", () => {
      const station = new DenDenStation<TestSchema>();
      const fn = vi.fn();
      station.on("move", fn);
      station.emit("move", { x: 1, y: 2 });
      expect(fn).toHaveBeenCalledWith({ x: 1, y: 2 });
   });

   it("should not cross-emit between channels", () => {
      const station = new DenDenStation<TestSchema>();
      const moveFn = vi.fn();
      const jumpFn = vi.fn();
      station.on("move", moveFn);
      station.on("jump", jumpFn);
      station.emit("move", { x: 1, y: 2 });
      expect(moveFn).toHaveBeenCalled();
      expect(jumpFn).not.toHaveBeenCalled();
   });

   it("should destroy a single channel", () => {
      const station = new DenDenStation<TestSchema>();
      const fn = vi.fn();
      station.on("move", fn);
      station.destroy("move");
      station.emit("move", { x: 1, y: 2 });
      expect(fn).not.toHaveBeenCalled();
   });
});
