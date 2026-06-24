import { Response } from 'express';
import prisma from '../client';
import { AuthRequest } from '../middleware/auth';

console.log('=============================================> process', process.memoryUsage())

export const listQuestions = async (req: AuthRequest, res: Response) => {
  try {
    const { difficulty, category, skill } = req.query;

    const userQuestions = await prisma.question.findMany({
      where: {
        userId: req.userId,
        ...(difficulty ? { difficulty: difficulty as string } : {}),
        ...(category ? { category: category as string } : {}),
        ...(skill ? {
          skills: {
            some: {
              name: skill as string,
              userId: req.userId,
            },
          },
        } : {}),
      },
      include: {
        skills: true,
        round: {
          include: {
            application: {
              include: {
                company: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return res.json(userQuestions);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const createQuestion = async (req: AuthRequest, res: Response) => {
  try {
    const { roundId, text, answerDraft, difficulty, category, confidenceLevel, needsRevision, skillNames } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Question text is required' });
    }

    // Verify round ownership if roundId is provided
    if (roundId) {
      const round = await prisma.interviewRound.findUnique({
        where: { id: roundId },
        include: { application: true },
      });

      if (!round || round.application.userId !== req.userId) {
        return res.status(404).json({ error: 'Interview round not found or unauthorized' });
      }
    }

    // Process skills first
    const skillsToConnect = [];
    if (skillNames && Array.isArray(skillNames)) {
      for (const name of skillNames) {
        const trimmedName = name.trim();
        if (trimmedName) {
          let skill = await prisma.skill.findUnique({
            where: {
              userId_name: {
                userId: req.userId!,
                name: trimmedName,
              },
            },
          });

          if (!skill) {
            skill = await prisma.skill.create({
              data: {
                userId: req.userId!,
                name: trimmedName,
              },
            });
          }
          skillsToConnect.push({ id: skill.id });
        }
      }
    }

    const question = await prisma.question.create({
      data: {
        userId: req.userId!,
        roundId: roundId || null,
        text,
        answerDraft: answerDraft || null,
        difficulty: difficulty || 'Medium',
        category: category || 'General',
        confidenceLevel: confidenceLevel ? parseInt(confidenceLevel) : 5,
        needsRevision: needsRevision !== undefined ? needsRevision : true,
        skills: {
          connect: skillsToConnect,
        },
      },
      include: {
        skills: true,
      },
    });

    return res.status(201).json(question);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const updateQuestion = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { text, answerDraft, difficulty, category, confidenceLevel, needsRevision, skillNames } = req.body;

    // Verify ownership of the question
    const question = await prisma.question.findUnique({
      where: { id },
    });

    if (!question || question.userId !== req.userId) {
      return res.status(404).json({ error: 'Question not found or unauthorized' });
    }

    // Process skills if updated
    let skillsUpdate: any = {};
    if (skillNames && Array.isArray(skillNames)) {
      const skillsToConnect = [];
      for (const name of skillNames) {
        const trimmedName = name.trim();
        if (trimmedName) {
          let skill = await prisma.skill.findUnique({
            where: {
              userId_name: {
                userId: req.userId!,
                name: trimmedName,
              },
            },
          });

          if (!skill) {
            skill = await prisma.skill.create({
              data: {
                userId: req.userId!,
                name: trimmedName,
              },
            });
          }
          skillsToConnect.push({ id: skill.id });
        }
      }
      skillsUpdate = {
        set: skillsToConnect,
      };
    }

    const updated = await prisma.question.update({
      where: { id },
      data: {
        text: text !== undefined ? text : question.text,
        answerDraft: answerDraft !== undefined ? answerDraft : question.answerDraft,
        difficulty: difficulty !== undefined ? difficulty : question.difficulty,
        category: category !== undefined ? category : question.category,
        confidenceLevel: confidenceLevel !== undefined ? parseInt(confidenceLevel) : question.confidenceLevel,
        needsRevision: needsRevision !== undefined ? needsRevision : question.needsRevision,
        ...(skillNames ? { skills: skillsUpdate } : {}),
      },
      include: {
        skills: true,
      },
    });

    return res.json(updated);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const deleteQuestion = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const question = await prisma.question.findUnique({
      where: { id },
    });

    if (!question || question.userId !== req.userId) {
      return res.status(404).json({ error: 'Question not found or unauthorized' });
    }

    await prisma.question.delete({
      where: { id },
    });

    return res.json({ message: 'Question deleted successfully' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};
