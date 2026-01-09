export interface ChartData {
  type: string;
  chartType?: string;
  tableType?: string;
  title: string;
  description?: string;
  /** Layman-friendly explanation of what this visualization shows and key insights */
  explanation?: string;
  data: unknown;
  columns?: string[];
  color?: string;
  colorByValue?: boolean;
  threshold?: { safe: number; critical: number; overExploited: number };
  lines?: string[];
  stackKeys?: string[];
  value?: number;
  headerValue?: unknown;
  defaultOpen?: boolean;
  children?: unknown[];
}

export interface CollapsibleSection {
  type: "collapsible";
  title: string;
  defaultOpen: boolean;
  children: unknown[];
}

export function collapsible(
  title: string,
  children: unknown[],
  defaultOpen = true
): CollapsibleSection {
  return { type: "collapsible", title, defaultOpen, children };
}

export function table(
  title: string,
  tableType: string,
  columns: string[],
  data: unknown[]
): ChartData {
  return { type: "table", tableType, title, columns, data };
}

export function barChart(
  title: string,
  description: string,
  data: Array<{ name: string; value: unknown; fill?: string }>,
  options: { color?: string; colorByValue?: boolean; threshold?: object } = {}
): ChartData {
  return {
    type: "chart",
    chartType: "bar",
    title,
    description,
    data,
    ...options,
  } as ChartData;
}

export function pieChart(
  title: string,
  description: string,
  data: Array<{ name: string; value: number }>
): ChartData {
  return { type: "chart", chartType: "pie", title, description, data };
}

export function lineChart(
  title: string,
  description: string,
  data: Array<{ year: string; value: unknown }>,
  threshold?: { safe: number; critical: number; overExploited: number }
): ChartData {
  return {
    type: "chart",
    chartType: "line",
    title,
    description,
    data,
    ...(threshold && { threshold }),
  };
}

export function multiLineChart(
  title: string,
  description: string,
  data: unknown[],
  lines?: string[]
): ChartData {
  return {
    type: "chart",
    chartType: "multi_line",
    title,
    description,
    data,
    ...(lines && { lines }),
  };
}

export function groupedBarChart(
  title: string,
  description: string,
  data: unknown[]
): ChartData {
  return { type: "chart", chartType: "grouped_bar", title, description, data };
}

export function statsCard(
  title: string,
  data: Record<string, unknown>
): ChartData {
  return { type: "stats", title, data };
}

export function summaryCard(
  title: string,
  year: string,
  data: Record<string, unknown>
): ChartData {
  return { type: "summary", title, data, year } as unknown as ChartData;
}

export function gaugeChart(
  title: string,
  description: string,
  value: number,
  threshold: { safe: number; critical: number; overExploited: number }
): ChartData {
  return {
    type: "chart",
    chartType: "gauge",
    title,
    description,
    value,
    threshold,
    data: { value },
  };
}

export function getStageColor(stage: number): string {
  if (stage >= 100) return "hsl(4, 90%, 58%)";
  if (stage >= 90) return "hsl(38, 92%, 50%)";
  if (stage >= 70) return "hsl(217, 91%, 60%)";
  return "hsl(142, 71%, 45%)";
}

export function countCategories(
  items: Array<{ category?: unknown }>
): Record<string, number> {
  const catCount: Record<string, number> = {};
  for (const item of items) {
    const cat = String(item.category || "Unknown");
    if (cat && cat !== "Unknown" && cat !== "null") {
      catCount[cat] = (catCount[cat] || 0) + 1;
    }
  }
  return catCount;
}

export function categoryToPieData(
  catCount: Record<string, number>
): Array<{ name: string; value: number }> {
  return Object.entries(catCount).map(([name, value]) => ({ name, value }));
}

export const EXTRACTION_THRESHOLD = {
  safe: 70,
  critical: 90,
  overExploited: 100,
};
