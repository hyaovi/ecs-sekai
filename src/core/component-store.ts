import {
   RefType,
   TypeMap,
   type ComponentDefinition,
   type ComponentSchema,
   type TypeToStorage,
} from "./component";
import { MAX_ENTITIES } from "./constants";
import type { EntityId } from "./entity";

export class Store<TSchema extends ComponentSchema = ComponentSchema> {
   changedTick: Uint32Array;
   readonly bitFlag: number;
   definition: ComponentDefinition<TSchema>;
   [key: string]: any; // this is for fields

   constructor(def: ComponentDefinition<TSchema>, bitFlag: number) {
      this.bitFlag = bitFlag;
      this.definition = def;
      this.changedTick = new Uint32Array(MAX_ENTITIES);
      this.createFields();
   }
   private createFields() {
      const schema = this.definition.schema;

      const keys = Object.keys(schema);
      for (let i = 0; i < keys.length; i++) {
         const fieldName = keys[i];
         const fieldType = schema[fieldName];
         const create = TypeMap[fieldType];
         if (!create) {
            throw new Error(
               `Field type not found: ${fieldName}: ${fieldType} for ${this.definition.name}`,
            );
         }
         (this as any)[fieldName] = create(MAX_ENTITIES);
      }
   }
   // refactor: do i actually need this ?
   reset() {
      const schema = this.definition.schema;
      const fields = Object.keys(schema);
      for (let i = 0; i < fields.length; i++) {
         const fieldName = fields[i];
         const field = this[fieldName];
         const fieldType = schema[fieldName];
         if (!field) continue;
         if (fieldType == "string" || fieldType == "ref") {
            (field as RefType).clear();
         } else {
            // maybe create and use a union-ed TypedArray??
            (field as Uint32Array).fill(0);
         }
      }
      this.changedTick.fill(0);
   }
   resetEntity(eid: EntityId) {
      const kv = Object.entries(this.definition.schema);
      for (const [k, v] of kv) {
         const field = this[k];
         if (!field) continue;
         if (v === "ref" || v === "string") {
            (field as RefType).delete(eid);
         } else {
            field[eid] = 0;
         }
      }
      this.changedTick[eid] = 0;
   }
}

export type SchemaToStore<TSchema extends ComponentSchema> = Store<TSchema> & {
   [K in keyof TSchema]: TypeToStorage[TSchema[K]];
};
