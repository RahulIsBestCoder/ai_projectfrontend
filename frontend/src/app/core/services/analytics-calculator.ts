// Shape of the analytics bundle the dashboard screens render.
// Populated only from GET /v1/projects/:id/analytics — no client-side computation.

export interface CalculatedAnalytics {
  healthScore: number;
  delayProbability: number;
  codeChurn: {
    additions: number;
    deletions: number;
    filesChanged: number;
    churnRatio: number;
  };
  prMetrics: {
    totalPrs: number;
    openPrs: number;
    mergedPrs: number;
    avgReviewTimeHours: number;
    stalePrCount: number;
  };
  sprintMetrics: {
    totalPoints: number;
    completedPoints: number;
    completionPercentage: number;
    velocityHistory: { sprintName: string; planned: number; completed: number }[];
  };
  bugMetrics: {
    criticalBugs: number;
    highBugs: number;
    mediumBugs: number;
    resolvedBugs: number;
    bugDensityPerKLOC: number;
  };
  qaCapacity: {
    devsCount: number;
    qaCount: number;
    ratio: string;
    capacityPercentage: number;
  };
}
