import { defineComponent, Types } from "../core/component";

export const LightType = {
   Ambient: 0,
   Directional: 1,
   Spot: 2,
   Point: 3,
};

export const GeometryType = {
   Box: 0,
   Sphere: 1,
   Plane: 2,
   Custom: 3,
};

export const BlendingType = {
   None: 0,
   Normal: 1,
   Additive: 2,
   Subtractive: 3,
};

export const ProjectionType = {
   Perspective: 0,
   Orthographic: 1,
};
export const MaterialType = {
   Standard: 0,
   Phong: 1,
   Basic: 2,
   Physical: 3,
   Sprite: 4,
};

export const Transform = defineComponent({
   name: "Transform",
   description: "Handles position, rotation, scale, and hierarchy",
   schema: {
      x: Types.f32,
      y: Types.f32,
      z: Types.f32,
      // Euler Rotation X
      rx: Types.f32,
      ry: Types.f32,
      rz: Types.f32,
      // Scale
      sx: Types.f32,
      sy: Types.f32,
      sz: Types.f32,
   },
});

// 2. Metadata (Strings and Editor flags)
export const Meta = defineComponent({
   name: "Meta",
   description: "Non-simulated metadata for identification",
   schema: {
      name: Types.string,
      id: Types.string, // External UUID
      locked: Types.bool,
      active: Types.bool,
      order: Types.string,
   },
});

// 3. Materials (Visual properties)
export const Material = defineComponent({
   name: "Material",
   description: "PBR Material properties and asset references",
   schema: {
      materialId: Types.u32,
      color: Types.u32, // 0xRRGGBBAA
      roughness: Types.f32,
      metalness: Types.f32,
      opacity: Types.f32,
      blending: Types.u8, // Enum: 0=None, 1=Alpha, 2=Additive
   },
});

// 4. Geometry (Mesh references)
export const Geometry = defineComponent({
   name: "Geometry",
   description: "Buffer references for mesh data",
   schema: {
      type: Types.u8, // Enum: 0=Box, 1=Sphere, 2=Plane, 3=Custom
      bufferId: Types.u32, // ID for GPU buffers
      isDynamic: Types.bool,
   },
});

// 5. Renderable (Visibility and render-loop flags)
export const Renderable = defineComponent({
   name: "Renderable",
   description: "Controls for the rendering pipeline",
   schema: {
      visible: Types.bool,
      layer: Types.u8,
      castShadows: Types.bool,
      receiveShadows: Types.bool,
      frustumCulled: Types.bool,
   },
});

export const Light = defineComponent({
   name: "Light",
   description: "Light source parameters",
   schema: {
      type: Types.u8, // Enum: 0=Point, 1=Dir, 2=Spot
      color: Types.u32, // Packed Hex
      intensity: Types.f32,
      range: Types.f32,
      innerAngle: Types.f32, // For SpotLights
      outerAngle: Types.f32,
   },
});

// 7. Camera (Optics)
export const Camera = defineComponent({
   name: "Camera",
   description: "Perspective and Orthographic settings",
   schema: {
      fov: Types.f32,
      near: Types.f32,
      far: Types.f32,
      aspect: Types.f32,
      projection: Types.u8, // 0=Perspective, 1=Ortho
      priority: Types.u8, // For multi-camera setups
   },
});

// 8. Model (Complex 3D Asset)
export const Model = defineComponent({
   name: "Model",
   description: "High-level 3D model container",
   schema: {
      assetId: Types.u32, // Pointer to GLTF/FBX Resource
      isLoaded: Types.bool,
      skeletonId: Types.i32, // Pointer to Skeleton entity
      animationState: Types.u8,
   },
});

// 9. Hierarchy
export const Hierarchy = defineComponent({
   name: "Hierarchy",
   description: "Hierarchy",
   schema: {
      parent: Types.i32,
      depth: Types.u32,
   },
});
