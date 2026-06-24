import prisma from '../client';
import ApiError from '../utils/ApiError';
import logger from '../utils/logger';

export class AnalyticsService {
  static async getTrends({ userId, timeframe }: { userId: string; timeframe: string }) {
    const now = new Date();
    let startDate: Date | null = null;

    if (timeframe === '7d') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (timeframe === '30d') {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (timeframe === '90d') {
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    }

    // Fetch all completed, non-deleted sessions for this timeframe
    const sessions = await prisma.aIInterview.findMany({
      where: {
        userId,
        overallScore: { not: null },
        deletedAt: null,
        ...(startDate ? { createdAt: { gte: startDate } } : {})
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        createdAt: true,
        overallScore: true,
        transcript: true
      }
    });

    // 1. Line chart points
    const trendsPoints = sessions.map(s => ({
      date: s.createdAt.toISOString().split('T')[0],
      score: s.overallScore || 0
    }));

    // 2. Aggregates for the selected timeframe
    const totalSessions = sessions.length;
    
    let averageScore = 0;
    let bestScore = 0;
    let averageDuration = 0;

    if (totalSessions > 0) {
      const sumScores = sessions.reduce((sum, s) => sum + (s.overallScore || 0), 0);
      averageScore = Math.round(sumScores / totalSessions);
      bestScore = Math.max(...sessions.map(s => s.overallScore || 0));

      // Calculate durations
      let totalDuration = 0;
      let validDurationCount = 0;
      sessions.forEach(s => {
        try {
          const trans = JSON.parse(s.transcript);
          if (trans.length >= 2) {
            const start = new Date(trans[0].timestamp).getTime();
            const end = new Date(trans[trans.length - 1].timestamp).getTime();
            const duration = Math.max(1, Math.round((end - start) / 60000));
            totalDuration += duration;
            validDurationCount++;
          }
        } catch (err) {
          // ignore parsing error
        }
      });
      averageDuration = validDurationCount > 0 ? Math.round(totalDuration / validDurationCount) : 0;
    }

    // 3. Week-over-week improvement calculation
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // Sessions in the last 7 days
    const recentSessions = await prisma.aIInterview.aggregate({
      where: {
        userId,
        overallScore: { not: null },
        deletedAt: null,
        createdAt: { gte: sevenDaysAgo }
      },
      _avg: { overallScore: true }
    });

    // Sessions in the 7 days before that (days 8-14)
    const priorSessions = await prisma.aIInterview.aggregate({
      where: {
        userId,
        overallScore: { not: null },
        deletedAt: null,
        createdAt: {
          gte: fourteenDaysAgo,
          lt: sevenDaysAgo
        }
      },
      _avg: { overallScore: true }
    });

    const recentAvg = recentSessions._avg.overallScore || 0;
    const priorAvg = priorSessions._avg.overallScore || 0;

    let weekOverWeekImprovement = 0;
    if (priorAvg > 0) {
      weekOverWeekImprovement = Math.round(((recentAvg - priorAvg) / priorAvg) * 100);
    } else if (recentAvg > 0) {
      weekOverWeekImprovement = 100; // 100% improvement if they started from nothing
    }

    return {
      trends: trendsPoints,
      stats: {
        averageScore,
        bestScore,
        totalSessions,
        averageDuration,
        weekOverWeekImprovement
      }
    };
  }

  static async getScoreBreakdown(userId: string) {
    const groups = await prisma.aIInterview.groupBy({
      by: ['interviewType'],
      where: {
        userId,
        overallScore: { not: null },
        deletedAt: null
      },
      _avg: { overallScore: true },
      _count: { id: true }
    });

    const types = ['technical', 'behavioral', 'system design'];
    const breakdown = types.map(type => {
      const group = groups.find(g => g.interviewType.toLowerCase() === type);
      return {
        dimension: type.charAt(0).toUpperCase() + type.slice(1),
        score: group && group._avg.overallScore ? Math.round(group._avg.overallScore) : 0,
        sessionsCount: group ? group._count.id : 0
      };
    });

    return breakdown;
  }

  static async getActivity(userId: string) {
    const oneYearAgo = new Date();
    oneYearAgo.setDate(oneYearAgo.getDate() - 365);

    const sessions = await prisma.aIInterview.findMany({
      where: {
        userId,
        deletedAt: null,
        createdAt: { gte: oneYearAgo }
      },
      select: { createdAt: true }
    });

    // Aggregate counts by date (YYYY-MM-DD)
    const activityMap: { [date: string]: number } = {};
    sessions.forEach(s => {
      const dateStr = s.createdAt.toISOString().split('T')[0];
      activityMap[dateStr] = (activityMap[dateStr] || 0) + 1;
    });

    // Build the 365 days list
    const heatmap = [];
    for (let i = 365; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      heatmap.push({
        date: dateStr,
        count: activityMap[dateStr] || 0
      });
    }

    return heatmap;
  }
}

export default AnalyticsService;
