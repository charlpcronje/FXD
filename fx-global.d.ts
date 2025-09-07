// fx-global.d.ts
import type { FXNodeProxy } from "./fx";

declare global {
  const $$: {
    (path: string, value?: any): FXNodeProxy;
    // optional sugar overloads if you want TS to recognize them
    select: (selector: string) => FXNodeProxy[];
    group: (paths: string[]) => FXNodeProxy;
  };
}

export {};
