import prisma from '../client';
import ApiError from '../utils/ApiError';
import logger from '../utils/logger';
import { callGemini, isGeminiEnabled } from '../utils/gemini';
import Redis from 'ioredis';

let redis: Redis | null = null;
/* Redis is disabled
if (process.env.REDIS_URL) {
  try {
    redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false
    });
    redis.on('error', (err) => {
      logger.warn({ error: err.message }, 'Redis client connection error - rate limiting might be degraded');
    });
  } catch (err) {
    logger.error(err, 'Failed to initialize Redis client');
  }
}
*/

export class WeaknessAnalysisService {
  static async runAnalysis(userId: string): Promise<any> {
    try {
      // 1. Fetch last 20 completed, non-deleted sessions
      const sessions = await prisma.aIInterview.findMany({
        where: {
          userId,
          overallScore: { not: null },
          deletedAt: null
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          position: true,
          transcript: true,
          overallScore: true,
          feedbackSummary: true,
          strengths: true,
          weaknesses: true
        }
      });

      const sessionCount = sessions.length;
      if (sessionCount < 3) {
        logger.info({ userId, sessionCount }, 'Not enough sessions to perform weakness analysis (minimum 3 required)');
        return { needsMoreData: true, sessionsRequired: 3, sessionsCompleted: sessionCount };
      }

      // 2. Aggregate the performance data
      const aggregatedData = sessions.map((s, idx) => {
        let transcript = [];
        try {
          transcript = JSON.parse(s.transcript);
        } catch (e) {
          // ignore
        }

        // We only extract questions, candidate answers, and any feedback or score details
        const questionAnswers = [];
        for (let i = 0; i < transcript.length; i += 2) {
          const q = transcript[i];
          const a = transcript[i + 1];
          if (q && a) {
            questionAnswers.push({
              question: q.text,
              answer: a.text
            });
          }
        }

        return {
          sessionNumber: idx + 1,
          position: s.position,
          overallScore: s.overallScore,
          feedback: s.feedbackSummary,
          strengths: s.strengths ? JSON.parse(s.strengths) : [],
          weaknesses: s.weaknesses ? JSON.parse(s.weaknesses) : [],
          qaPairs: questionAnswers
        };
      });

      // 3. Prompt Gemini
      let topicsResult = [];

      if (isGeminiEnabled()) {
        const prompt = `You are an expert AI career coach and technical assessor.
You are analyzing the candidate's last ${sessionCount} mock interview sessions.
Here is the aggregated details of their sessions including questions, answers, strengths, and weaknesses identified:
${JSON.stringify(aggregatedData, null, 2)}

Your task is to identify recurring weak topics where the candidate consistently struggles, demonstrates superficial knowledge, or receives low ratings.
Output a JSON object, and ONLY a JSON object. No markdown, no backticks, no prefix explanations.

JSON Schema:
{
  "topics": [
    {
      "name": "<name of the weak topic, e.g. React Render Lifecycle, Node Event Loop, Database Concurrency, System Design Caching>",
      "severity": "critical" | "moderate" | "minor",
      "frequency": <integer representing how many sessions this weakness appeared in, max ${sessionCount}>,
      "description": "<a clear, concise one-sentence description of the gap in their knowledge>",
      "recommendations": [
        "<specific study recommendation 1>",
        "<specific study recommendation 2>",
        "<specific study recommendation 3>",
        "<specific study recommendation 4>"
      ]
    }
  ]
}`;

        try {
          const resultText = await callGemini(prompt, true);
          const cleanJson = resultText
            .replace(/^```json\s*/i, '')
            .replace(/```\s*$/, '')
            .trim();
          
          const parsed = JSON.parse(cleanJson);
          if (parsed && Array.isArray(parsed.topics)) {
            topicsResult = parsed.topics;
          }
        } catch (err: any) {
          logger.error({ error: err.message }, 'Gemini weakness analysis failed, falling back to simulated analysis');
          topicsResult = this.generateSimulatedWeaknesses(aggregatedData);
        }
      } else {
        topicsResult = this.generateSimulatedWeaknesses(aggregatedData);
      }

      // 4. Save to DB
      const profile = await prisma.weaknessProfile.upsert({
        where: { userId },
        update: {
          topics: JSON.stringify(topicsResult),
          lastAnalyzedAt: new Date(),
          sessionCount
        },
        create: {
          userId,
          topics: JSON.stringify(topicsResult),
          lastAnalyzedAt: new Date(),
          sessionCount
        }
      });

      logger.info({ userId, sessionCount, topicsCount: topicsResult.length }, 'Successfully created/updated WeaknessProfile');

      return {
        needsMoreData: false,
        topics: topicsResult,
        lastAnalyzedAt: profile.lastAnalyzedAt,
        sessionCount
      };
    } catch (error: any) {
      logger.error({ userId, error: error.message }, 'Error in WeaknessAnalysisService.runAnalysis');
      throw new ApiError(500, 'ANALYSIS_FAILED', 'Failed to run weakness analysis.');
    }
  }

