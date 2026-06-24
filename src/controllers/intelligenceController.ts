import { Response } from 'express';
import prisma from '../client';
import { AuthRequest } from '../middleware/auth';

export const getWeaknesses = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const userSkills = await prisma.skill.findMany({
      where: { userId },
      include: {
        questions: {
          where: {
            userId,
          },
        },
      },
    });

    const weaknesses = userSkills
      .map((skill) => {
        const questionCount = skill.questions.length;
        if (questionCount === 0) {
          return { skillId: skill.id, name: skill.name, averageConfidence: 10, questionCount: 0, priority: 'Low' };
        }

        const totalConfidence = skill.questions.reduce((sum, q) => sum + q.confidenceLevel, 0);
        const averageConfidence = totalConfidence / questionCount;

        const needsRevisionCount = skill.questions.filter((q) => q.needsRevision).length;

        let priority = 'Low';
        if (averageConfidence <= 4 || needsRevisionCount > 2) {
          priority = 'High';
        } else if (averageConfidence <= 6 || needsRevisionCount > 0) {
          priority = 'Medium';
        }

        return {
          skillId: skill.id,
          name: skill.name,
          averageConfidence: Math.round(averageConfidence * 10) / 10,
          questionCount,
          needsRevisionCount,
          priority,
        };
      })
      .filter((w) => w.priority === 'High' || w.priority === 'Medium')
      .sort((a, b) => a.averageConfidence - b.averageConfidence);

    return res.json(weaknesses);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const getRevisionList = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    let scheduled = await prisma.revisionList.findMany({
      where: {
        userId,
        status: 'Pending',
      },
      include: {
        question: {
          include: {
            skills: true,
          },
        },
      },
      orderBy: {
        scheduledFor: 'asc',
      },
    });

    if (scheduled.length < 5) {
      const existingQuestionIds = new Set(scheduled.map((s) => s.questionId));

      const lowConfidenceQuestions = await prisma.question.findMany({
        where: {
          userId,
          id: {
            notIn: Array.from(existingQuestionIds),
          },
          OR: [
            { confidenceLevel: { lte: 5 } },
            { needsRevision: true },
          ],
        },
        include: {
          skills: true,
        },
        take: 10 - scheduled.length,
        orderBy: {
          confidenceLevel: 'asc',
        },
      });

      const autoScheduled = await Promise.all(
        lowConfidenceQuestions.map(async (q) => {
          const rev = await prisma.revisionList.create({
            data: {
              userId,
              questionId: q.id,
              scheduledFor: new Date(),
              priority: q.confidenceLevel <= 4 ? 'High' : 'Medium',
              status: 'Pending',
            },
            include: {
              question: {
                include: {
                  skills: true,
                },
              },
            },
          });
          return rev;
        })
      );

      scheduled = [...scheduled, ...autoScheduled];
    }

    return res.json(scheduled);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const completeRevision = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { confidenceLevel, answerNotes } = req.body;

    const revisionItem = await prisma.revisionList.findUnique({
      where: { id },
      include: {
        question: true,
      },
    });

    if (!revisionItem || revisionItem.userId !== req.userId) {
      return res.status(404).json({ error: 'Revision item not found or unauthorized' });
    }

    const newConfidence = parseInt(confidenceLevel);

    await prisma.revisionList.update({
      where: { id },
      data: {
        status: 'Completed',
      },
    });

    await prisma.question.update({
      where: { id: revisionItem.questionId },
      data: {
        confidenceLevel: newConfidence,
        needsRevision: newConfidence < 8,
        answerDraft: answerNotes !== undefined ? answerNotes : revisionItem.question.answerDraft,
      },
    });

    const daysToAdd = newConfidence >= 8 ? 7 : 2;
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + daysToAdd);

    const nextRevision = await prisma.revisionList.create({
      data: {
        userId: req.userId!,
        questionId: revisionItem.questionId,
        scheduledFor: nextReview,
        priority: newConfidence <= 4 ? 'High' : 'Medium',
        status: 'Pending',
      },
    });

    return res.json({
      message: 'Revision session logged successfully',
      nextScheduledAt: nextRevision.scheduledFor,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const getLearningItems = async (req: AuthRequest, res: Response) => {
  try {
    const items = await prisma.learningItem.findMany({
      where: { userId: req.userId },
      orderBy: { lastStudiedAt: 'desc' },
    });
    return res.json(items);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const createLearningItem = async (req: AuthRequest, res: Response) => {
  try {
    const { skillName, status, progressPercent, hoursInvested } = req.body;

    if (!skillName) {
      return res.status(400).json({ error: 'Skill Name is required' });
    }

    const item = await prisma.learningItem.create({
      data: {
        userId: req.userId!,
        skillName,
        status: status || 'Backlog',
        progressPercent: progressPercent ? parseInt(progressPercent) : 0,
        hoursInvested: hoursInvested ? parseFloat(hoursInvested) : 0.0,
      },
    });

    return res.status(201).json(item);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const updateLearningItem = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, progressPercent, hoursInvested } = req.body;

    const existing = await prisma.learningItem.findUnique({
      where: { id },
    });

    if (!existing || existing.userId !== req.userId) {
      return res.status(404).json({ error: 'Learning item not found or unauthorized' });
    }

    const updated = await prisma.learningItem.update({
      where: { id },
      data: {
        status: status !== undefined ? status : existing.status,
        progressPercent: progressPercent !== undefined ? parseInt(progressPercent) : existing.progressPercent,
        hoursInvested: hoursInvested !== undefined ? parseFloat(hoursInvested) : existing.hoursInvested,
        lastStudiedAt: new Date(),
      },
    });

    return res.json(updated);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const deleteLearningItem = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.learningItem.findUnique({
      where: { id },
    });

    if (!existing || existing.userId !== req.userId) {
      return res.status(404).json({ error: 'Learning item not found or unauthorized' });
    }

    await prisma.learningItem.delete({
      where: { id },
    });

    return res.json({ message: 'Learning item deleted successfully' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const getJournalEntries = async (req: AuthRequest, res: Response) => {
  try {
    const entries = await prisma.journalEntry.findMany({
      where: { userId: req.userId },
      include: {
        interviewRound: {
          include: {
            application: {
              include: {
                company: true,
              },
            },
          },
        },
      },
      orderBy: { loggedAt: 'desc' },
    });
    return res.json(entries);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const createJournalEntry = async (req: AuthRequest, res: Response) => {
  try {
    const { interviewRoundId, wins, mistakes, mood, nextActions } = req.body;

    if (interviewRoundId) {
      const round = await prisma.interviewRound.findUnique({
        where: { id: interviewRoundId },
        include: { application: true },
      });

      if (!round || round.application.userId !== req.userId) {
        return res.status(404).json({ error: 'Interview round not found or unauthorized' });
      }
    }

    const entry = await prisma.journalEntry.create({
      data: {
        userId: req.userId!,
        interviewRoundId: interviewRoundId || null,
        wins: wins || null,
        mistakes: mistakes || null,
        mood: mood || null,
        nextActions: nextActions || null,
      },
    });

    return res.status(201).json(entry);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const listSkills = async (req: AuthRequest, res: Response) => {
  try {
    const skills = await prisma.skill.findMany({
      where: { userId: req.userId },
      orderBy: { name: 'asc' },
    });
    return res.json(skills);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};
