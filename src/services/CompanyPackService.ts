import prisma from '../client';
import ApiError from '../utils/ApiError';
import logger from '../utils/logger';

export const curatingPacksData = [
  {
    companyName: 'Google',
    companyLogoUrl: 'https://www.google.com/favicon.ico',
    description: 'Prepare for Google\'s rigorous coding and behavioral loops. Focus on advanced algorithms, data structures, and Googlyness.',
    difficulty: 'hard',
    interviewType: 'technical',
    tier: 'premium',
    questionFocusAreas: JSON.stringify(['Algorithms & Data Structures', 'System Design', 'Googlyness & Leadership']),
    culturalContext: 'Google values strong problem-solving capabilities, clear communication of trade-offs, and "Googlyness"—which means doing the right thing, striving for excellence, and collaborative leadership.',
    estimatedDurationMinutes: 60
  },
  {
    companyName: 'Amazon',
    companyLogoUrl: 'https://www.amazon.com/favicon.ico',
    description: 'Master Amazon\'s 16 Leadership Principles and system architecture designs. Be prepared to dive deep and show ownership.',
    difficulty: 'hard',
    interviewType: 'behavioral',
    tier: 'premium',
    questionFocusAreas: JSON.stringify(['16 Leadership Principles', 'Scalable Architecture', 'Customer Obsession']),
    culturalContext: 'Amazon is famous for its Leadership Principles (LPs). Every question—even technical ones—is evaluated through the lens of LPs like Customer Obsession, Ownership, and Bias for Action.',
    estimatedDurationMinutes: 60
  },
  {
    companyName: 'Meta',
    companyLogoUrl: 'https://www.meta.com/favicon.ico',
    description: 'Crack Meta\'s high-speed coding sessions and large-scale system design. Focus on performance and architectural optimization.',
    difficulty: 'hard',
    interviewType: 'system design',
    tier: 'premium',
    questionFocusAreas: JSON.stringify(['Product Design', 'System Architecture', 'Coding Speed & Optimizations']),
    culturalContext: 'Meta focus on speed and impact. You are expected to write production-ready code quickly and design highly optimized systems for billions of active users.',
    estimatedDurationMinutes: 60
  },
  {
    companyName: 'Microsoft',
    companyLogoUrl: 'https://www.microsoft.com/favicon.ico',
    description: 'Get ready for Microsoft\'s technical and cultural interviews. Emphasizes clean code design, cooperation, and a growth mindset.',
    difficulty: 'medium',
    interviewType: 'technical',
    tier: 'free',
    questionFocusAreas: JSON.stringify(['Design Patterns', 'System Design', 'Growth Mindset']),
    culturalContext: 'Microsoft values collaboration and a growth mindset. They seek engineers who are eager to learn, adapt, and build clean, maintainable enterprise software.',
    estimatedDurationMinutes: 45
  },
  {
    companyName: 'Consulting Firm',
    companyLogoUrl: 'https://www.mckinsey.com/favicon.ico',
    description: 'Tackle McKinsey, BCG, or Deloitte style casing interviews. Focus on structural problem solving, market sizing, and communication.',
    difficulty: 'medium',
    interviewType: 'behavioral',
    tier: 'free',
    questionFocusAreas: JSON.stringify(['Case Studies', 'Estimation & Estimation Frameworks', 'Structured Communication']),
    culturalContext: 'Management consulting interviews check your analytical structure, business acumen, and presentation logic under pressure. Use clean frameworks.',
    estimatedDurationMinutes: 45
  },
  {
    companyName: 'Indian Startup',
    companyLogoUrl: 'https://zepto.co/favicon.ico',
    description: 'Prepare for fast-growing Indian startups like Zepto or Meesho. Focus on raw execution speed, high-scale engineering, and hustle.',
    difficulty: 'medium',
    interviewType: 'technical',
    tier: 'free',
    questionFocusAreas: JSON.stringify(['Concurrency in Node.js', 'PostgreSQL Optimization', 'System Scaling & Hustle']),
    culturalContext: 'High-growth startups look for raw execution, practical system building, database optimization, and a high bias for action ("hustle").',
    estimatedDurationMinutes: 45
  }
];