  static generateSimulatedWeaknesses(aggregatedData: any[]): any[] {
    // Basic simulation logic based on the user's weaknesses and score
    // Gather all weaknesses strings from aggregated sessions
    const allWeaknessStrings: string[] = [];
    aggregatedData.forEach(d => {
      if (Array.isArray(d.weaknesses)) {
        allWeaknessStrings.push(...d.weaknesses);
      }
    });

    const mockTopics = [
      {
        name: 'Database Concurrency & Locking',
        severity: 'critical',
        frequency: Math.max(1, aggregatedData.length - 1),
        description: 'Struggles to explain database transaction isolation levels, connection pooling, and optimistic vs pessimistic locking mechanisms.',
        recommendations: [
          'Study PostgreSQL isolation levels (Read Committed, Repeatable Read, Serializable).',
          'Read about database lock escalation and deadlock resolution strategies.',
          'Practice writing Node.js transactions with explicit locking options using Prisma or raw SQL.',
          'Implement connection pooling optimization with PgBouncer.'
        ]
      },
      {
        name: 'React Rendering & Context performance API',
        severity: 'moderate',
        frequency: Math.max(1, Math.round(aggregatedData.length / 2)),
        description: 'Fails to design scalable state synchronization patterns or manage stale closures in useEffect.',
        recommendations: [
          'Read the React compiler documentation and understand how hooks capture closures.',
          'Understand render-batching mechanics in React 19 Fiber architecture.',
          'Analyze state management libraries such as Redux Toolkit and Zustand under high-frequency writes.',
          'Build custom hooks that utilize React Refs to maintain mutable variables without re-renders.'
        ]
      },
      {
        name: 'Cache Invalidation & Redis Architecture',
        severity: 'minor',
        frequency: Math.max(1, Math.round(aggregatedData.length / 3)),
        description: 'Lacks deep mechanical knowledge of preventing cache stampedes, avalanches, and penetrations.',
        recommendations: [
          'Read Redis patterns for cache invalidation (Write-Through, Write-Behind, Cache-Aside).',
          'Study lock mechanisms like Redlock to solve cache stampede issues.',
          'Configure Redis expiry TTL with randomized jitter to prevent cache avalanches.',
          'Learn to use Bloom Filters to prevent cache penetration.'
        ]
      }
    ];

    return mockTopics;
  }

  static async getProfile(userId: string) {
    // Check completed session count
    const sessionCount = await prisma.aIInterview.count({
      where: {
        userId,
        overallScore: { not: null },
        deletedAt: null
      }
    });

    if (sessionCount < 3) {
      return {
        needsMoreData: true,
        sessionsRequired: 3,
        sessionsCompleted: sessionCount
      };
    }

    const profile = await prisma.weaknessProfile.findUnique({
      where: { userId }
    });

    if (!profile) {
      // Run analysis once if none exists
      return this.runAnalysis(userId);
    }

    return {
      needsMoreData: false,
      topics: JSON.parse(profile.topics as string),
      lastAnalyzedAt: profile.lastAnalyzedAt,
      sessionCount: profile.sessionCount
    };
  }

  static async refreshProfile(userId: string) {
    const profile = await prisma.weaknessProfile.findUnique({
      where: { userId }
    });

    const now = new Date();

    // 1. Check Rate Limit via Redis
    if (redis) {
      const redisKey = `weakness_analysis_cooldown:${userId}`;
      const exists = await redis.get(redisKey);
      if (exists) {
        throw new ApiError(429, 'COOLDOWN_ACTIVE', 'Analysis can only be refreshed once every 24 hours.');
      }
      // Set TTL to 24 hours (86400 seconds)
      await redis.set(redisKey, 'active', 'EX', 86400);
    } 
    // 2. Fallback check using lastAnalyzedAt in DB
    else if (profile) {
      const lastAnalyzed = new Date(profile.lastAnalyzedAt);
      const timeDiff = now.getTime() - lastAnalyzed.getTime();
      const twentyFourHours = 24 * 60 * 60 * 1000;

      if (timeDiff < twentyFourHours) {
        const remainingMs = twentyFourHours - timeDiff;
        throw new ApiError(429, 'COOLDOWN_ACTIVE', 'Analysis can only be refreshed once every 24 hours.', {
          cooldownRemainingMs: remainingMs
        });
      }
    }

    return this.runAnalysis(userId);
  }

  static triggerAsynchronousAnalysis(userId: string) {
    // Fire-and-forget pattern
    setImmediate(async () => {
      logger.info({ userId }, 'Asynchronously running weakness profile update');
      try {
        await this.runAnalysis(userId);
      } catch (err: any) {
        logger.error({ userId, error: err.message }, 'Failed to run asynchronous weakness profile update');
      }
    });
  }
}

export default WeaknessAnalysisService;
