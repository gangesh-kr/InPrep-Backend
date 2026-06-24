import prisma from '../client';
// @ts-ignore
import pdfParse from 'pdf-parse';
import { callGemini, isGeminiEnabled } from '../utils/gemini';
import ApiError from '../utils/ApiError';
import logger from '../utils/logger';
import WeaknessAnalysisService from './WeaknessAnalysisService';


// Simulation functions
export function getSimulatedQuestion(position: string, jd: string, resumeText: string | null, roundIndex: number): string {
  const jdLower = jd.toLowerCase();
  const resumeLower = resumeText ? resumeText.toLowerCase() : '';
  
  const isFrontend = jdLower.includes('react') || jdLower.includes('frontend') || jdLower.includes('javascript') || jdLower.includes('typescript') || resumeLower.includes('react');
  
  if (roundIndex === 0) {
    if (resumeText) {
      const targetTech = isFrontend ? 'React and TypeScript' : 'Node.js and Express';
      return `Hello! Welcome to your interview. In your resume, you highlighted strong experience with ${targetTech}. To kick off our technical deep dive, can you explain the core execution model of this technology? For example, ${isFrontend ? "explain how React's Virtual DOM reconciliation works under React Fiber, and how it differs from direct DOM manipulation." : "explain how Node's single-threaded Event Loop manages asynchronous execution queues, and the difference between microtasks and macrotasks."}`;
    }
    return `Hello! Welcome to your interview for the ${position} role. To start off, could you please introduce yourself, tell me about your background, and outline how your experience aligns with this position?`;
  }
  
  if (roundIndex === 1) {
    if (isFrontend) {
      return `Let's drill down into React rendering. When a state update is triggered in a hook (e.g. setState), how does React schedule and batch this update internally? Furthermore, how do you prevent unnecessary render cycles, and what are the exact performance limits of using Context API vs. an external state manager like Zustand under high frequency updates?`;
    } else {
      return `Following up on the event loop, since Node is single-threaded, how do you handle CPU-intensive calculations (like cryptographic hashing or image processing) without blocking incoming I/O requests? Walk me through worker threads vs. child processes, and how you manage pool size.`;
    }
  }
  
  if (roundIndex === 2) {
    if (isFrontend) {
      return `Let's talk about closures and scoping. A common issue with React hooks (like useEffect or useCallback) is stale closures. Can you explain the fundamental JavaScript mechanism (lexical scoping) that causes stale closures in React, and write/explain exactly how you resolve them using refs or dependency arrays?`;
    } else {
      return `Let's look at database concurrency. Suppose we have a high-throughput check-out API in Node.js mapping to a PostgreSQL/SQLite database. How do you implement connection pooling? More importantly, how do you prevent race conditions (like double-booking or inventory depletion) using transaction isolation levels and Optimistic vs. Pessimistic locking?`;
    }
  }
  
  if (roundIndex === 3) {
    if (isFrontend) {
      return `When building a collaborative or real-time frontend dashboard, how do you handle caching, cache invalidation, and data consistency between client-side state and server-side databases (e.g., using optimistic UI updates or polling)? What are the trade-offs?`;
    } else {
      return `If we implement a Redis caching layer in front of our database to scale reads, how do you handle cache invalidation? Explain how you prevent systemic failures like cache stampede (thundering herd), cache penetration, and cache avalanche.`;
    }
  }

  if (roundIndex === 4) {
    if (isFrontend) {
      return `Excellent. Let's move onto Web Performance. How do you analyze and optimize Core Web Vitals, specifically LCP (Largest Contentful Paint) and CLS (Cumulative Layout Shift) in a large React single-page application? Explain your strategy for code-splitting, lazy loading, and asset delivery.`;
    } else {
      return `Excellent. Let's discuss Session Security. When building authenticated Express REST APIs, how do you securely manage JWTs and session storage? Walk me through your implementation of short-lived access tokens, refresh tokens stored in HTTP-only cookies, and how you prevent CSRF and XSS attacks.`;
    }
  }

  if (roundIndex === 5) {
    if (isFrontend) {
      return `Now, let's talk about the browser rendering pipeline. Explain the difference between Reflow (Layout), Repaint, and Composite steps. How do you write React code or CSS to trigger hardware-accelerated animations (using compositor layers) instead of triggering layout recalculation?`;
    } else {
      return `Let's move onto Testing and Deployments. How do you design an integration testing suite for Node APIs mapping to databases without polluting the production database? Discuss your use of mock libraries, transaction-level test rollbacks, and your basic Docker container setup for local CI/CD pipelines.`;
    }
  }

  if (roundIndex === 6) {
    if (isFrontend) {
      return `Let's discuss modern build tooling. Explain the core differences between bundlers like Webpack (Webpack compiler) and newer ESM-based tools like Vite (using Esbuild/Rollup). What is tree-shaking, how does it work under static analysis, and how do you configure it correctly?`;
    } else {
      return `Let's talk about asynchronous messaging. When building distributed systems in Node.js, when would you choose a pub/sub message broker like RabbitMQ over a distributed log system like Apache Kafka? Explain how you handle message delivery guarantees (At-Least-Once vs. Exactly-Once).`;
    }
  }

  if (roundIndex === 7) {
    if (isFrontend) {
      return `Let's shift focus to Web Accessibility (a11y). How do you audit a React application for accessibility? Explain your implementation of semantic HTML elements, ARIA attributes, keyboard traps/navigation, and screen reader announcements for dynamic content updates.`;
    } else {
      return `Let's talk about Serverless architecture. If you were deploying Node.js endpoints as Serverless/Edge functions (like Vercel/AWS Lambda), how do you manage database connection limits (which differ from persistent servers) and minimize cold start latencies?`;
    }
  }

  if (roundIndex === 8) {
    if (isFrontend) {
      return `Let's talk about real-time communications. What are the key architectural differences and performance trade-offs between WebSockets, Server-Sent Events (SSE), and standard Long Polling? In what scenarios would you choose WebSockets over SSE, and vice-versa?`;
    } else {
      return `Let's discuss fundamental system design theory. Explain the CAP Theorem and the PACELC theorem. If your system experiences a network partition, how do you choose between Consistency and Availability, and what are the database engines that support each choice?`;
    }
  }

  if (roundIndex === 9) {
    return `To conclude our interview, can you describe a challenging technical disagreement you had with a team member or product owner in a past project? How did you communicate your concerns, what compromise did you reach, and what did you learn from the outcome?`;
  }

  return 'The interview is complete. Thank you for your time.';
}

