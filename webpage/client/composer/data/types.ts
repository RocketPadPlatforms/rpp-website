/** Raw YAML shape for a layer document */
export interface RawLayer {
  kind: "Layer";
  id: string;
  name: string;
  position: number;
  select: "single" | "multi";
  /**
   * Id of the layer that gates this one: it unlocks once that layer has a
   * selection. Defaults to the layer at `position - 1`. Set it when stacking
   * order and dependency differ — e.g. workloads sit visually above the
   * optional add-ons but must not require picking one.
   */
  unlocksAfter?: string;
}

/** Raw YAML shape for a component document */
export interface RawComponent {
  kind: "Component";
  id: string;
  name: string;
  layer: string;
  type: string;
  description: string;
  core?: boolean;
  rules?: {
    excludes?: string[];
    suggests?: string[];
  };
}

/** Resolved layer with its components attached */
export interface Layer {
  id: string;
  name: string;
  position: number;
  select: "single" | "multi";
  unlocksAfter?: string;
  components: Component[];
}

/** Resolved component with typed rules */
export interface Component {
  id: string;
  name: string;
  layer: string;
  type: string;
  description: string;
  core: boolean;
  rules: ComponentRules;
}

export interface ComponentRules {
  excludes: string[];
  suggests: string[];
}

/**
 * An instance of a user-described workload on the canvas.
 *
 * `title` and `description` hold user intent only. When the user leaves them
 * blank they stay absent, and the catalog values of the component named by
 * `type` are substituted at render time. Never bake catalog text in here: it
 * bloats share URLs, and it would freeze a copy of platform/ content that goes
 * stale as soon as the component is edited.
 */
export interface WorkloadInstance {
  type: string;
  id: string;
  title?: string;
  description?: string;
}

/** Entry in the selection array: component id string, or workload instance object. */
export type SelectionEntry = string | WorkloadInstance;

export interface Preset {
  id: string;
  name: string;
  description: string;
  components: SelectionEntry[];
}

/** Loaded and validated platform data, ready for the engine */
export interface PlatformData {
  layers: Layer[];
  components: Map<string, Component>;
  presets: Preset[];
}

/** Narrow a SelectionEntry to WorkloadInstance. */
export const isWorkload = (e: SelectionEntry): e is WorkloadInstance =>
  typeof e === "object" && e !== null;

/** Flat output JSON consumed by RPP CLI */
export interface PlatformOutput {
  schema: "v1";
  components: SelectionEntry[];
}
