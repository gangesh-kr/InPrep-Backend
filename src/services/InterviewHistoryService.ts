import prisma from '../client';
import ApiError from '../utils/ApiError';
import logger from '../utils/logger';

export class InterviewHistoryService {
  static async getHistory({
    userId,
    page,
    pageSize,
    interviewType,
    startDate,
    endDate,
    minScore,
    maxScore,
    search
  }: {
    userId: string;
    page: number;
    pageSize: number;
    interviewType?: string;
    startDate?: string;
    endDate?: string;
    minScore?: number;
    maxScore?: number;
    search?: string;
  }) {
    const skip = (page - 1) * pageSize;

    // Build the query conditions
    const where: any = {
      userId,
      deletedAt: null, // Only fetch records that are not soft-deleted
    };

    if (interviewType) {
      where.interviewType = interviewType;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    if (minScore !== undefined || maxScore !== undefined) {
      where.overallScore = {};
      if (minScore !== undefined) {
        where.overallScore.gte = minScore;
      }
      if (maxScore !== undefined) {
        where.overallScore.lte = maxScore;
      }
    }

    if (search) {
      where.OR = [
        { position: { contains: search, mode: 'insensitive' } },
        { companyName: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [totalItems, items] = await Promise.all([
      prisma.aIInterview.count({ where }),
      prisma.aIInterview.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        select: {
          id: true,
          position: true,
          companyName: true,
          personality: true,
          overallScore: true,
          verdict: true,
          createdAt: true,
          interviewType: true,
          voiceEnabled: true,
          transcript: true // Used for calculating duration on frontend or backend
        }
      })
    ]);

    const totalPages = Math.ceil(totalItems / pageSize);

    // Format items to include duration in minutes calculated from transcript timestamps
    const formattedItems = items.map(item => {
      let durationMinutes = 0;
      try {
        const transcript = JSON.parse(item.transcript);
        if (transcript.length >= 2) {
          const start = new Date(transcript[0].timestamp).getTime();
          const end = new Date(transcript[transcript.length - 1].timestamp).getTime();
          durationMinutes = Math.max(1, Math.round((end - start) / 60000));
        }
      } catch (err) {
        // Fallback to 0 if parsing fails
      }

      return {
        id: item.id,
        position: item.position,
        companyName: item.companyName,
        personality: item.personality,
        overallScore: item.overallScore,
        verdict: item.verdict,
        createdAt: item.createdAt,
        interviewType: item.interviewType,
        voiceEnabled: item.voiceEnabled,
        durationMinutes
      };
    });

    return {
      items: formattedItems,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages
      }
    };
  }

  static async getHistoryDetails(userId: string, sessionId: string) {
    const interview = await prisma.aIInterview.findUnique({
      where: { id: sessionId }
    });

    if (!interview || interview.userId !== userId || interview.deletedAt !== null) {
      throw new ApiError(404, 'SESSION_NOT_FOUND', 'Interview session not found or has been deleted.');
    }

    const transcriptList = JSON.parse(interview.transcript);
    
    // Extracting questions, answers, and feedback details
    // We construct details dynamically from the transcript evaluation
    const questionsAnalysis: any[] = [];
    
    // Evaluate if not already finished. If finished, we parse strengths/weaknesses and details
    let durationMinutes = 0;
    if (transcriptList.length >= 2) {
      const start = new Date(transcriptList[0].timestamp).getTime();
      const end = new Date(transcriptList[transcriptList.length - 1].timestamp).getTime();
      durationMinutes = Math.max(1, Math.round((end - start) / 60000));
    }

    // Return the response matching our schema details
    return {
      id: interview.id,
      position: interview.position,
      companyName: interview.companyName,
      jobDescription: interview.jobDescription,
      personality: interview.personality,
      overallScore: interview.overallScore,
      verdict: interview.verdict,
      feedbackSummary: interview.feedbackSummary,
      strengths: interview.strengths ? JSON.parse(interview.strengths) : [],
      weaknesses: interview.weaknesses ? JSON.parse(interview.weaknesses) : [],
      transcript: transcriptList,
      interviewType: interview.interviewType,
      voiceEnabled: interview.voiceEnabled,
      createdAt: interview.createdAt,
      durationMinutes
    };
  }

  static async softDeleteHistory(userId: string, sessionId: string) {
    const interview = await prisma.aIInterview.findUnique({
      where: { id: sessionId }
    });

    if (!interview || interview.userId !== userId) {
      throw new ApiError(404, 'SESSION_NOT_FOUND', 'Interview session not found or unauthorized.');
    }

    await prisma.aIInterview.update({
      where: { id: sessionId },
      data: { deletedAt: new Date() }
    });

    logger.info({ event: 'soft_delete_interview', userId, sessionId }, 'Soft deleted interview session');
    return { message: 'Interview session successfully deleted.' };
  }
}

export default InterviewHistoryService;