export function calculateAnswerScore(answer: string, question: string): { score: number, feedback: string, idealAnswer: string } {
  const length = answer.trim().length;
  const answerLower = answer.toLowerCase();
  
  let score = 5;
  let feedback = '';
  let idealAnswer = '';

  if (question.includes('introduce yourself') || question.includes('background')) {
    idealAnswer = 'Introduce your relevant experience, highlight major achievements (1-2 key projects), and explain why you are interested in this specific role.';
    if (length < 20) {
      score = 4;
      feedback = 'The response was too brief. An introduction should summarize your professional background, highlight core strengths, and explain your fit for the role.';
    } else if (length < 100) {
      score = 7;
      feedback = 'Good concise introduction, but could provide more details about specific projects and technologies you have worked with.';
    } else {
      score = 9;
      feedback = 'Excellent introduction! You clearly structured your experience, accomplishments, and expressed enthusiasm for the position.';
    }
  } else if (question.includes('state management') || question.includes('backend') || question.includes('technical problem')) {
    idealAnswer = 'Provide a structured technical explanation (e.g. Redux/Zustand for React, or Indexing/ORM optimization for SQL). Mention performance strategies, trade-offs, and use the STAR method for past project experiences.';
    
    const keywords = ['state', 'context', 'redux', 'zustand', 'database', 'index', 'sql', 'express', 'performance', 'optimize', 'cache', 'api', 'architecture', 'solved', 'challenge'];
    const matches = keywords.filter(kw => answerLower.includes(kw)).length;
    
    if (length < 30) {
      score = 4;
      feedback = 'The technical explanation lacked details. You should explain the underlying concepts and give concrete examples of how you applied them.';
    } else if (matches < 2) {
      score = 6;
      feedback = 'A decent response, but needs more technical depth. Mentioning specific libraries, performance strategies, and architectural considerations would strengthen your answer.';
    } else {
      score = 8 + Math.min(2, matches - 2);
      feedback = 'Strong technical answer. You demonstrated deep knowledge of code structures, optimization challenges, and how to resolve them.';
    }
  } else if (question.includes('design') || question.includes('scale') || question.includes('architecture')) {
    idealAnswer = 'Discuss horizontal vs vertical scaling, load balancers, caching layers (like Redis), message queues (like RabbitMQ/Kafka), database indexing/sharding, and API gateways.';
    const keywords = ['scale', 'load balancer', 'cache', 'redis', 'queue', 'kafka', 'database', 'cdn', 'architecture', 'latency', 'api', 'sharding'];
    const matches = keywords.filter(kw => answerLower.includes(kw)).length;
    
    if (length < 30) {
      score = 4;
      feedback = 'System design answers require a walk-through of structural components. Your answer did not specify the layers or technologies required to scale.';
    } else if (matches < 2) {
      score = 6;
      feedback = 'You identified some core requirements, but did not explain how the pieces connect. Expand on data caching, message queuing, and how you prevent single points of failure.';
    } else {
      score = 8 + Math.min(2, matches - 2);
      feedback = 'Impressive system design outline. You successfully mapped out the client-server flow, caching layers, and database scaling mechanisms.';
    }
  } else {
    idealAnswer = 'State the Situation, Task, Action you took, and the Result (STAR method). Emphasize professional communication, active listening, and finding collaborative solutions.';
    if (length < 35) {
      score = 5;
      feedback = 'Behavioral answers need concrete context. Use the STAR method to describe a specific event, your role in it, and the objective outcome.';
    } else if (!answerLower.includes('talked') && !answerLower.includes('discussed') && !answerLower.includes('communicated') && !answerLower.includes('agreed')) {
      score = 7;
      feedback = 'Good story, but could place more emphasis on communication skills and how you worked together to find a middle ground.';
    } else {
      score = 9;
      feedback = 'Great response. You showed maturity, professional conflict resolution skills, and focused on building team consensus.';
    }
  }

  return { score, feedback, idealAnswer };
}

