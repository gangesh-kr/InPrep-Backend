import prisma from '../client';
import ApiError from '../utils/ApiError';
import logger from '../utils/logger';
import { callGemini, isGeminiEnabled } from '../utils/gemini';

function generatePublicToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 12; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

export class ScorecardService {
  static async generateScorecard(userId: string, sessionId: string) {
    const session = await prisma.aIInterview.findUnique({
      where: { id: sessionId }
    });

    if (!session || session.userId !== userId) {
      throw new ApiError(404, 'SESSION_NOT_FOUND', 'Interview session not found or unauthorized.');
    }

    if (session.overallScore === null) {
      throw new ApiError(400, 'SESSION_INCOMPLETE', 'Only completed interviews can generate scorecards.');
    }

    // Call Gemini to generate executive summary and recruiter evaluation
    let scorecardData;
    if (isGeminiEnabled()) {
      const transcriptList = JSON.parse(session.transcript);
      const prompt = `You are a professional recruiting coordinator.
Analyze the mock interview performance below:
Position: "${session.position}"
Company: "${session.companyName || 'unspecified company'}"
Overall Score: ${session.overallScore}%
Verdict: ${session.verdict}
Feedback Summary: "${session.feedbackSummary}"
Strengths: ${session.strengths}
Weaknesses: ${session.weaknesses}

Here is the conversation transcript:
${JSON.stringify(transcriptList.slice(0, 10), null, 2)}

Please generate an executive assessment of this candidate.
Output a JSON object, and ONLY a JSON object. No markdown, no backticks, no prefix explanations.

JSON Schema:
{
  "executiveSummary": "<one-paragraph executive summary of the candidate's performance>",
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>", "<strength 4>"],
  "improvements": ["<improvement 1>", "<improvement 2>", "<improvement 3>"],
  "readinessLevel": "not ready" | "developing" | "interview ready" | "strongly recommended",
  "hiringRecommendation": "<one-sentence hiring recommendation summary>"
}`;

      try {
        const resultText = await callGemini(prompt, true);
        const cleanJson = resultText
          .replace(/^```json\s*/i, '')
          .replace(/```\s*$/, '')
          .trim();
        scorecardData = JSON.parse(cleanJson);
      } catch (err: any) {
        logger.error({ error: err.message }, 'Gemini scorecard generation failed, falling back to simulated scorecard');
        scorecardData = this.generateSimulatedScorecardData(session);
      }
    } else {
      scorecardData = this.generateSimulatedScorecardData(session);
    }

    // Create or update the scorecard record
    const publicToken = generatePublicToken();

    // Check if scorecard already exists for this session
    const existing = await prisma.scorecard.findUnique({
      where: { sessionId }
    });

    let scorecard;
    if (existing) {
      scorecard = await prisma.scorecard.update({
        where: { sessionId },
        data: {
          executiveSummary: scorecardData.executiveSummary,
          strengths: JSON.stringify(scorecardData.strengths),
          improvements: JSON.stringify(scorecardData.improvements),
          readinessLevel: scorecardData.readinessLevel,
          hiringRecommendation: scorecardData.hiringRecommendation,
          generatedAt: new Date()
        }
      });
    } else {
      scorecard = await prisma.scorecard.create({
        data: {
          sessionId,
          userId,
          publicToken,
          executiveSummary: scorecardData.executiveSummary,
          strengths: JSON.stringify(scorecardData.strengths),
          improvements: JSON.stringify(scorecardData.improvements),
          readinessLevel: scorecardData.readinessLevel,
          hiringRecommendation: scorecardData.hiringRecommendation,
          isPublic: false
        }
      });
    }

    logger.info({ event: 'scorecard_generated', userId, sessionId, scorecardId: scorecard.id }, 'Generated scorecard successfully');

    return {
      ...scorecard,
      strengths: JSON.parse(scorecard.strengths as string),
      improvements: JSON.parse(scorecard.improvements as string)
    };
  }

  static generateSimulatedScorecardData(session: any) {
    const score = session.overallScore || 70;
    let readinessLevel = 'developing';
    let hiringRecommendation = 'Hold off for further skill improvement.';

    if (score >= 85) {
      readinessLevel = 'strongly recommended';
      hiringRecommendation = 'Strongly recommended for hire. Candidate exhibits exceptional technical proficiency and logic.';
    } else if (score >= 70) {
      readinessLevel = 'interview ready';
      hiringRecommendation = 'Hiring recommended. Candidate exhibits solid domain knowledge with mild areas for polish.';
    } else if (score >= 50) {
      readinessLevel = 'developing';
      hiringRecommendation = 'Do not hire. Candidate requires substantial preparation on foundational concepts.';
    } else {
      readinessLevel = 'not ready';
      hiringRecommendation = 'Not recommended. Critical gaps identified in multiple engineering domains.';
    }

    return {
      executiveSummary: `The candidate completed a simulated session for the ${session.position} role. They achieved an overall score of ${score}%. Their responses indicated logical reasoning, though they struggled with structural explanations in some technical segments.`,
      strengths: [
        'Demonstrates structured logic and reasoning when describing past challenges.',
        'Good communication clarity and pacing during complex technical deep dives.',
        'Verified core claims successfully under cross-examination.'
      ],
      improvements: [
        'Need to elaborate on scaling constraints and caching patterns (Redis/Memcached).',
        'Should detail specific unit and integration testing pipelines to verify reliability.'
      ],
      readinessLevel,
      hiringRecommendation
    };
  }

