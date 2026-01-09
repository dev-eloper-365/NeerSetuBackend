export const METRIC_CONFIG: Record<
  string,
  { field: string; label: string; unit: string }
> = {
  rainfall: { field: "rainfallTotal", label: "Rainfall", unit: "mm" },
  recharge: {
    field: "rechargeTotalTotal",
    label: "Total Recharge",
    unit: "ham",
  },
  extraction: {
    field: "draftTotalTotal",
    label: "Total Extraction",
    unit: "ham",
  },
  extractable: {
    field: "extractableTotal",
    label: "Extractable Resources",
    unit: "ham",
  },
  stage_of_extraction: {
    field: "stageOfExtractionTotal",
    label: "Stage of Extraction",
    unit: "%",
  },
  loss: { field: "lossTotal", label: "Natural Discharge", unit: "ham" },
  availability: {
    field: "availabilityFutureTotal",
    label: "Future Availability",
    unit: "ham",
  },
  irrigation_extraction: {
    field: "draftAgricultureTotal",
    label: "Irrigation Extraction",
    unit: "ham",
  },
  domestic_extraction: {
    field: "draftDomesticTotal",
    label: "Domestic Extraction",
    unit: "ham",
  },
  industrial_extraction: {
    field: "draftIndustryTotal",
    label: "Industrial Extraction",
    unit: "ham",
  },
  recharge_from_rainfall: {
    field: "rechargeRainfallTotal",
    label: "Rainfall Recharge",
    unit: "ham",
  },
  net_balance: { field: "netBalance", label: "Net Balance", unit: "ham" },
};

export function metricToField(metric: string): string {
  return METRIC_CONFIG[metric]?.field ?? metric;
}

export function metricToLabel(metric: string): string {
  return METRIC_CONFIG[metric]?.label ?? metric;
}

export function metricToUnit(metric: string): string {
  return METRIC_CONFIG[metric]?.unit ?? "";
}

export const VALID_METRICS = Object.keys(METRIC_CONFIG);
