import { prisma }              from '@/config/prisma'
import { GamificationEngine } from '@/engines/gamification/gamification.engine'
import { ACHIEVEMENTS }       from '@/engines/gamification/achievement.definitions'
import { XP_TABLE }           from '@/engines/gamification/gamification.types'
import type { GamificationContext } from '@/engines/gamification/gamification.types'

const engine = new GamificationEngine()

export const getOrCreateStats = (userId: string) =>
  prisma.userStats.upsert({
    where:  { userId },
    create: { userId },
    update: {},
  })

export const awardXP = async (userId: string, events: Array<keyof typeof XP_TABLE>): Promise<number> => {
  if (!events.length) return 0

  const xpEvents = engine.calculateXP(events)
  const totalXP  = xpEvents.reduce((acc, e) => acc + e.xp, 0)

  const stats = await prisma.userStats.upsert({
    where:  { userId },
    create: { userId, xp: totalXP, totalXp: totalXP },
    update: { xp: { increment: totalXP }, totalXp: { increment: totalXP } },
  })

  const newLevel = engine.levelFromTotalXP(stats.totalXp)
  if (newLevel !== stats.level) {
    await prisma.userStats.update({ where: { userId }, data: { level: newLevel } })
  }

  return totalXP
}

export const updateStreak = async (userId: string, activityDate: string): Promise<void> => {
  const stats = await getOrCreateStats(userId)
  const last  = stats.lastActivityDate

  if (!last) {
    await prisma.userStats.update({
      where: { userId },
      data:  { currentStreak: 1, longestStreak: 1, lastActivityDate: activityDate },
    })
    return
  }

  const prev = new Date(activityDate + 'T12:00:00')
  prev.setDate(prev.getDate() - 1)
  const prevStr = prev.toISOString().split('T')[0]

  const newStreak    = last === prevStr || last === activityDate
    ? (last === activityDate ? stats.currentStreak : stats.currentStreak + 1)
    : 1
  const longestStreak = Math.max(stats.longestStreak, newStreak)

  await prisma.userStats.update({
    where: { userId },
    data:  { currentStreak: newStreak, longestStreak, lastActivityDate: activityDate },
  })
}

export const incrementCounter = (
  userId: string,
  field:  'workoutsLogged' | 'mealsLogged' | 'weightsLogged' | 'prsSet',
  by = 1,
) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prisma.userStats.upsert({
    where:  { userId },
    create: { userId, [field]: by } as any,
    update: { [field]: { increment: by } } as any,
  })

export const checkAndUnlockAchievements = async (
  userId:  string,
  context: GamificationContext,
): Promise<typeof ACHIEVEMENTS> => {
  const unlocked = await prisma.userAchievement.findMany({
    where:   { userId },
    include: { achievement: { select: { key: true } } },
  })
  const unlockedKeys = unlocked.map(u => u.achievement.key)
  const newOnes      = engine.checkNewAchievements(context, unlockedKeys)

  if (newOnes.length > 0) {
    const achRecords = await prisma.achievement.findMany({
      where: { key: { in: newOnes.map(a => a.key) } },
    })
    for (const a of achRecords) {
      await prisma.userAchievement.upsert({
        where:  { userId_achievementId: { userId, achievementId: a.id } },
        create: { userId, achievementId: a.id },
        update: {},
      })
    }
    const bonusXP = newOnes.reduce((acc, a) => acc + a.xpReward, 0)
    if (bonusXP > 0) {
      await prisma.userStats.upsert({
        where:  { userId },
        create: { userId, xp: bonusXP, totalXp: bonusXP },
        update: { xp: { increment: bonusXP }, totalXp: { increment: bonusXP } },
      })
    }
  }

  return newOnes
}

export const getUserGamification = async (userId: string) => {
  const [stats, userAchs, allAchs] = await Promise.all([
    getOrCreateStats(userId),
    prisma.userAchievement.findMany({
      where:   { userId },
      include: { achievement: true },
      orderBy: { unlockedAt: 'desc' },
    }),
    prisma.achievement.findMany({ orderBy: { category: 'asc' } }),
  ])

  const unlockedKeys = userAchs.map(a => a.achievement.key)

  return {
    stats,
    xpProgress:   engine.xpProgress(stats.totalXp),
    achievements: allAchs.map(a => ({
      ...a,
      unlocked:   unlockedKeys.includes(a.key),
      unlockedAt: userAchs.find(u => u.achievement.key === a.key)?.unlockedAt ?? null,
    })),
  }
}
