import { buildRoutine } from './routine.builder'
import type { RoutineRecommendation } from './workout.types'
import type { UserProfileData } from '../coach/coach.types'
import type { TrainingAdjustment } from '../recommendation/recommendation.types'

export class WorkoutEngine {
  generate(profile: UserProfileData, adj: TrainingAdjustment): RoutineRecommendation {
    return buildRoutine(profile, adj)
  }
}
