import type {
   ComponentDefinition,
   ComponentSchema,
   SchemaToValues,
} from "../core/component";

export interface Prefab<TSchema extends ComponentSchema = ComponentSchema> {
   name: string;
   description: string;
   components: {
      componentName: ComponentDefinition<TSchema>["name"];
      data?: SchemaToValues<TSchema>;
   }[];
}

class PrefabBuilder {
   name: string;
   description: string;
   components: { name: string; data: any }[];
   constructor({ name, description }: { name: string; description: string }) {
      this.name = name;
      this.description = description;
      this.components = [];
   }
   extendsWith(prefab: Prefab) {
      for (const componentInstance of prefab.components) {
         const { componentName, data } = componentInstance;

         const index = this.components.findIndex(
            (c) => c.name === componentName,
         );
         if (index === -1) {
            this.components.push({ name: componentName, data });
         } else {
            const currentData = this.components[index].data;
            if (data == currentData) continue; // maybe make a deep compare here?

            this.components[index].data = {
               ...currentData,
               ...data,
            };
         }
      }

      return this;
   }
   add<TSchema extends ComponentSchema>(
      def: ComponentDefinition<TSchema>,
      data?: Partial<SchemaToValues<TSchema>>,
   ) {
      const index = this.components.findIndex((ob) => ob.name == def.name);
      if (index == -1) {
         this.components.push({ name: def.name, data: data });
      } else {
         // update current
         if (!data) return this;
         const currentData = this.components[index].data;
         this.components[index].data = { ...currentData, ...data };
      }
      return this;
   }
   build(): Prefab {
      const { name, description, components } = this;
      return {
         name,
         description,
         components: components.map(({ name, data }) => ({
            componentName: name,
            data,
         })),
      };
   }
}

export const definePrefab = (name: string, description = "prefab") =>
   new PrefabBuilder({ name, description });
