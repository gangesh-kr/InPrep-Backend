"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getInterviewDetails = exports.getHistory = exports.finishInterview = exports.respondInterview = exports.startInterview = void 0;
const client_1 = __importDefault(require("../client"));
// @ts-ignore
const pdf_parse_1 = __importDefault(require("pdf-parse"));
const genai_1 = require("@google/genai");
// Initialize the Google Gen AI client if API key is provided
let aiClient = null;
const getAIClient = () => {
    if (!aiClient && process.env.GEMINI_API_KEY) {
        aiClient = new genai_1.GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }
    return aiClient;
};
// Helper to check if Gemini API Key is available
const isGeminiEnabled = () => !!process.env.GEMINI_API_KEY;
console.log("======>", isGeminiEnabled(), process.env.GEMINI_API_KEY);
// API calling helper for Gemini using SDK with fallback sequence
async function callGemini(prompt, jsonMode = false) {
    const client = getAIClient();
    if (!client) {
        throw new Error('GEMINI_API_KEY is not defined in the environment.');
    }
    const modelsToTry = [
        'gemini-2.5-flash',
        'gemini-2.0-flash',
        'gemini-2.0-flash-lite'
    ];
    let lastError = null;
    for (const modelName of modelsToTry) {
        try {
            const response = await client.models.generateContent({
                model: modelName,
                contents: prompt,
                config: jsonMode ? {
                    responseMimeType: 'application/json'
                } : undefined,
            });
            const text = response.text;
            if (text)
                return text;
        }
        catch (err) {
            console.warn(`Model ${modelName} failed, trying fallback model...`, err.message || err);
            lastError = err;
        }
    }
    throw new Error(`All Gemini models failed. Last error: ${lastError?.message || lastError}`);
}
// ----------------------------------------------------
// SIMULATION ENGINE (Fallback when no Gemini Key)
// ----------------------------------------------------
function getSimulatedQuestion(position, jd, resumeText, roundIndex) {
    const jdLower = jd.toLowerCase();
    const resumeLower = resumeText ? resumeText.toLowerCase() : '';
    const isFrontend = jdLower.includes('react') || jdLower.includes('frontend') || jdLower.includes('javascript') || jdLower.includes('typescript') || resumeLower.includes('react');
    if (roundIndex === 0) {
        if (resumeText) {
            const targetTech = isFrontend ? 'React and TypeScript' : 'Node.js and Express';
            return `Hello! Welcome to your interview. In your resume, you highlighted strong experience with ${targetTech}. To kick off our technical deep dive, can you explain the core execution model of this technology? For example, ${isFrontend ? "explain how React's Virtual DOM reconciliation works under the hood under React Fiber, and how it differs from direct DOM manipulation." : "explain how Node's single-threaded Event Loop manages asynchronous execution queues, and the difference between microtasks and macrotasks."}`;
        }
        return `Hello! Welcome to your interview for the ${position} role. To start off, could you please introduce yourself, tell me about your background, and outline how your experience aligns with this position?`;
    }
    if (roundIndex === 1) {
        // Probing technical deep-dive 1: State & Memory/Concurrency
        if (isFrontend) {
            return `Let's drill down into React rendering. When a state update is triggered in a hook (e.g. setState), how does React schedule and batch this update internally? Furthermore, how do you prevent unnecessary render cycles, and what are the exact performance limits of using Context API vs. an external state manager like Zustand under high frequency updates?`;
        }
        else {
            return `Following up on the event loop, since Node is single-threaded, how do you handle CPU-intensive calculations (like cryptographic hashing or image processing) without blocking incoming I/O requests? Walk me through worker threads vs. child processes, and how you manage pool size.`;
        }
    }
    if (roundIndex === 2) {
        // Probing technical deep-dive 2: Advanced mechanics & Closures/Locks
        if (isFrontend) {
            return `Let's talk about closures and scoping. A common issue with React hooks (like useEffect or useCallback) is stale closures. Can you explain the fundamental JavaScript mechanism (lexical scoping) that causes stale closures in React, and write/explain exactly how you resolve them using refs or dependency arrays?`;
        }
        else {
            return `Let's look at database concurrency. Suppose we have a high-throughput check-out API in Node.js mapping to a PostgreSQL/SQLite database. How do you implement connection pooling? More importantly, how do you prevent race conditions (like double-booking or inventory depletion) using transaction isolation levels and Optimistic vs. Pessimistic locking?`;
        }
    }
    if (roundIndex === 3) {
        // Probing technical deep-dive 3: Architectural Trade-offs & Consistency/Caching
        if (isFrontend) {
            return `Finally, let's look at architectural data synchronization. When building a collaborative or real-time frontend dashboard, how do you handle caching, cache invalidation, and data consistency between client-side state and server-side databases (e.g., using optimistic UI updates or polling)? What are the trade-offs?`;
        }
        else {
            return `Finally, let's look at cache architectures. If we implement a Redis caching layer in front of our database to scale reads, how do you handle cache invalidation? Explain how you prevent systemic failures like cache stampede (thundering herd), cache penetration, and cache avalanche.`;
        }
    }
    return 'The interview is complete. Thank you for your time.';
}
function calculateAnswerScore(answer, question) {
    const length = answer.trim().length;
    const answerLower = answer.toLowerCase();
    let score = 5;
    let feedback = '';
    let idealAnswer = '';
    // Determine question type from text
    if (question.includes('introduce yourself') || question.includes('background')) {
        idealAnswer = 'Introduce your relevant experience, highlight major achievements (1-2 key projects), and explain why you are interested in this specific role.';
        if (length < 20) {
            score = 4;
            feedback = 'The response was too brief. An introduction should summarize your professional background, highlight core strengths, and explain your fit for the role.';
        }
        else if (length < 100) {
            score = 7;
            feedback = 'Good concise introduction, but could provide more details about specific projects and technologies you have worked with.';
        }
        else {
            score = 9;
            feedback = 'Excellent introduction! You clearly structured your experience, accomplishments, and expressed enthusiasm for the position.';
        }
    }
    else if (question.includes('state management') || question.includes('backend') || question.includes('technical problem')) {
        idealAnswer = 'Provide a structured technical explanation (e.g. Redux/Zustand for React, or Indexing/ORM optimization for SQL). Mention performance strategies, trade-offs, and use the STAR method for past project experiences.';
        // Check keywords
        const keywords = ['state', 'context', 'redux', 'zustand', 'database', 'index', 'sql', 'express', 'performance', 'optimize', 'cache', 'api', 'architecture', 'solved', 'challenge'];
        const matches = keywords.filter(kw => answerLower.includes(kw)).length;
        if (length < 30) {
            score = 4;
            feedback = 'The technical explanation lacked details. You should explain the underlying concepts and give concrete examples of how you applied them.';
        }
        else if (matches < 2) {
            score = 6;
            feedback = 'A decent response, but needs more technical depth. Mentioning specific libraries, performance strategies, and architectural considerations would strengthen your answer.';
        }
        else {
            score = 8 + Math.min(2, matches - 2);
            feedback = 'Strong technical answer. You demonstrated deep knowledge of code structures, optimization challenges, and how to resolve them.';
        }
    }
    else if (question.includes('design') || question.includes('scale') || question.includes('architecture')) {
        idealAnswer = 'Discuss horizontal vs vertical scaling, load balancers, caching layers (like Redis), message queues (like RabbitMQ/Kafka), database indexing/sharding, and API gateways.';
        const keywords = ['scale', 'load balancer', 'cache', 'redis', 'queue', 'kafka', 'database', 'cdn', 'architecture', 'latency', 'api', 'sharding'];
        const matches = keywords.filter(kw => answerLower.includes(kw)).length;
        if (length < 30) {
            score = 4;
            feedback = 'System design answers require a walk-through of structural components. Your answer did not specify the layers or technologies required to scale.';
        }
        else if (matches < 2) {
            score = 6;
            feedback = 'You identified some core requirements, but did not explain how the pieces connect. Expand on data caching, message queuing, and how you prevent single points of failure.';
        }
        else {
            score = 8 + Math.min(2, matches - 2);
            feedback = 'Impressive system design outline. You successfully mapped out the client-server flow, caching layers, and database scaling mechanisms.';
        }
    }
    else {
        // Behavioral
        idealAnswer = 'State the Situation, Task, Action you took, and the Result (STAR method). Emphasize professional communication, active listening, and finding collaborative solutions.';
        if (length < 35) {
            score = 5;
            feedback = 'Behavioral answers need concrete context. Use the STAR method to describe a specific event, your role in it, and the objective outcome.';
        }
        else if (!answerLower.includes('talked') && !answerLower.includes('discussed') && !answerLower.includes('communicated') && !answerLower.includes('agreed')) {
            score = 7;
            feedback = 'Good story, but could place more emphasis on communication skills and how you worked together to find a middle ground.';
        }
        else {
            score = 9;
            feedback = 'Great response. You showed maturity, professional conflict resolution skills, and focused on building team consensus.';
        }
    }
    return { score, feedback, idealAnswer };
}
function runSimulatedEvaluation(position, company, jd, resumeText, transcriptList) {
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
            // Probing check for resume claim verification
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
// ----------------------------------------------------
// CONTROLLER HANDLERS
// ----------------------------------------------------
// 1. Start Interview Session
const startInterview = async (req, res) => {
    try {
        const userId = req.userId;
        const { position, companyName, jobDescription, personality } = req.body;
        if (!position || !jobDescription || !personality) {
            return res.status(400).json({ error: 'Position, Job Description, and Personality are required fields.' });
        }
        // Parse resume PDF if uploaded
        let resumeText = '';
        if (req.file) {
            try {
                const dataBuffer = req.file.buffer;
                const pdfData = await (0, pdf_parse_1.default)(dataBuffer);
                resumeText = pdfData.text || '';
            }
            catch (err) {
                console.error('Error parsing resume PDF:', err);
            }
            // If parsing fails or is empty, fallback to standard mock text to ensure cross-examination operates
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
            }
            catch (err) {
                console.error('Gemini error during start. Falling back to simulation.', err);
                firstQuestion = getSimulatedQuestion(position, jobDescription, resumeText, 0);
            }
        }
        else {
            // Run Simulated Mode
            firstQuestion = getSimulatedQuestion(position, jobDescription, resumeText, 0);
        }
        // Create the initial transcript structure
        const initialTranscript = [
            {
                role: 'interviewer',
                text: firstQuestion,
                timestamp: new Date().toISOString()
            }
        ];
        const interview = await client_1.default.aIInterview.create({
            data: {
                userId,
                position,
                companyName: companyName || null,
                jobDescription,
                resumeText: resumeText || null,
                personality,
                transcript: JSON.stringify(initialTranscript)
            }
        });
        return res.status(201).json({
            message: 'Interview started successfully',
            interviewId: interview.id,
            firstQuestion,
            isSimulated: !isGeminiEnabled()
        });
    }
    catch (error) {
        console.error('Start Interview Error:', error);
        return res.status(500).json({ error: error.message || 'Internal server error starting interview.' });
    }
};
exports.startInterview = startInterview;
// 2. Respond to Current Question & Receive Next Question
const respondInterview = async (req, res) => {
    try {
        const userId = req.userId;
        const { interviewId, answer } = req.body;
        if (!interviewId || answer === undefined) {
            return res.status(400).json({ error: 'Interview ID and Candidate Answer are required.' });
        }
        const interview = await client_1.default.aIInterview.findUnique({
            where: { id: interviewId }
        });
        if (!interview || interview.userId !== userId) {
            return res.status(404).json({ error: 'Interview session not found or unauthorized.' });
        }
        if (interview.overallScore !== null) {
            return res.status(400).json({ error: 'This interview has already been finished and graded.' });
        }
        const transcript = JSON.parse(interview.transcript);
        // Add candidate's answer
        transcript.push({
            role: 'candidate',
            text: answer,
            timestamp: new Date().toISOString()
        });
        // Count how many answers the candidate has submitted
        const candidateAnswersCount = transcript.filter((t) => t.role === 'candidate').length;
        // Total rounds of questions: 4. Once candidate answers 4 times, the interview finishes.
        const MAX_ROUNDS = 4;
        if (candidateAnswersCount >= MAX_ROUNDS) {
            // Interview complete! Trigger grading
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
                }
                catch (err) {
                    console.error('Gemini grading failed. Falling back to simulated evaluation.', err);
                    evaluation = runSimulatedEvaluation(interview.position, interview.companyName || '', interview.jobDescription, interview.resumeText, transcript);
                }
            }
            else {
                evaluation = runSimulatedEvaluation(interview.position, interview.companyName || '', interview.jobDescription, interview.resumeText, transcript);
            }
            // Update the interview record in DB
            const updatedInterview = await client_1.default.aIInterview.update({
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
            // Save questions to the general Questions database for practice!
            // This is a great integration showing utility - we save the questions they missed or scored low on!
            if (evaluation.questionsAnalysis) {
                await Promise.all(evaluation.questionsAnalysis.map(async (qa) => {
                    if (qa.rating <= 7) { // If confidence/rating was low or moderate
                        // Check if question already exists in DB
                        const existingQ = await client_1.default.question.findFirst({
                            where: { userId, text: qa.question }
                        });
                        if (!existingQ) {
                            await client_1.default.question.create({
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
                        }
                    }
                }));
            }
            return res.json({
                isFinished: true,
                evaluation,
                transcript
            });
        }
        else {
            // Interview not finished. Generate next question.
            let nextQuestion = '';
            if (isGeminiEnabled()) {
                const prompt = `You are a professional, expert interviewer conducting a mock interview.
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
- Active Listening: Analyze the candidate's last answer. Ask a probing follow-up checking their technical fundamentals on that specific topic (e.g. if they mentioned state, ask how React schedules it; if they mentioned databases, ask about transaction locks or isolation levels; if they mentioned async code, ask about memory leaks or closures).
- Push for Depth: If their answer was high-level, ask them to explain the underlying compiler, engine, database, or library mechanics.
- Do not repeat topics.
Rule 2: Ask exactly ONE question. Keep your tone strictly in character.
Rule 3: Do not output any meta-data, prefixes like "Interviewer:", or markdown. Just output the question.`;
                try {
                    nextQuestion = await callGemini(prompt);
                }
                catch (err) {
                    console.error('Gemini response error. Falling back to simulation.', err);
                    nextQuestion = getSimulatedQuestion(interview.position, interview.jobDescription, interview.resumeText, candidateAnswersCount);
                }
            }
            else {
                nextQuestion = getSimulatedQuestion(interview.position, interview.jobDescription, interview.resumeText, candidateAnswersCount);
            }
            // Append interviewer's next question to transcript
            transcript.push({
                role: 'interviewer',
                text: nextQuestion,
                timestamp: new Date().toISOString()
            });
            // Update transcript in DB
            await client_1.default.aIInterview.update({
                where: { id: interviewId },
                data: {
                    transcript: JSON.stringify(transcript)
                }
            });
            return res.json({
                isFinished: false,
                nextQuestion,
                currentRound: candidateAnswersCount + 1,
                totalRounds: MAX_ROUNDS
            });
        }
    }
    catch (error) {
        console.error('Respond Interview Error:', error);
        return res.status(500).json({ error: error.message || 'Internal server error processing response.' });
    }
};
exports.respondInterview = respondInterview;
// 3. Prematurely Finish and Evaluate Interview
const finishInterview = async (req, res) => {
    try {
        const userId = req.userId;
        const { interviewId } = req.body;
        if (!interviewId) {
            return res.status(400).json({ error: 'Interview ID is required.' });
        }
        const interview = await client_1.default.aIInterview.findUnique({
            where: { id: interviewId }
        });
        if (!interview || interview.userId !== userId) {
            return res.status(404).json({ error: 'Interview session not found or unauthorized.' });
        }
        if (interview.overallScore !== null) {
            return res.status(400).json({ error: 'This interview has already been finished and graded.' });
        }
        const transcript = JSON.parse(interview.transcript);
        // Evaluate whatever questions they completed
        const evaluation = runSimulatedEvaluation(interview.position, interview.companyName || '', interview.jobDescription, interview.resumeText, transcript);
        const updated = await client_1.default.aIInterview.update({
            where: { id: interviewId },
            data: {
                overallScore: evaluation.overallScore,
                verdict: evaluation.verdict,
                feedbackSummary: evaluation.feedbackSummary,
                strengths: JSON.stringify(evaluation.strengths),
                weaknesses: JSON.stringify(evaluation.weaknesses),
            }
        });
        return res.json({
            message: 'Interview finished early and evaluated.',
            evaluation,
            transcript
        });
    }
    catch (error) {
        console.error('Finish Interview Error:', error);
        return res.status(500).json({ error: error.message || 'Internal server error finishing interview.' });
    }
};
exports.finishInterview = finishInterview;
// 4. Get History of Past AI Interviews
const getHistory = async (req, res) => {
    try {
        const userId = req.userId;
        const history = await client_1.default.aIInterview.findMany({
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
        return res.json(history);
    }
    catch (error) {
        console.error('Get History Error:', error);
        return res.status(500).json({ error: error.message || 'Internal server error fetching history.' });
    }
};
exports.getHistory = getHistory;
// 5. Get Detailed Interview Report
const getInterviewDetails = async (req, res) => {
    try {
        const userId = req.userId;
        const { id } = req.params;
        const interview = await client_1.default.aIInterview.findUnique({
            where: { id }
        });
        if (!interview || interview.userId !== userId) {
            return res.status(404).json({ error: 'Interview details not found or unauthorized.' });
        }
        const transcriptList = JSON.parse(interview.transcript);
        // Re-run evaluation calculation to construct the full report details if needed, or if it is already in DB
        // Since we only save summary-level DB items, let's run evaluation on transcript to build the detailed breakdown
        const report = runSimulatedEvaluation(interview.position, interview.companyName || '', interview.jobDescription, interview.resumeText, transcriptList);
        // Override with DB scores if saved
        if (interview.overallScore !== null) {
            report.overallScore = interview.overallScore;
            report.verdict = interview.verdict || 'NOT SELECTED';
            report.feedbackSummary = interview.feedbackSummary || '';
            report.strengths = interview.strengths ? JSON.parse(interview.strengths) : [];
            report.weaknesses = interview.weaknesses ? JSON.parse(interview.weaknesses) : [];
        }
        return res.json({
            id: interview.id,
            position: interview.position,
            companyName: interview.companyName,
            jobDescription: interview.jobDescription,
            personality: interview.personality,
            createdAt: interview.createdAt,
            evaluation: report,
            transcript: transcriptList
        });
    }
    catch (error) {
        console.error('Get Details Error:', error);
        return res.status(500).json({ error: error.message || 'Internal server error fetching details.' });
    }
};
exports.getInterviewDetails = getInterviewDetails;
