/**
 * Utility functions to generate layman-friendly explanations for charts and visualizations.
 * These explanations help users understand what the data means in simple terms.
 */

/**
 * Format a number in a human-readable way with Indian locale
 */
function formatNum(value: unknown): string {
  if (value === null || value === undefined) return "no data";
  const num = Number(value);
  if (isNaN(num)) return "no data";
  if (num >= 10000000) return `${(num / 10000000).toFixed(1)} crore`;
  if (num >= 100000) return `${(num / 100000).toFixed(1)} lakh`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)} thousand`;
  return num.toFixed(1);
}

/**
 * Get category explanation in simple terms
 */
export function getCategoryExplanation(category: string): string {
  const categoryMap: Record<string, string> = {
    safe: "Water levels are healthy here - there's enough underground water for current needs.",
    semi_critical:
      "Water usage is moderate but needs attention - we're using a fair amount of what's available.",
    "semi-critical":
      "Water usage is moderate but needs attention - we're using a fair amount of what's available.",
    critical:
      "Water levels are concerning - we're using most of the available underground water.",
    over_exploited:
      "Water is being used faster than nature can replenish it - this area needs urgent conservation.",
    "over-exploited":
      "Water is being used faster than nature can replenish it - this area needs urgent conservation.",
    salinity:
      "The water quality is affected by salt content, making it less suitable for some uses.",
    hilly_area:
      "This is a hilly region with different water characteristics than flat areas.",
  };
  return (
    categoryMap[category?.toLowerCase()] ||
    "The water status category is not determined."
  );
}

/**
 * Get stage of extraction explanation
 */
export function getStageExplanation(stage: number): string {
  if (stage < 70) {
    return `Only ${stage.toFixed(
      0
    )}% of available water is being used - this is a healthy, sustainable level. There's plenty of room for future needs.`;
  }
  if (stage < 90) {
    return `About ${stage.toFixed(
      0
    )}% of available water is being used - this is getting to a concerning level. Conservation measures would help maintain balance.`;
  }
  if (stage < 100) {
    return `Nearly ${stage.toFixed(
      0
    )}% of available water is being used - this is critical! We're close to using all the water that nature replenishes each year.`;
  }
  return `${stage.toFixed(
    0
  )}% extraction means we're using MORE water than nature can refill each year. This is unsustainable and will lead to falling water tables.`;
}

/**
 * Generate explanation for summary/stats card
 */
export function generateSummaryExplanation(
  data: Record<string, unknown>
): string {
  const parts: string[] = [];

  const stage = Number(data.stageOfExtraction);
  if (!isNaN(stage)) {
    parts.push(getStageExplanation(stage));
  }

  const category = String(data.category || "");
  if (category && category !== "null") {
    parts.push(getCategoryExplanation(category));
  }

  const extraction = Number(data.extractionTotal || data.draftTotalTotal);
  const extractable = Number(data.extractableTotal);
  if (!isNaN(extraction) && !isNaN(extractable) && extractable > 0) {
    const remaining = extractable - extraction;
    if (remaining > 0) {
      parts.push(
        `There's about ${formatNum(
          remaining
        )} ham of underground water still available for future use.`
      );
    } else {
      parts.push(
        "All available underground water is already being used, leaving nothing for future expansion."
      );
    }
  }

  return parts.join(" ");
}

/**
 * Generate explanation for recharge chart
 */
export function generateRechargeExplanation(
  data: Array<{ name: string; value: unknown }>,
  total: unknown
): string {
  if (!data || data.length === 0) return "No recharge data available.";

  const sortedData = [...data]
    .filter((d) => Number(d.value) > 0)
    .sort((a, b) => Number(b.value) - Number(a.value));

  if (sortedData.length === 0)
    return "No significant recharge sources recorded.";

  const topSource = sortedData[0];
  const totalNum = Number(total);
  const topPercent =
    totalNum > 0 ? (Number(topSource.value) / totalNum) * 100 : 0;

  return `This shows where underground water comes from. ${
    topSource.name
  } is the biggest source, contributing ${topPercent.toFixed(
    0
  )}% of all water recharge (${formatNum(
    topSource.value
  )} ham). The total water added to underground reserves is ${formatNum(
    total
  )} ham per year.`;
}

/**
 * Generate explanation for extraction pie chart
 */
