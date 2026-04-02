import type { TickFunction } from "./types";
import type { Sekai } from "./world";

export const PhaseTypes = {
   preRender: 100,
   render: 300,
   postRender: 600,
} as const;
export type PhaseType = (typeof PhaseTypes)[keyof typeof PhaseTypes];

export interface SystemClassType extends System {}
export abstract class System {
   abstract phase: PhaseType;
   abstract enabled: boolean;
   abstract readonly name: string;
   dependencies: (new () => SystemClassType)[] = [];
   constructor() {
      this.dependencies = [];
   }
   getRunner(world: Sekai): TickFunction | undefined {
      if (!this._runner) {
         this._runner = this.createRunner(world);
      }
      return this._runner;
   }
   _runner: TickFunction | undefined;
   /**
    *
    * @param _world : World(Sekai)
    * Factory called once at registration time. Resolve stores and queries here,
    * then return a pure, JIT-friendly tick function - no `this`, no dynamic lookups.
    * Returning `undefined` excludes the system from the tick loop entirely.
    */
   abstract createRunner(_world: Sekai): TickFunction | undefined;
   abstract init(world: Sekai): void;
   abstract destroy(): void;
}
