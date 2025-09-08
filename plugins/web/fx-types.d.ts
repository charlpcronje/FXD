/* fx-types.d.ts — minimal ambient types for FX (adjust to your real fx.ts definitions) */
export interface FXNode {
  __id: string;
  __type?: string;
  __proto?: any;
  __value?: any;
  __nodes?: Record<string, FXNode>;
  watch?: (fn: (v: any) => void) => void;
}

export interface FX {
  root: FXNode;
  set: (node: FXNode, value: any) => void;
  val: (nodeOrPath: any) => any;
  resolvePath: (path: string, root?: FXNode) => FXNode | null;
  setPath: (path: string, value: any, root?: FXNode) => FXNode;
  getPath: (path: string, root?: FXNode) => FXNode | null;
  pluginManager: FXPluginManager;
}

export interface FXPlugin {
  name: string;
  version: string;
  description?: string;
  install?: (fx: FX) => void;
}

export interface FXPluginManager {
  register: (name: string, plugin: FXPlugin) => void;
  getByPrefix: (prefix: string) => any;
  has?: (nameOrPrefix: string) => boolean;
}

/** Optional global $$ selector shim (if your fx.ts exposes it) */
declare global {
  var $$: undefined | ((path: string) => { val: (v?: any) => any });
}