export function generateExtractionPieExplanation(
  data: Array<{ name: string; value: unknown }>
): string {
  if (!data || data.length === 0) return "No extraction data available.";

  const total = data.reduce((sum, d) => sum + Number(d.value || 0), 0);
  const sortedData = [...data].sort(
    (a, b) => Number(b.value) - Number(a.value)
  );

  const parts: string[] = [
    "This pie chart shows how underground water is being used:",
  ];

  for (const item of sortedData) {
    const percent = total > 0 ? (Number(item.value) / total) * 100 : 0;
    if (percent > 0) {
      parts.push(`• ${item.name}: ${percent.toFixed(0)}%`);
    }
  }

  if (sortedData[0]?.name === "Irrigation") {
    parts.push(
      "Farming uses the most water, which is common across India where agriculture is the primary water consumer."
    );
  }

  return parts.join(" ");
}

/**
 * Generate explanation for stage of extraction bar chart
 */
export function generateStageComparisonExplanation(
  data: Array<{ name: string; value: number; category?: string }>
): string {
  if (!data || data.length === 0) return "No comparison data available.";

  const safe = data.filter((d) => d.value < 70);
  const critical = data.filter((d) => d.value >= 90 && d.value < 100);
  const overExploited = data.filter((d) => d.value >= 100);

  const parts: string[] = [
    "This chart compares how much water is being extracted across different areas:",
  ];

  if (safe.length > 0) {
    parts.push(
      `✓ ${safe.length} area(s) have healthy water levels (under 70% usage).`
    );
  }
  if (critical.length > 0) {
    parts.push(
      `⚠ ${critical.length} area(s) are critical (90-100% usage) and need attention.`
    );
  }
  if (overExploited.length > 0) {
    parts.push(
      `🚨 ${overExploited.length} area(s) are over-exploited (above 100%) - water is being used faster than it can be replenished!`
    );
  }

  return parts.join(" ");
}

/**
 * Generate explanation for trend line chart
 */
export function generateTrendExplanation(
  data: Array<{ year: string; value?: number; [key: string]: unknown }>,
  metricName: string
): string {
  if (!data || data.length < 2) return "Not enough data to show a trend.";

  const sortedData = [...data].sort((a, b) => a.year.localeCompare(b.year));
  const firstValue = Number(sortedData[0].value);
  const lastValue = Number(sortedData[sortedData.length - 1].value);

  if (isNaN(firstValue) || isNaN(lastValue)) {
    return "This chart shows how values have changed over the years.";
  }

  const change = lastValue - firstValue;
  const percentChange =
    firstValue !== 0 ? ((change / Math.abs(firstValue)) * 100).toFixed(1) : "0";
  const direction =
    change > 0 ? "increased" : change < 0 ? "decreased" : "stayed the same";

  return `This shows how ${metricName.toLowerCase()} has changed over ${
    sortedData.length
  } years (${sortedData[0].year} to ${
    sortedData[sortedData.length - 1].year
  }). The value ${direction} by ${Math.abs(change).toFixed(
    1
  )} (${percentChange}% change). ${
    change > 0
      ? "An upward trend."
      : change < 0
      ? "A downward trend."
      : "No significant change."
  }`;
}

/**
 * Generate explanation for rainfall trend
 */
export function generateRainfallTrendExplanation(
  data: Array<{ name: string; value: unknown }>
): string {
  if (!data || data.length === 0) return "No rainfall data available.";

  const values = data.map((d) => Number(d.value)).filter((v) => !isNaN(v));
  if (values.length === 0) return "No valid rainfall data.";

  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const maxYear = data.find((d) => Number(d.value) === max)?.name;
  const minYear = data.find((d) => Number(d.value) === min)?.name;

  return `Rainfall varies year to year. The average is ${formatNum(
    avg
  )} mm. The highest rainfall (${formatNum(
    max
  )} mm) was in ${maxYear}, and the lowest (${formatNum(
    min
  )} mm) was in ${minYear}. Good rainfall helps recharge underground water.`;
}

/**
 * Generate explanation for water balance chart
 */
