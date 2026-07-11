import type { WorkflowPhase } from '@/lib/film-creation-panel-model';

export type FilmPlanOutcome = 'success' | 'error' | 'cancelled';

type FilmPostScriptTransition = {
  phase: WorkflowPhase;
  queueAssetGeneration: boolean;
};

export function resolveFilmPostScriptTransition({
  outcome,
  entityCardCount,
}: {
  outcome: FilmPlanOutcome;
  entityCardCount: number;
}): FilmPostScriptTransition {
  if (outcome !== 'success' || entityCardCount <= 0) {
    return { phase: 'planning', queueAssetGeneration: false };
  }

  return { phase: 'visual', queueAssetGeneration: true };
}
