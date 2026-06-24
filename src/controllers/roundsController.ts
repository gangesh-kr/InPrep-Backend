import { Response } from 'express';
import prisma from '../client';
import { AuthRequest } from '../middleware/auth';

export const createRound = async (req: AuthRequest, res: Response) => {
  try {
    const { applicationId, roundNumber, roundType, interviewerNames, scheduledAt, durationMinutes, status, confidenceScore, feedbackNotes } = req.body;

    if (!applicationId || !roundNumber || !roundType) {
      return res.status(400).json({ error: 'Application ID, Round Number, and Round Type are required' });
    }

    // Verify application ownership
    const application = await prisma.application.findFirst({
      where: {
        id: applicationId,
        userId: req.userId,
      },
    });

    if (!application) {
      return res.status(404).json({ error: 'Application not found or unauthorized' });
    }

    const round = await prisma.interviewRound.create({
      data: {
        applicationId,
        roundNumber: parseInt(roundNumber),
        roundType,
        interviewerNames: interviewerNames || null,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        durationMinutes: durationMinutes ? parseInt(durationMinutes) : null,
        status: status || 'Scheduled',
        confidenceScore: confidenceScore ? parseInt(confidenceScore) : null,
        feedbackNotes: feedbackNotes || null,
      },
    });

    return res.status(201).json(round);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const updateRound = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { roundNumber, roundType, interviewerNames, scheduledAt, durationMinutes, status, confidenceScore, feedbackNotes } = req.body;

    // Verify round ownership through application
    const existingRound = await prisma.interviewRound.findUnique({
      where: { id },
      include: {
        application: true,
      },
    });

    if (!existingRound || existingRound.application.userId !== req.userId) {
      return res.status(404).json({ error: 'Interview round not found or unauthorized' });
    }

    const updated = await prisma.interviewRound.update({
      where: { id },
      data: {
        roundNumber: roundNumber !== undefined ? parseInt(roundNumber) : existingRound.roundNumber,
        roundType: roundType !== undefined ? roundType : existingRound.roundType,
        interviewerNames: interviewerNames !== undefined ? interviewerNames : existingRound.interviewerNames,
        scheduledAt: scheduledAt !== undefined ? (scheduledAt ? new Date(scheduledAt) : null) : existingRound.scheduledAt,
        durationMinutes: durationMinutes !== undefined ? (durationMinutes ? parseInt(durationMinutes) : null) : existingRound.durationMinutes,
        status: status !== undefined ? status : existingRound.status,
        confidenceScore: confidenceScore !== undefined ? (confidenceScore ? parseInt(confidenceScore) : null) : existingRound.confidenceScore,
        feedbackNotes: feedbackNotes !== undefined ? feedbackNotes : existingRound.feedbackNotes,
      },
    });

    return res.json(updated);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const deleteRound = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existingRound = await prisma.interviewRound.findUnique({
      where: { id },
      include: {
        application: true,
      },
    });

    if (!existingRound || existingRound.application.userId !== req.userId) {
      return res.status(404).json({ error: 'Interview round not found or unauthorized' });
    }

    await prisma.interviewRound.delete({
      where: { id },
    });

    return res.json({ message: 'Interview round deleted successfully' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};
