import type { ComponentDefinition, SchemaToValues } from "./component";
import type { EntityId } from "./entity";

export const DeferredOpType = {
   DestructEntity: 0,
   AddComponent: 1,
   RemoveComponent: 2,
   UpdateComponent: 3,
} as const;

export type DeferredOpType =
   (typeof DeferredOpType)[keyof typeof DeferredOpType];

export interface DeferredDestructEntity {
   type: typeof DeferredOpType.DestructEntity;
   eid: EntityId;
}

export interface DeferredAddComponent {
   type: typeof DeferredOpType.AddComponent;
   eid: EntityId;
   componentDef: ComponentDefinition;
}

export interface DeferredRemoveComponent {
   type: typeof DeferredOpType.RemoveComponent;
   eid: EntityId;
   componentDef: ComponentDefinition;
}

export interface DeferredUpdateComponent {
   type: typeof DeferredOpType.UpdateComponent;
   eid: EntityId;
   componentDef: ComponentDefinition;
   data: Partial<SchemaToValues<any>>;
}

export type DeferredOp =
   | DeferredDestructEntity
   | DeferredAddComponent
   | DeferredRemoveComponent
   | DeferredUpdateComponent;
