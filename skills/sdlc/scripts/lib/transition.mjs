export const PHASES = ['intake', 'spec_plan', 'implement', 'test', 'review', 'ship', 'done'];

export function nextPhase(phase) {
  const i = PHASES.indexOf(phase);
  if (i === -1) throw new Error(`unknown phase: ${phase}`);
  return PHASES[Math.min(i + 1, PHASES.length - 1)];
}
