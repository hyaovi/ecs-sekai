import { MAX_DEFINED, MAX_ENTITIES } from "./constants";
import type { EntityId } from "./entity";

export const Types = {
   i8: "i8",
   u8: "u8",
   i16: "i16",
   u16: "u16",
   i32: "i32",
   u32: "u32",
   f32: "f32",

   // custom
   bool: "bool",
   string: "string",
   ref: "ref",
} as const;

export type TypeKey = (typeof Types)[keyof typeof Types];
export const globalDefinitions: Set<ComponentDefinition> = new Set();

let idx = 1;
const getNewId = () => {
   if (MAX_DEFINED === idx) throw new Error("Max defined reached");
   return idx++;
};

export class RefType<T = any> {
   values: Array<T>;
   eidToIndex: Uint32Array;
   indexToEid: Uint32Array;
   constructor(length = MAX_ENTITIES) {
      this.values = [];
      this.eidToIndex = new Uint32Array(length).fill(0xffffffff);
      this.indexToEid = new Uint32Array(length);
   }
   add(eid: number, value: T) {
      if (this.has(eid)) throw new Error(`Cannot eid:${eid} multipe times`);
      const id = this.values.push(value) - 1;
      this.eidToIndex[eid] = id;
      this.indexToEid[id] = eid;
   }
   set(eid: EntityId, value: T) {
      if (!this.has(eid)) {
         this.add(eid, value);
      }
      this.values[this.eidToIndex[eid]] = value;
   }
   delete(eid: number) {
      const id = this.eidToIndex[eid];
      if (id === 0xffffffff) return;

      const lastId = this.values.length - 1;
      if (lastId !== id) {
         const lastEidValue = this.values[lastId];
         const lastEid = this.indexToEid[lastId];

         this.values[id] = lastEidValue;
         this.indexToEid[id] = lastEid;
         this.eidToIndex[lastEid] = id;
      }

      this.values.pop();
      this.eidToIndex[eid] = -1;
   }
   get(eid: number): T | undefined {
      const id = this.eidToIndex[eid];
      if (id === -1) return;
      return this.values[id];
   }
   has(eid: number): boolean {
      const id = this.eidToIndex[eid];
      return id !== 0xffffffff && id < this.values.length;
   }
   clear() {
      this.values.length = 0;
      this.eidToIndex.fill(-1);
      this.indexToEid.fill(-1);
   }
}

export const TypeMap = {
   [Types.i8]: (length: number) => new Int8Array(length),
   [Types.u8]: (length: number) => new Uint8Array(length),
   [Types.i16]: (length: number) => new Int16Array(length),
   [Types.u16]: (length: number) => new Uint16Array(length),
   [Types.i32]: (length: number) => new Int32Array(length),
   [Types.u32]: (length: number) => new Uint32Array(length),
   [Types.f32]: (length: number) => new Float32Array(length),
   [Types.bool]: (length: number) => new Uint8Array(length),
   [Types.string]: (length: number) => new RefType<string>(length),
   [Types.ref]: (length: number) => new RefType<any>(length),
} as const;

export type TypeToStorage = {
   i8: Int8Array;
   u8: Uint8Array;
   i16: Int16Array;
   u16: Uint16Array;
   i32: Int32Array;
   u32: Uint32Array;
   f32: Float32Array;
   bool: Uint8Array;
   string: RefType<string>;
   ref: RefType<any>;
};

export interface ComponentSchema {
   [key: string]: keyof typeof Types;
}
export interface ComponentDefinition<
   TSchema extends ComponentSchema = ComponentSchema,
> {
   name: string;
   description: string;
   schema: TSchema;
   id: number;
}

type TypedArrayType =
   | "i8"
   | "u8"
   | "i16"
   | "u16"
   | "i32"
   | "u32"
   | "f32"
   | "f64";

export type SchemaToValues<TSchema extends ComponentSchema> = {
   [K in keyof TSchema]: TSchema[K] extends TypedArrayType
      ? number
      : TSchema[K] extends "bool"
        ? boolean
        : TSchema[K] extends "string"
          ? string
          : TSchema[K] extends "ref"
            ? any
            : never;
};

interface ComponentInstanceBase<TData> {
   // component definition name
   name: string;
   data: TData;
}
export type ComponentInstance<
   TSchema extends ComponentSchema = ComponentSchema,
> = ComponentInstanceBase<SchemaToValues<TSchema>>;

export type PartialComponentInstance<TSchema extends ComponentSchema> =
   ComponentInstanceBase<Partial<SchemaToValues<TSchema>>>;

export function defineComponent<
   TSchema extends ComponentSchema = ComponentSchema,
>(
   defInput: Omit<ComponentDefinition<TSchema>, "id" | "bitFlag">,
): ComponentDefinition<TSchema> {
   const def = defInput as ComponentDefinition<TSchema>;
   if (def.id !== undefined && globalDefinitions.has(def)) {
      console.warn(` Defintion has been register ${def.name}`);
      return def;
   }
   globalDefinitions.add(def);
   def.id = getNewId();
   return def;
}
