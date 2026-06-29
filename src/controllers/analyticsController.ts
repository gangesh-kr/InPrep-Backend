import { Response } from 'express';
import prisma from '../client';
import { AuthRequest } from '../middleware/auth';
import AnalyticsService from '../services/AnalyticsService';

export const getSummary = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const totalApplications = await prisma.application.count({
      where: { userId },
    });

    const applicationsWithRounds = await prisma.application.count({
      where: {
        userId,
        rounds: {
          some: {},
        },
      },
    });

    const totalOffers = await prisma.application.count({
      where: {
        userId,
        status: 'Offer',
      },
    });

    // Average confidence level of all logged questions
    const averageQuestionConfidence = await prisma.question.aggregate({
      where: {
        userId,
      },
      _avg: {
        confidenceLevel: true,
      },
    });

    const avgConfidence = averageQuestionConfidence._avg.confidenceLevel || 5.0;

    // Calculate a dynamic readiness score (out of 100)
    // Formula: 40% based on average question confidence + 40% based on round success + 20% backlog study progress
    const avgConfidenceContribution = avgConfidence * 4; // 0 to 40 points

    const rounds = await prisma.interviewRound.findMany({
      where: {
        application: {
          userId,
        },
      },
      select: {
        confidenceScore: true,
      },
    });

    const totalRounds = rounds.length;
    const avgRoundConfidence = totalRounds > 0 
      ? rounds.reduce((sum, r) => sum + (r.confidenceScore || 5), 0) / totalRounds 
      : 5.0;
    const roundContribution = avgRoundConfidence * 4; // 0 to 40 points

    const learningItems = await prisma.learningItem.findMany({
      where: { userId },
    });
    const avgLearningProgress = learningItems.length > 0
      ? learningItems.reduce((sum, item) => sum + item.progressPercent, 0) / learningItems.length
      : 50;
    const learningContribution = (avgLearningProgress / 100) * 20; // 0 to 20 points

    const readinessScore = Math.min(100, Math.max(10, Math.round(avgConfidenceContribution + roundContribution + learningContribution)));

    // Response rate: % of applications that moved past 'Applied' status
    const respondedApps = await prisma.application.count({
      where: {
        userId,
        status: {
          not: 'Applied',
        },
      },
    });

    const responseRate = totalApplications > 0
      ? Math.round((respondedApps / totalApplications) * 100)
      : 0;

    const interviewRate = totalApplications > 0
      ? Math.round((applicationsWithRounds / totalApplications) * 100)
      : 0;

    return res.json({
      totalApplications,
      responseRate,
      interviewRate,
      totalOffers,
      readinessScore,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const getSkillsDistribution = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const skills = await prisma.skill.findMany({
      where: { userId },
      include: {
        questions: {
          where: {
            userId,
          },
          select: {
            confidenceLevel: true,
          },
        },
      },
    });

    const distribution = skills.map((s) => {
      const totalQuestions = s.questions.length;
      const averageConfidence = totalQuestions > 0
        ? s.questions.reduce((sum, q) => sum + q.confidenceLevel, 0) / totalQuestions
        : 0;

      return {
        name: s.name,
        questionsCount: totalQuestions,
        averageConfidence: Math.round(averageConfidence * 10) / 10,
        proficiencyLevel: s.proficiencyLevel,
      };
    });

    return res.json(distribution);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const getActivityHeatmap = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    
    // Fetch last 30 days activity counts
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const apps = await prisma.application.findMany({
      where: {
        userId,
        createdAt: { gte: thirtyDaysAgo },
      },
      select: { createdAt: true },
    });

    const rounds = await prisma.interviewRound.findMany({
      where: {
        application: { userId },
        scheduledAt: { gte: thirtyDaysAgo },
      },
      select: { scheduledAt: true },
    });

    const journals = await prisma.journalEntry.findMany({
      where: {
        userId,
        loggedAt: { gte: thirtyDaysAgo },
      },
      select: { loggedAt: true },
    });

    const activityMap: { [dateStr: string]: number } = {};

    // Helper to format date
    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    apps.forEach((a) => {
      const dateStr = formatDate(a.createdAt);
      activityMap[dateStr] = (activityMap[dateStr] || 0) + 1;
    });

    rounds.forEach((r) => {
      if (r.scheduledAt) {
        const dateStr = formatDate(r.scheduledAt);
        activityMap[dateStr] = (activityMap[dateStr] || 0) + 1;
      }
    });

    journals.forEach((j) => {
      const dateStr = formatDate(j.loggedAt);
      activityMap[dateStr] = (activityMap[dateStr] || 0) + 1;
    });

    // Format for charts (array of { date, count })
    const result = [];
    for (let i = 30; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = formatDate(d);
      result.push({
        date: dateStr,
        count: activityMap[dateStr] || 0,
      });
    }

    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const getDashboardFeed = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    // 1. Fetch all datasets from database in parallel using Prisma
    const [
      applications,
      userSkills,
      learningPlan,
      latestInterviews,
      trendsData,
      activityApps,
      activityRounds,
      activityJournals
    ] = await Promise.all([
      // Applications
      prisma.application.findMany({
        where: { userId },
        include: {
          company: true,
          rounds: {
            orderBy: { roundNumber: 'asc' },
          },
        },
        orderBy: {
          appliedDate: 'desc',
        },
      }),
      // Skills (with questions for distribution & weaknesses)
      prisma.skill.findMany({
        where: { userId },
        include: {
          questions: {
            where: { userId },
            select: {
              confidenceLevel: true,
              needsRevision: true,
            },
          },
        },
      }),
      // Learning Plan
      prisma.learningPlan.findUnique({
        where: { userId }
      }),
      // Interview History (last 10)
      prisma.aIInterview.findMany({
        where: {
          userId,
          deletedAt: null
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      }),
      // Trends (last 30d)
      AnalyticsService.getTrends({ userId, timeframe: '30d' }).catch(() => ({ trends: [], stats: {} })),
      // Activity Heatmap sub-queries (last 30 days)
      prisma.application.findMany({
        where: {
          userId,
          createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
        select: { createdAt: true },
      }),
      prisma.interviewRound.findMany({
        where: {
          application: { userId },
          scheduledAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
        select: { scheduledAt: true },
      }),
      prisma.journalEntry.findMany({
        where: {
          userId,
          loggedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
        select: { loggedAt: true },
      }),
    ]);

    // 2. Compute Summary Stats
    const totalApplications = applications.length;
    const applicationsWithRounds = applications.filter(a => a.rounds.length > 0).length;
    const totalOffers = applications.filter(a => a.status === 'Offer').length;

    // Average question confidence from skills
    let totalQuestions = 0;
    let sumConfidence = 0;
    userSkills.forEach(s => {
      s.questions.forEach(q => {
        totalQuestions++;
        sumConfidence += q.confidenceLevel;
      });
    });
    const avgConfidence = totalQuestions > 0 ? sumConfidence / totalQuestions : 5.0;

    // Average round confidence
    let totalRounds = 0;
    let sumRoundConfidence = 0;
    applications.forEach(a => {
      a.rounds.forEach(r => {
        totalRounds++;
        sumRoundConfidence += r.confidenceScore || 5;
      });
    });
    const avgRoundConfidence = totalRounds > 0 ? sumRoundConfidence / totalRounds : 5.0;

    // Average learning item progress
    const learningItems = await prisma.learningItem.findMany({ where: { userId } });
    const avgLearningProgress = learningItems.length > 0
      ? learningItems.reduce((sum, item) => sum + item.progressPercent, 0) / learningItems.length
      : 50;

    const readinessScore = Math.min(100, Math.max(10, Math.round(
      (avgConfidence * 4) + (avgRoundConfidence * 4) + ((avgLearningProgress / 100) * 20)
    )));

    const respondedApps = applications.filter(a => a.status !== 'Applied').length;
    const responseRate = totalApplications > 0 ? Math.round((respondedApps / totalApplications) * 100) : 0;
    const interviewRate = totalApplications > 0 ? Math.round((applicationsWithRounds / totalApplications) * 100) : 0;

    const summary = {
      totalApplications,
      responseRate,
      interviewRate,
      totalOffers,
      readinessScore,
    };

    // 3. Compute Weaknesses
    const weaknesses = userSkills
      .map((skill) => {
        const qCount = skill.questions.length;
        if (qCount === 0) {
          return { skillId: skill.id, name: skill.name, averageConfidence: 10, questionCount: 0, priority: 'Low' };
        }
        const totConf = skill.questions.reduce((sum, q) => sum + q.confidenceLevel, 0);
        const avgConf = totConf / qCount;
        const needsRevCount = skill.questions.filter(q => q.needsRevision).length;

        let priority = 'Low';
        if (avgConf <= 4 || needsRevCount > 2) {
          priority = 'High';
        } else if (avgConf <= 6 || needsRevCount > 0) {
          priority = 'Medium';
        }

        return {
          skillId: skill.id,
          name: skill.name,
          averageConfidence: Math.round(avgConf * 10) / 10,
          questionCount: qCount,
          needsRevisionCount: needsRevCount,
          priority,
        };
      })
      .filter((w) => w.priority === 'High' || w.priority === 'Medium')
      .sort((a, b) => a.averageConfidence - b.averageConfidence);

    // 4. Compute Skills Distribution
    const skillsDistribution = userSkills.map((s) => {
      const qCount = s.questions.length;
      const avgConf = qCount > 0 ? s.questions.reduce((sum, q) => sum + q.confidenceLevel, 0) / qCount : 0;
      return {
        name: s.name,
        questionsCount: qCount,
        averageConfidence: Math.round(avgConf * 10) / 10,
        proficiencyLevel: s.proficiencyLevel,
      };
    });

    // 5. Compute Activity Heatmap
    const activityMap: { [dateStr: string]: number } = {};
    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    activityApps.forEach((a) => {
      const dateStr = formatDate(a.createdAt);
      activityMap[dateStr] = (activityMap[dateStr] || 0) + 1;
    });
    activityRounds.forEach((r) => {
      if (r.scheduledAt) {
        const dateStr = formatDate(r.scheduledAt);
        activityMap[dateStr] = (activityMap[dateStr] || 0) + 1;
      }
    });
    activityJournals.forEach((j) => {
      const dateStr = formatDate(j.loggedAt);
      activityMap[dateStr] = (activityMap[dateStr] || 0) + 1;
    });

    const heatmap = [];
    for (let i = 30; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = formatDate(d);
      heatmap.push({
        date: dateStr,
        count: activityMap[dateStr] || 0,
      });
    }

    // 6. Format Learning Plan (if exists)
    let parsedLearningPlan = null;
    if (learningPlan) {
      let genPlan = learningPlan.generatedPlan;
      if (typeof genPlan === 'string') {
        try {
          genPlan = JSON.parse(genPlan);
        } catch {
          // ignore
        }
      }
      parsedLearningPlan = {
        ...learningPlan,
        generatedPlan: genPlan,
        targetCompanies: typeof learningPlan.targetCompanies === 'string' ? JSON.parse(learningPlan.targetCompanies) : learningPlan.targetCompanies
      };
    }

    // Return the combined payload
    return res.json({
      summary,
      weaknesses,
      skills: skillsDistribution,
      heatmap,
      applications,
      history: { items: latestInterviews },
      trends: trendsData,
      learningPlan: parsedLearningPlan
    });
  } catch (error: any) {
    console.error('[SERVER ERROR] Failed to fetch dashboard feed:', error);
    return res.status(500).json({ error: 'Failed to load dashboard data. Please try again later.' });
  }
};