export class CompanyPackService {
  static async seedPacks() {
    logger.info('Seeding company packs...');
    for (const pack of curatingPacksData) {
      await prisma.companyPack.upsert({
        where: { companyName: pack.companyName },
        update: pack,
        create: pack
      });
    }
    logger.info('Seeding company packs completed.');
  }

  static async getPacks(userId: string) {
    const packs = await prisma.companyPack.findMany({
      orderBy: { companyName: 'asc' }
    });

    const userAccesses = await prisma.userPackAccess.findMany({
      where: { userId }
    });

    const accessedPackIds = new Set(userAccesses.map(a => a.packId));

    // Return packs with hasAccess appended
    return packs.map(pack => {
      const isFree = pack.tier === 'free';
      const hasAccess = isFree || accessedPackIds.has(pack.id);

      return {
        ...pack,
        questionFocusAreas: JSON.parse(pack.questionFocusAreas as string),
        hasAccess
      };
    });
  }

  static async getPackDetail(userId: string, packId: string) {
    const pack = await prisma.companyPack.findUnique({
      where: { id: packId }
    });

    if (!pack) {
      throw new ApiError(404, 'PACK_NOT_FOUND', 'Company pack not found.');
    }

    const access = await prisma.userPackAccess.findFirst({
      where: { userId, packId }
    });

    const hasAccess = pack.tier === 'free' || !!access;

    return {
      ...pack,
      questionFocusAreas: JSON.parse(pack.questionFocusAreas as string),
      hasAccess
    };
  }

  static async startPackSession(userId: string, packId: string) {
    const pack = await prisma.companyPack.findUnique({
      where: { id: packId }
    });

    if (!pack) {
      throw new ApiError(404, 'PACK_NOT_FOUND', 'Company pack not found.');
    }

    // Check access
    if (pack.tier === 'premium') {
      const access = await prisma.userPackAccess.findFirst({
        where: { userId, packId }
      });
      if (!access) {
        throw new ApiError(403, 'ACCESS_DENIED', 'You do not have access to this premium pack. Please purchase it to unlock.');
      }
    }

    // Check user and credits
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new ApiError(404, 'USER_NOT_FOUND', 'User not found.');
    }

    if (user.credits <= 0) {
      throw new ApiError(402, 'OUT_OF_CREDITS', 'You have run out of mock interview credits. Please purchase more credits to start a new session.');
    }

    // Deduct credit
    await prisma.user.update({
      where: { id: userId },
      data: { credits: { decrement: 1 } }
    });

    // Create session linked to pack
    // Create the session and construct the company-specific system prompt context
    const firstQuestion = `Welcome to your mock interview for the ${pack.companyName} pack. We will focus on: ${JSON.parse(pack.questionFocusAreas as string).join(', ')}. Let's begin. Can you tell me about your background and how it matches our engineering philosophy?`;

    const initialTranscript = [
      {
        role: 'interviewer',
        text: firstQuestion,
        timestamp: new Date().toISOString()
      }
    ];

    const interview = await prisma.aIInterview.create({
      data: {
        userId,
        position: `${pack.companyName} Role`,
        companyName: pack.companyName,
        jobDescription: `Tailored interview pack focusing on: ${pack.questionFocusAreas}`,
        personality: `Expert ${pack.companyName} Interviewer`,
        transcript: JSON.stringify(initialTranscript),
        packId: pack.id,
        interviewType: pack.interviewType
      }
    });

    return {
      interviewId: interview.id,
      firstQuestion,
      isSimulated: true // Simulating opener for speed, next questions call Gemini with pack context
    };
  }

  static async purchasePack(userId: string, packId: string) {
    const pack = await prisma.companyPack.findUnique({
      where: { id: packId }
    });

    if (!pack) {
      throw new ApiError(404, 'PACK_NOT_FOUND', 'Company pack not found.');
    }

    // TODO: Insert Stripe payment verification and gateway logic here.
    // Ensure payment confirmation response is validated before creating database records.
    
    // Auto-approve purchase for now
    const access = await prisma.userPackAccess.upsert({
      where: {
        userId_packId: { userId, packId }
      },
      update: {
        accessType: 'purchased'
      },
      create: {
        userId,
        packId,
        accessType: 'purchased'
      }
    });

    logger.info({ event: 'pack_purchased', userId, packId }, 'Granted purchased access to company pack');

    return {
      message: 'Access granted successfully',
      access
    };
  }
}

export default CompanyPackService;
