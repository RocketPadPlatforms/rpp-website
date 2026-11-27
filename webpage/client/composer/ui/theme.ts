// Single-palette theme for the RPP Composer.
// No runtime toggle — the shell uses light D120 tokens; the blueprint
// card uses dark D123 tokens under the BLUEPRINT namespace.

export interface RppPalette {
  bg: string;
  bgAlt: string;
  bgMuted: string;
  border: string;
  borderStrong: string;
  textPrimary: string;
  textSecondary: string;
  textDim: string;
  disabled: string;
  disabledText: string;

  lightBlue: string;
  mainBlue: string;
  darkBlue: string;
  lightGreen: string;
  darkGreen: string;

  success: string;
  warning: string;
}

export const RPP: RppPalette = {
  bg: "#0E1B2A",
  bgAlt: "#111D30",
  bgMuted: "#152238",
  border: "#1E3350",
  borderStrong: "#2A5A82",
  textPrimary: "#E8ECF1",
  textSecondary: "#8BA4BD",
  textDim: "#6B8BA4",
  disabled: "#3A5068",
  disabledText: "#5A7A92",

  lightBlue: "#5BA3C9",
  mainBlue: "#77C6C0",
  darkBlue: "#0B2740",
  lightGreen: "#77C6C0",
  darkGreen: "#5BA3C9",

  success: "#77C6C0",
  warning: "#E8736D",
};

export interface BlueprintPalette {
  bg: string;
  card: string;
  panel: string;
  border: string;
  text: string;
  textSec: string;
  textDim: string;
  accent: string;
  rocket: string;
  flame: string;
  tooltipBg: string;
  tooltipText: string;
}

export const BLUEPRINT: BlueprintPalette = {
  bg: "#0E1B2A",
  card: "#152238",
  panel: "#111D30",
  border: "#1E3350",
  text: "#E8ECF1",
  textSec: "#8BA4BD",
  textDim: "#6B8BA4",
  accent: "#77C6C0",
  rocket: "#E8ECF1",
  flame: "#E8A06D",
  tooltipBg: "#1F2937F2",
  tooltipText: "#F3F4F6",
};

export const LAYER_COLORS: Record<string, string> = {
  compute: "#5BA3C9",
  kubernetes: "#77C6C0",
  providers: "#B5C2D3",
  "rpp-base": "#9BB8CA",
  additional: "#8FD694",
  workload: "#E8A06D",
};

export const FONTS = {
  body: "'Raleway', system-ui, sans-serif",
  heading: "'Raleway', system-ui, sans-serif",
  mono: "'JetBrains Mono', ui-monospace, monospace",
};