export function generateWaterBalanceExplanation(
  data: Record<string, unknown>
): string {
  const recharge = Number(data.recharge);
  const extraction = Number(data.extraction);
  const naturalDischarge = Number(data.naturalDischarge);
  const extractable = Number(data.extractable);

  if (isNaN(recharge) || isNaN(extraction)) {
    return "This shows the balance between water coming in and going out.";
  }

  const netBalance = recharge - extraction - (naturalDischarge || 0);
  const balanceStatus =
    netBalance > 0
      ? "positive (more water coming in than going out)"
      : netBalance < 0
      ? "negative (more water being used than replenished)"
      : "balanced";

  return `The water balance is ${balanceStatus}. Each year, about ${formatNum(
    recharge
  )} ham of water is added through rain and other sources, while ${formatNum(
    extraction
  )} ham is pumped out for use. ${
    netBalance < 0
      ? "This means water levels are likely dropping over time."
      : "This suggests water levels can be maintained."
  }`;
}

/**
 * Generate explanation for comparison charts
 */
export function generateComparisonExplanation(
  data: Array<{ name: string; value: unknown }>,
  metricName: string,
  unit: string = ""
): string {
  if (!data || data.length === 0) return "No comparison data available.";

  const sortedData = [...data]
    .filter((d) => !isNaN(Number(d.value)))
    .sort((a, b) => Number(b.value) - Number(a.value));

  if (sortedData.length === 0) return "No valid data for comparison.";

  const highest = sortedData[0];
  const lowest = sortedData[sortedData.length - 1];

  return `Comparing ${metricName.toLowerCase()} across ${data.length} areas: ${
    highest.name
  } has the highest value (${formatNum(highest.value)}${
    unit ? " " + unit : ""
  }), while ${lowest.name} has the lowest (${formatNum(lowest.value)}${
    unit ? " " + unit : ""
  }). The difference shows how water conditions vary across regions.`;
}

/**
 * Generate explanation for multi-line trend comparison
 */
export function generateMultiLineTrendExplanation(
  data: Array<Record<string, unknown>>,
  lines: string[]
): string {
  if (!data || data.length < 2 || !lines || lines.length === 0) {
    return "This chart compares trends over time for multiple metrics.";
  }

  return `This chart shows how ${lines.join(", ")} have changed over ${
    data.length
  } years. You can see which metrics are increasing, decreasing, or staying stable by following each line. Look for lines that cross or diverge - these show important changes in the relationship between different factors.`;
}

/**
 * Generate explanation for category distribution pie chart
 */
export function generateCategoryDistributionExplanation(
  data: Array<{ name: string; value: number }>
): string {
  if (!data || data.length === 0) return "No category data available.";

  const total = data.reduce((sum, d) => sum + d.value, 0);
  const sortedData = [...data].sort((a, b) => b.value - a.value);

  const parts: string[] = [
    `This shows how ${total} areas are classified by water health:`,
  ];

  for (const item of sortedData) {
    const percent = ((item.value / total) * 100).toFixed(0);
    parts.push(`• ${item.name}: ${item.value} areas (${percent}%)`);
  }

  const safe = data.find((d) => d.name.toLowerCase() === "safe");
  const overExploited = data.find(
    (d) =>
      d.name.toLowerCase().includes("over") ||
      d.name.toLowerCase().includes("exploited")
  );

  if (safe && safe.value > total / 2) {
    parts.push("Good news! Most areas have safe water levels.");
  } else if (overExploited && overExploited.value > total / 4) {
    parts.push(
      "Concerning: A significant portion of areas are over-exploited and need conservation action."
    );
  }

  return parts.join(" ");
}

/**
 * Generate explanation for year-over-year change chart
 */
export function generateYoYChangeExplanation(
  data: Array<{ name: string; extraction?: number; recharge?: number }>
): string {
  if (!data || data.length === 0)
    return "This shows percentage changes from year to year.";

  const recentChange = data[data.length - 1];
  const parts: string[] = [
    "This chart shows how extraction and recharge changed each year compared to the previous year.",
  ];

  if (recentChange) {
    if (recentChange.extraction !== undefined) {
      const direction = recentChange.extraction > 0 ? "increased" : "decreased";
      parts.push(
        `In the latest year (${
          recentChange.name
        }), extraction ${direction} by ${Math.abs(
          recentChange.extraction
        ).toFixed(1)}%.`
      );
    }
    if (recentChange.recharge !== undefined) {
      const direction = recentChange.recharge > 0 ? "increased" : "decreased";
      parts.push(
        `Recharge ${direction} by ${Math.abs(recentChange.recharge).toFixed(
          1
        )}%.`
      );
    }
  }

  return parts.join(" ");
}
