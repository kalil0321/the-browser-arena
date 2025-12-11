export function computeBrowserCost(duration: number): number {
    const hours = Math.max(duration / 3600, 0);
    return 0.2 * hours;
  }