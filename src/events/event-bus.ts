type EventListener<T> = (event: T) => void;

/**
 * Individual signal handling a single event type.
 */
export class DenDenMushi<T> {
   private listeners: EventListener<T>[] = [];

   on(cb: EventListener<T>) {
      this.listeners.push(cb);
      return () => this.off(cb);
   }

   off(cb: EventListener<T>) {
      if (typeof cb !== "function") return;
      const idx = this.listeners.indexOf(cb);
      if (idx !== -1) this.listeners.splice(idx, 1);
   }

   emit(event: T) {
      for (let i = 0; i < this.listeners.length; i++) {
         this.listeners[i](event);
      }
   }

   clear(): void {
      this.listeners.length = 0;
   }
}

export class DenDenStation<Schema = {}> {
   private channels: Partial<Record<keyof Schema, DenDenMushi<any>>> = {};

   channel<K extends keyof Schema>(name: K): DenDenMushi<Schema[K]> {
      let ch = this.channels[name];
      if (!ch) {
         ch = new DenDenMushi<Schema[K]>();
         this.channels[name] = ch;
      }
      return ch as DenDenMushi<Schema[K]>;
   }

   on<K extends keyof Schema>(
      name: K,
      cb: EventListener<Schema[K]>,
   ): () => void {
      return this.channel(name).on(cb);
   }

   emit<K extends keyof Schema>(name: K, event: Schema[K]): void {
      this.channel(name).emit(event);
   }

   destroy(name?: keyof Schema): void {
      if (name) {
         this.channels[name]?.clear();
         delete this.channels[name];
      } else {
         for (const key in this.channels) {
            this.channels[key]?.clear();
         }
         this.channels = {};
      }
   }
}
