import type { EntityId } from "../core/entity";

interface EntityPayload {
   eids: EntityId[];
}
interface ComponentPayload {
   componentNames: string[];
   eids: EntityId[];
   values?: any[];
}
export interface WorldEvents {
   "entity:create": EntityPayload;
   "entity:delete": EntityPayload;

   "component:add": ComponentPayload;
   "component:remove": ComponentPayload;
   "component:update": ComponentPayload;
}