export function runSimulatedEvaluation(position: string, company: string, jd: string, resumeText: string | null, transcriptList: any[]) {
  const questionAnswers = [];
  let totalScore = 0;
  let evaluatedCount = 0;
  let hasSuspectedFalseSkills = false;
  
  for (let i = 0; i < transcriptList.length; i += 2) {
    const qObj = transcriptList[i];
    const aObj = transcriptList[i + 1];
    
    if (qObj && aObj) {
      const qText = qObj.text;
      const aText = aObj.text;
      const analysis = calculateAnswerScore(aText, qText);
      
      let itemFeedback = analysis.feedback;
      let itemRating = analysis.score;
      
      if (resumeText && (qText.toLowerCase().includes('resume') || qText.toLowerCase().includes('claimed') || qText.toLowerCase().includes('trade-off'))) {
        if (aText.trim().length < 40) {
          itemRating = Math.max(3, itemRating - 3);
          itemFeedback = `Suspicion of fabricated resume skill: Candidate provided a superficial explanation when probed about their resume claim: "${aText}". This indicates a lack of real hands-on experience.`;
          hasSuspectedFalseSkills = true;
        }
      }
      
      questionAnswers.push({
        question: qText,
        candidateAnswer: aText,
        rating: itemRating,
        feedback: itemFeedback,
        idealAnswer: analysis.idealAnswer
      });
      
      totalScore += itemRating;
      evaluatedCount++;
    }
  }
  
  const avgRating = evaluatedCount > 0 ? totalScore / evaluatedCount : 7;
  let overallScore = Math.min(100, Math.round(avgRating * 10));
  
  if (hasSuspectedFalseSkills) {
    overallScore = Math.max(40, overallScore - 15);
  }
  
  const verdict = overallScore >= 75 ? 'SELECTED' : 'NOT SELECTED';
  
  let feedbackSummary = overallScore >= 75
    ? `The candidate performed very well for the ${position} role. They demonstrated sound technical logic, clear communication, and verified their resume claims successfully. With an overall score of ${overallScore}%, they meet the hiring bar.`
    : `The candidate showed potential but fell short on technical depth and failed to substantiate some of the claims made on their resume. For a role in ${position}, a higher level of authentic technical detail is expected.`;

  if (hasSuspectedFalseSkills) {
    feedbackSummary += ` WARNING: Probing questions revealed potential discrepancies/false skill claims in the candidate's resume (specifically regarding advanced tools or workflows where they could not provide structured technical reasoning).`;
  }
    
  const strengths = [
    'Articulate speaker with good conversational speed',
    'Demonstrates hands-on coding experience',
    'Good focus on teamwork and collaborative conflict resolution'
  ];
  
  const weaknesses = [
    hasSuspectedFalseSkills 
      ? 'Resume claims did not match depth of verbal technical explanations' 
      : 'Could provide more concrete architectural details in design scenarios',
    'Needs to explicitly mention performance benchmarks and testing approaches',
    'Should expand on database optimization strategies under high concurrent loads'
  ];

  return {
    overallScore,
    verdict,
    feedbackSummary,
    strengths,
    weaknesses,
    questionsAnalysis: questionAnswers
  };
}

