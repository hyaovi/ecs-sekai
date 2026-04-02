import { describe, expect, it, beforeEach } from "vitest";
import { SyncTracker, Tracker } from "./tracker";

describe("SyncTracker", () => {
   let tracker: SyncTracker;

   beforeEach(() => {
      tracker = new SyncTracker(100);
   });

   it("should drain and return tracked entities (deduped)", () => {
      tracker.track(1);
      tracker.track(2);
      tracker.track(2);
      const drained = tracker.drain();
      expect(drained.length).toBe(2);
      expect([...drained]).toContain(1);
      expect([...drained]).toContain(2);
   });

   it("should allow re-tracking after drain", () => {
      tracker.track(5);
      tracker.drain();
      tracker.track(5);
      expect(tracker.count).toBe(1);
   });
});

describe("Tracker", () => {
   let tracker: Tracker;

   beforeEach(() => {
      tracker = new Tracker(100);
   });

   it("should flush a single entity (swap-remove)", () => {
      tracker.track(1);
      tracker.track(2);
      tracker.track(3);
      tracker.flushEntity(2);
      expect(tracker.counter).toBe(2);
      expect(tracker.dirtySet[2]).toBe(0);
      expect(tracker.dirtySet[1]).toBe(1);
      expect(tracker.dirtySet[3]).toBe(1);
   });

   it("should flush all entities", () => {
      tracker.track(1);
      tracker.track(2);
      tracker.track(3);
      tracker.flushAll();
      expect(tracker.counter).toBe(0);
      expect(tracker.dirtySet[1]).toBe(0);
      expect(tracker.dirtySet[2]).toBe(0);
      expect(tracker.dirtySet[3]).toBe(0);
   });

   it("should drain and return tracked entities", () => {
      tracker.track(1);
      tracker.track(2);
      const drained = tracker.drain();
      expect(drained).toBeDefined();
      expect(drained.length).toBe(2);
   });
});
