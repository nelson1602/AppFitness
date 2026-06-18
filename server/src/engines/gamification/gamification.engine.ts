import { ACHIEVEMENTS }                            from './achievement.definitions'
import type { GamificationContext, XPEvent }       from './gamification.types'
import { XP_TABLE, LEVEL_THRESHOLDS, LEVEL_NAMES } from './gamification.types'

export class GamificationEngine {
  calculateXP(events: Array<keyof typeof XP_TABLE>): XPEvent[] {
    return events.map(type => ({
      type,
      xp:    XP_TABLE[type],
      label: type.replace(/_/g, ' '),
    }))
  }

  levelFromTotalXP(totalXp: number): number {
    for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
      if (totalXp >= LEVEL_THRESHOLDS[i]) return i + 1
    }
    return 1
  }

  levelName(level: number): string {
    return LEVEL_NAMES[level - 1] ?? 'Legend'
  }

  xpProgress(totalXp: number): {
    level:     number
    levelName: string
    current:   number
    required:  number
    pct:       number
  } {
    const level            = this.levelFromTotalXP(totalXp)
    const currentThreshold = LEVEL_THRESHOLDS[level - 1] ?? 0
    const nextThreshold    = LEVEL_THRESHOLDS[level]      ?? LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1]
    const current          = totalXp - currentThreshold
    const required         = nextThreshold - currentThreshold
    return {
      level,
      levelName: this.levelName(level),
      current,
      required,
      pct: Math.round((current / required) * 100),
    }
  }

  checkNewAchievements(
    context:          GamificationContext,
    alreadyUnlocked:  string[],
  ): typeof ACHIEVEMENTS {
    return ACHIEVEMENTS.filter(a => !alreadyUnlocked.includes(a.key) && a.condition(context))
  }
}
