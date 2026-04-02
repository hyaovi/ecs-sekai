import {
   Geometry,
   GeometryType,
   Material,
   Meta,
   Transform,
} from "./components";
import { definePrefab } from "./prefab-builder";

export const EmptyObjectPrefab = definePrefab("emtpy", "An empty object")
   .add(Transform)
   .add(Meta, { name: "empty" })
   .build();

export const PrimitiveObjectPrefab = definePrefab(
   "primitive",
   "a primitive geometry based mesh",
)
   .extendsWith(EmptyObjectPrefab)
   .add(Geometry, { type: GeometryType.Sphere })
   .add(Material)
   .add(Meta, { name: "Primitive" })
   .build();
