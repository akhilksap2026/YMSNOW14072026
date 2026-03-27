export function getDwellColour(minutes: number): string {
  if (minutes < 480) return "text-emerald-600 dark:text-emerald-400";
  if (minutes < 1440) return "text-amber-600 dark:text-amber-500";
  return "text-red-600 dark:text-red-400";
}

export function getDwellRowTint(minutes: number): string {
  if (minutes >= 1440) return "bg-red-50/40 dark:bg-red-950/20";
  if (minutes >= 480) return "bg-amber-50/30 dark:bg-amber-950/15";
  return "";
}