  static async shareScorecard(userId: string, scorecardId: string, expiresAt?: string) {
    const scorecard = await prisma.scorecard.findUnique({
      where: { id: scorecardId }
    });

    if (!scorecard || scorecard.userId !== userId) {
      throw new ApiError(404, 'SCORECARD_NOT_FOUND', 'Scorecard not found or unauthorized.');
    }

    // Set expiry: default to 30 days from now if not provided, or custom
    const exp = expiresAt ? new Date(expiresAt) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const updated = await prisma.scorecard.update({
      where: { id: scorecardId },
      data: {
        isPublic: true,
        expiresAt: exp
      }
    });

    const baseUrl = process.env.SCORECARD_BASE_URL || 'http://localhost:5173';
    const shareUrl = `${baseUrl}/scorecard/${scorecard.publicToken}`;

    logger.info({ event: 'scorecard_shared', userId, scorecardId }, 'Shared scorecard successfully');

    return {
      shareUrl,
      isPublic: updated.isPublic,
      expiresAt: updated.expiresAt
    };
  }

  static async revokeScorecard(userId: string, scorecardId: string) {
    const scorecard = await prisma.scorecard.findUnique({
      where: { id: scorecardId }
    });

    if (!scorecard || scorecard.userId !== userId) {
      throw new ApiError(404, 'SCORECARD_NOT_FOUND', 'Scorecard not found or unauthorized.');
    }

    await prisma.scorecard.update({
      where: { id: scorecardId },
      data: {
        isPublic: false,
        expiresAt: null
      }
    });

    logger.info({ event: 'scorecard_revoked', userId, scorecardId }, 'Revoked public access to scorecard');
    return { message: 'Public share access revoked.' };
  }

  static async deleteScorecard(userId: string, scorecardId: string) {
    const scorecard = await prisma.scorecard.findUnique({
      where: { id: scorecardId }
    });

    if (!scorecard || scorecard.userId !== userId) {
      throw new ApiError(404, 'SCORECARD_NOT_FOUND', 'Scorecard not found or unauthorized.');
    }

    await prisma.scorecard.delete({
      where: { id: scorecardId }
    });

    logger.info({ event: 'scorecard_deleted', userId, scorecardId }, 'Deleted scorecard successfully');
    return { message: 'Scorecard successfully deleted.' };
  }

  static async getPublicScorecard(publicToken: string) {
    const scorecard = await prisma.scorecard.findUnique({
      where: { publicToken },
      include: {
        session: {
          select: {
            id: true,
            position: true,
            companyName: true,
            personality: true,
            overallScore: true,
            verdict: true,
            createdAt: true,
            interviewType: true
          }
        },
        user: {
          select: {
            fullName: true
          }
        }
      }
    });

    if (!scorecard) {
      throw new ApiError(404, 'SCORECARD_NOT_FOUND', 'Scorecard not found.');
    }

    if (!scorecard.isPublic) {
      throw new ApiError(404, 'ACCESS_DENIED', 'This scorecard is private.');
    }

    if (scorecard.expiresAt && new Date() > new Date(scorecard.expiresAt)) {
      throw new ApiError(404, 'SCORECARD_EXPIRED', 'This scorecard link has expired.');
    }

    return {
      id: scorecard.id,
      publicToken: scorecard.publicToken,
      candidateName: scorecard.user.fullName,
      position: scorecard.session.position,
      companyName: scorecard.session.companyName,
      interviewType: scorecard.session.interviewType,
      overallScore: scorecard.session.overallScore,
      verdict: scorecard.session.verdict,
      createdAt: scorecard.session.createdAt,
      readinessLevel: scorecard.readinessLevel,
      hiringRecommendation: scorecard.hiringRecommendation,
      executiveSummary: scorecard.executiveSummary,
      strengths: JSON.parse(scorecard.strengths as string),
      improvements: JSON.parse(scorecard.improvements as string),
      expiresAt: scorecard.expiresAt
    };
  }
}

export default ScorecardService;