const saveFailedQuestions = async (userId: string, questionsAnalysis: any[]) => {
  if (!questionsAnalysis || !Array.isArray(questionsAnalysis)) return;

  await Promise.all(
    questionsAnalysis.map(async (qa: any) => {
      if (qa.rating <= 7) {
        const existingQ = await prisma.question.findFirst({
          where: { userId, text: qa.question }
        });
        
        let questionId = existingQ?.id;
        
        if (!existingQ) {
          const newQ = await prisma.question.create({
            data: {
              userId,
              text: qa.question,
              answerDraft: qa.idealAnswer,
              difficulty: qa.rating <= 4 ? 'Hard' : 'Medium',
              category: 'AI Interview Practice',
              confidenceLevel: qa.rating,
              needsRevision: true
            }
          });
          questionId = newQ.id;
        }

        if (questionId) {
          const existingRevision = await prisma.revisionList.findFirst({
            where: {
              userId,
              questionId,
              status: 'Pending'
            }
          });

          if (!existingRevision) {
            await prisma.revisionList.create({
              data: {
                userId,
                questionId,
                scheduledFor: new Date(),
                priority: qa.rating <= 4 ? 'High' : 'Medium',
                status: 'Pending'
              }
            });
          }
        }
      }
    })
  );
};

export class InterviewService {
  static async startInterview({
    userId,
    position,
    companyName,
    jobDescription,
    personality,
    resumeFileBuffer,
    voiceEnabled = false,
    interviewType = 'technical',
    packId
  }: {
    userId: string;
    position: string;
    companyName?: string;
    jobDescription: string;
    personality: string;
    resumeFileBuffer?: Buffer;
    voiceEnabled?: boolean;
    interviewType?: string;
    packId?: string;
  }) {
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

    let resumeText = '';
    if (resumeFileBuffer) {
      try {
        const pdfData = await pdfParse(resumeFileBuffer);
        resumeText = pdfData.text || '';
      } catch (err: any) {
        logger.error({ error: err.message }, 'Error parsing resume PDF, falling back to default text');
      }

      if (!resumeText.trim()) {
        resumeText = "Skills: React, TypeScript, Node.js, Express, Zustand, SQL, AWS, REST APIs, Git, Unit Testing";
      }
    }

    const company = companyName || 'unspecified company';
    let firstQuestion = '';

    if (isGeminiEnabled()) {
      let prompt = `You are a professional, expert interviewer.
Your personality/style is: "${personality}".
You are interviewing a candidate for the position of "${position}" at the company "${company}".
Here is the Job Description (JD):
"""
${jobDescription}
"""
`;

      if (resumeText) {
        prompt += `
Here is the candidate's Resume:
"""
${resumeText}
"""

Your goal is to cross-examine the candidate on the skills and experiences they have claimed in their resume. Compare their resume claims with the Job Description requirements.
Identify critical technical skills or claims mentioned in the resume and verify whether they actually possess them or if they have fabricated them. 
`;
      }

      prompt += `
Conduct a realistic mock interview. 
Your first task: Greet the candidate warmly and encouragingly, introduce yourself briefly, and ask your FIRST interview question.
IMPORTANT: You are conducting a highly technical, deep-dive interview checking fundamental computer science and software engineering depth, but do so with a supportive, conversational tone to make the candidate feel comfortable.
If the candidate has a resume, ask a highly targeted conceptual opener about a core technology they listed (e.g. explain how React's Virtual DOM reconciliation works under Fiber, or how Node's Event Loop schedules microtasks).
Do not ask broad, generic introductory questions.
Rule: Do not output any meta-data, prefixes like "Interviewer:", or markdown tags. Just output the spoken greeting and first question. Keep it natural, warm, and conversational.`;

      try {
        firstQuestion = await callGemini(prompt);
      } catch (err: any) {
        logger.error({ error: err.message }, 'Gemini error during start. Falling back to simulation.');
        firstQuestion = getSimulatedQuestion(position, jobDescription, resumeText || null, 0);
      }
    } else {
      firstQuestion = getSimulatedQuestion(position, jobDescription, resumeText || null, 0);
    }

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
        position,
        companyName: companyName || null,
        jobDescription,
        resumeText: resumeText || null,
        personality,
        transcript: JSON.stringify(initialTranscript),
        voiceEnabled,
        interviewType,
        packId: packId || null
      }
    });

    return {
      interviewId: interview.id,
      firstQuestion,
      isSimulated: !isGeminiEnabled()
    };
  }

  static async respondInterview({
    userId,
    interviewId,
    answer
  }: {
    userId: string;
    interviewId: string;
    answer: string;
  }) {
    const interview = await prisma.aIInterview.findUnique({
      where: { id: interviewId },
      include: { pack: true }
    });


    if (!interview || interview.userId !== userId) {
      throw new ApiError(404, 'INTERVIEW_NOT_FOUND', 'Interview session not found or unauthorized.');
    }

    if (interview.overallScore !== null) {
      throw new ApiError(400, 'ALREADY_GRADED', 'This interview has already been finished and graded.');
    }

    const transcript = JSON.parse(interview.transcript);
    transcript.push({
      role: 'candidate',
      text: answer,
      timestamp: new Date().toISOString()
    });

    const candidateAnswersCount = transcript.filter((t: any) => t.role === 'candidate').length;
    const MAX_ROUNDS = 10;

    if (candidateAnswersCount >= MAX_ROUNDS) {
      let evaluation;
      if (isGeminiEnabled()) {
        const gradingPrompt = `You are an expert technical recruiter and interviewer.
Please evaluate the following mock interview session.
Position: "${interview.position}"
Company: "${interview.companyName || 'unspecified company'}"
Job Description:
"""
${interview.jobDescription}
"""
${interview.resumeText ? `Candidate's Resume:\n"""\n${interview.resumeText}\n"""\nAnalyze if the candidate showed genuine, authentic knowledge of the skills claimed in their resume, or if they failed to answer probing questions about them (indicating potential false skills).` : ''}

Here is the full conversation transcript:
${JSON.stringify(transcript, null, 2)}

Analyze their responses and generate a structured evaluation report. Your output MUST be a JSON object, and ONLY a JSON object. No backticks (like \`\`\`json), no prefix explanations, no markdown. 

JSON Schema:
{
  "overallScore": <integer between 0 and 100>,
  "verdict": "SELECTED" | "NOT SELECTED",
  "feedbackSummary": "<a concise 2-3 sentence summary of the performance, specifically highlighting if their resume claims felt authentic or if they had false skills>",
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "weaknesses": ["<weakness 1>", "<weakness 2>", "<weakness 3>"],
  "questionsAnalysis": [
    {
      "question": "<the interviewer question>",
      "candidateAnswer": "<the candidate's answer>",
      "rating": <integer between 1 and 10>,
      "feedback": "<brief feedback on their response, noting if their explanation verified their resume claim>",
      "idealAnswer": "<a short summary of what an ideal answer should cover>"
    }
  ]
}`;
        try {
          const geminiResultText = await callGemini(gradingPrompt, true);
          const cleanJson = geminiResultText
            .replace(/^```json\s*/i, '')
            .replace(/```\s*$/, '')
            .trim();
          evaluation = JSON.parse(cleanJson);
        } catch (err: any) {
          logger.error({ error: err.message }, 'Gemini grading failed. Falling back to simulated evaluation.');
          evaluation = runSimulatedEvaluation(interview.position, interview.companyName || '', interview.jobDescription, interview.resumeText, transcript);
        }
      } else {
        evaluation = runSimulatedEvaluation(interview.position, interview.companyName || '', interview.jobDescription, interview.resumeText, transcript);
      }

      await prisma.aIInterview.update({
        where: { id: interviewId },
        data: {
          transcript: JSON.stringify(transcript),
          overallScore: evaluation.overallScore,
          verdict: evaluation.verdict,
          feedbackSummary: evaluation.feedbackSummary,
          strengths: JSON.stringify(evaluation.strengths),
          weaknesses: JSON.stringify(evaluation.weaknesses),
        }
      });

      await saveFailedQuestions(userId, evaluation.questionsAnalysis);
      WeaknessAnalysisService.triggerAsynchronousAnalysis(userId);


      return {
        isFinished: true,
        evaluation,
        transcript
      };
    } else {
      let nextQuestion = '';
      if (isGeminiEnabled()) {
        let packPrompt = '';
        if (interview.pack) {
          const focusAreas = JSON.parse(interview.pack.questionFocusAreas as string).join(', ');
          packPrompt = `
This is a company-specific interview pack for ${interview.pack.companyName}.
- Interview Focus Areas: ${focusAreas}
- Cultural Context & Philosophy: "${interview.pack.culturalContext}"
- Difficulty: "${interview.pack.difficulty}"
Ensure the generated question matches ${interview.pack.companyName}'s known style, depth, difficulty, and focus areas.
`;
        }

        const prompt = `You are a professional, expert interviewer conducting a mock interview.${packPrompt}
Interviewer Personality: "${interview.personality}"
Position: "${interview.position}"
Company: "${interview.companyName || 'unspecified company'}"
Job Description:
"""
${interview.jobDescription}
"""
${interview.resumeText ? `Candidate's Resume:\n"""\n${interview.resumeText}\n"""\nUse their resume to cross-examine their claims and verify if they have false skills.` : ''}

Here is the conversation transcript so far:
${JSON.stringify(transcript, null, 2)}

The candidate just responded with: "${answer}"

Your task: Generate the NEXT question in the interview sequence (this is question ${candidateAnswersCount + 1} of ${MAX_ROUNDS}).
IMPORTANT: You must behave like a real technical interviewer performing a progressive technical deep-dive. 
- Active Listening & Candidate Comfort: Start your question with a brief, warm, natural transition or validation based on their prior answer (e.g. "That makes sense. Diving deeper into...", "I see, that's a solid point regarding... Let's look at the underlying mechanics of...", "Thanks for explaining that. To build on top of..."). This helps make the session feel interactive and comfortable.
- DO NOT change the topic or ask a repetitive, high-level question.
- Active Listening: Analyze the candidate's last answer. Ask a probing follow-up checking their technical fundamentals on that specific topic.
- Push for Depth: If their answer was high-level, ask them to explain the underlying compiler, engine, database, or library mechanics.
- Do not repeat topics.
Rule 2: Ask exactly ONE question. Keep your tone strictly in character.
Rule 3: Do not output any meta-data, prefixes like "Interviewer:", or markdown. Just output the question.`;

        try {
          nextQuestion = await callGemini(prompt);
        } catch (err: any) {
          logger.error({ error: err.message }, 'Gemini response error. Falling back to simulation.');
          nextQuestion = getSimulatedQuestion(interview.position, interview.jobDescription, interview.resumeText, candidateAnswersCount);
        }
      } else {
        nextQuestion = getSimulatedQuestion(interview.position, interview.jobDescription, interview.resumeText, candidateAnswersCount);
      }

      transcript.push({
        role: 'interviewer',
        text: nextQuestion,
        timestamp: new Date().toISOString()
      });

      await prisma.aIInterview.update({
        where: { id: interviewId },
        data: {
          transcript: JSON.stringify(transcript)
        }
      });

      return {
        isFinished: false,
        nextQuestion,
        currentRound: candidateAnswersCount + 1,
        totalRounds: MAX_ROUNDS
      };
    }
  }

  static async finishInterview({ userId, interviewId }: { userId: string, interviewId: string }) {
    const interview = await prisma.aIInterview.findUnique({
      where: { id: interviewId }
    });

    if (!interview || interview.userId !== userId) {
      throw new ApiError(404, 'INTERVIEW_NOT_FOUND', 'Interview session not found or unauthorized.');
    }

    if (interview.overallScore !== null) {
      throw new ApiError(400, 'ALREADY_GRADED', 'This interview has already been finished and graded.');
    }

    const transcript = JSON.parse(interview.transcript);
    const evaluation = runSimulatedEvaluation(interview.position, interview.companyName || '', interview.jobDescription, interview.resumeText, transcript);

    await prisma.aIInterview.update({
      where: { id: interviewId },
      data: {
        overallScore: evaluation.overallScore,
        verdict: evaluation.verdict,
        feedbackSummary: evaluation.feedbackSummary,
        strengths: JSON.stringify(evaluation.strengths),
        weaknesses: JSON.stringify(evaluation.weaknesses),
      }
    });

    await saveFailedQuestions(userId, evaluation.questionsAnalysis);
    WeaknessAnalysisService.triggerAsynchronousAnalysis(userId);


    return {
      evaluation,
      transcript
    };
  }

  static async getHistory(userId: string) {
    return prisma.aIInterview.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        position: true,
        companyName: true,
        personality: true,
        overallScore: true,
        verdict: true,
        createdAt: true
      }
    });
  }

  static async getInterviewDetails(userId: string, id: string) {
    const interview = await prisma.aIInterview.findUnique({
      where: { id }
    });

    if (!interview || interview.userId !== userId) {
      throw new ApiError(404, 'INTERVIEW_NOT_FOUND', 'Interview details not found or unauthorized.');
    }

    const transcriptList = JSON.parse(interview.transcript);
    const report = runSimulatedEvaluation(
      interview.position, 
      interview.companyName || '', 
      interview.jobDescription, 
      interview.resumeText,
      transcriptList
    );

    if (interview.overallScore !== null) {
      report.overallScore = interview.overallScore;
      report.verdict = interview.verdict || 'NOT SELECTED';
      report.feedbackSummary = interview.feedbackSummary || '';
      report.strengths = interview.strengths ? JSON.parse(interview.strengths) : [];
      report.weaknesses = interview.weaknesses ? JSON.parse(interview.weaknesses) : [];
    }

    return {
      id: interview.id,
      position: interview.position,
      companyName: interview.companyName,
      jobDescription: interview.jobDescription,
      personality: interview.personality,
      createdAt: interview.createdAt,
      evaluation: report,
      transcript: transcriptList
    };
  }
}

export default InterviewService;
