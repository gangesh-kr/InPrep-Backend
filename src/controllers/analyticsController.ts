import { Response } from 'express';
import prisma from '../client';
import { AuthRequest } from '../middleware/auth';

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
