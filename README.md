# Sekai ECS

A class-based Entity Component System framework for game development and 3D project editing.

## Description

Sekai is a TypeScript-based Entity Component System (ECS) framework designed for game development and 3D project editing. It features a headless editor architecture that can be used as a backend for various frontends.

## Features

- **Core ECS Architecture**: Entity-Component-System pattern with bitmask-based archetype system
- **Headless Editor**: Command pattern for undo/redo, history management, and inspector
- **Asset Management**: Handle-based asset storage with UUID lookup
- **Hierarchy Management**: Parent-child relationships and scene graph management
- **Event System**: DenDenStation event bus for notifications
- **Serialization**: Save and load project state

## Project Structure

```
src/ecs/
  index.ts                        # Top-level barrel: re-exports all sub-barrels

  core/                           # Core ECS runtime
    index.ts
    world.ts                      # Sekai class - main ECS world
    entity.ts                     # EntityId type, NULL_ENTITY
    component.ts                  # Types, RefType, defineComponent, ComponentDefinition
    component-store.ts            # Store class (typed-array backed)
    archetype.ts                  # ArcheType class (bitmask-based grouping)
    query.ts                      # Query, QueryTerm
    system.ts                     # System base class, PhaseTypes
    constants.ts                  # MAX_ENTITIES, MAX_COMPONENTS
    types.ts                      # TickFunction
    deferred.ts                   # DeferredOpType, DeferredOp (deferred operations during tick)
    serialization.ts              # captureWorldSnapshot, restoreWorldSnapshot, EntityData
    world.test.ts                 # Core ECS tests

  structures/                     # Reusable data structures
    index.ts
    sparse-set.ts                 # SparseSet
    tracker.ts                    # SyncTracker, Tracker

  events/                         # Event system
    index.ts
    event-bus.ts                  # DenDenMushi (signal), DenDenStation (hub) - generic
    editor-events.ts              # EditorEvents interface + payload types

  prefabs/                        # Predefined components and prefab builder
    index.ts
    components.ts                 # Transform, Meta, Material, Geometry, Renderable, etc.
    prefab-builder.ts             # PrefabBuilder, definePrefab

  editor/                         # Headless editor layer
    index.ts
    editor.ts                     # EditorAPI facade
    commands.ts                   # Command type definitions (entity, component, asset, batch)
    command-executor.ts           # Execute/undo/redo command handling
    inspector.ts                  # EditorInspector (entity inspection)
    history.ts                    # History stack (undo/redo)
    asset-manager.ts              # AssetRegistery (handle-based storage)
    hierarchy-helper.ts           # HierarchyHelper (parent-child, tree building)
    validation.ts                 # validateComponentDefinition

  utils/                          # Browser utilities
    index.ts
    download.ts                   # downloadJSON

  benchmarks/                     # Performance benchmarks
    bench.ts                      # tinybench comparisons (Sekai vs bitECS)
    benchmark.ts                  # Simple benchmark harness
```

### Dependency Layers

All dependencies point downward - no circular imports.

```
L0 (leaf):  constants, types, entity
L1:         component, sparse-set, tracker
L2:         component-store, archetype, event-bus
L3:         query, system, deferred
L4:         world, serialization
L5:         editor-events, prefabs, prefab-builder
L6:         inspector, history, asset-manager, validation
L7:         commands, hierarchy-helper
L8:         command-executor
L9:         editor (facade)
```

## Development

```bash
pnpm run dev     # Start dev server
pnpm run build   # Type-check + production build
pnpm run test    # Run tests (vitest)
```

## Status

Work in Progress - this project is actively being developed.
