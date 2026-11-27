// The composer has a single dark palette; BLUEPRINT holds the tooltip colours.

export interface RppPalette {
  bg: string;
  bgAlt: string;
  bgMuted: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textDim: string;
  mainBlue: string;
  warning: string;
}

export const RPP: RppPalette = {
  bg: "#0E1B2A",
  bgAlt: "#111D30",
  bgMuted: "#152238",
  border: "#1E3350",
  textPrimary: "#E8ECF1",
  textSecondary: "#8BA4BD",
  textDim: "#6B8BA4",
  mainBlue: "#77C6C0",
  warning: "#E8736D",
};

export interface BlueprintPalette {
  accent: string;
  tooltipBg: string;
  tooltipText: string;
}

export const BLUEPRINT: BlueprintPalette = {
  accent: "#77C6C0",
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
