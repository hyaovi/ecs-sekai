import {
   Geometry,
   GeometryType,
   Hierarchy,
   Light,
   LightType,
   Material,
   Meta,
   Renderable,
   Transform,
} from "./components";
import { definePrefab } from "./prefab-builder";

export const EmptyObjectPrefab = definePrefab("empty", "An empty object")
   .add(Transform, { sx: 1, sy: 1, sz: 1 })
   .add(Hierarchy)
   .add(Renderable, {
      visible: true,
      castShadows: true,
      receiveShadows: true,
      frustumCulled: true,
   })
   .add(Meta, { name: "empty" })
   .build();

export const PrimitiveObjectPrefab = definePrefab(
   "primitive",
   "a primitive geometry based mesh",
)
   .extendsWith(EmptyObjectPrefab)
   .add(Geometry, { type: GeometryType.Sphere })
   .add(Material, { color: 0xcccccc })
   .add(Meta, { name: "Primitive", active: true })
   .build();

export const LightPrefab = definePrefab("light", "Light object")
   .extendsWith(EmptyObjectPrefab)
   .add(Light, { type: LightType.Directional, intensity: 1, color: 0xffffff })
   .build();
export const AmbientLightPrefab = definePrefab("ambient", "Light object")
   .extendsWith(EmptyObjectPrefab)
   .add(Light, { type: LightType.Ambient, intensity: 1, color: 0xffffff })
   .build();

export const BoxPrefab = definePrefab("box", "box object")
   .extendsWith(PrimitiveObjectPrefab)
   .add(Geometry, { type: GeometryType.Box })
   .add(Material, { color: 0xffcc00 })
   .build();
