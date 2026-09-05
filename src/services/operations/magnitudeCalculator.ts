import type { MagnitudeWeights } from '../../types/operations';


export const DEFAULT_MAGNITUDE_WEIGHTS: MagnitudeWeights = {
  workerWeight: 0.40,
  toolWeight: 0.30,
  priorityWeight: 0.20,
  costWeight: 0.10,
};

export const MIN_BUBBLE_SIZE_PX = 36;
export const MAX_BUBBLE_SIZE_PX = 76;

/**
 * Calculates the raw magnitude index for a worksite based on assigned resources and priority.
 */
export function calculateRawMagnitude(
  workersCount: number,
  toolsCount: number,
  priorityScore: number = 1,
  weights: MagnitudeWeights = DEFAULT_MAGNITUDE_WEIGHTS
): number {
  return (
    workersCount * weights.workerWeight * 10 +
    toolsCount * weights.toolWeight * 5 +
    priorityScore * weights.priorityWeight * 10
  );
}

/**
 * Normalizes worksite magnitudes across all visible worksites and computes
 * the pixel diameter for the interactive map bubble.
 * Uses logarithmic smoothing so a very large worksite doesn't monopolize the visualization.
 */
export function computeRelativeBubbleRadius(
  rawMagnitude: number,
  minRawMagnitude: number,
  maxRawMagnitude: number
): number {
  if (maxRawMagnitude <= minRawMagnitude) {
    return (MIN_BUBBLE_SIZE_PX + MAX_BUBBLE_SIZE_PX) / 2;
  }

  // Logarithmic transformation to prevent extreme spikes
  const logVal = Math.log1p(Math.max(0, rawMagnitude - minRawMagnitude));
  const logMax = Math.log1p(Math.max(0.001, maxRawMagnitude - minRawMagnitude));
  const ratio = Math.min(1, Math.max(0, logVal / logMax));

  const size = MIN_BUBBLE_SIZE_PX + ratio * (MAX_BUBBLE_SIZE_PX - MIN_BUBBLE_SIZE_PX);
  return Math.round(size);
}
