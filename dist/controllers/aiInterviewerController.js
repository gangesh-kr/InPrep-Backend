"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.purchaseCredits = exports.getInterviewDetails = exports.getHistory = exports.finishInterview = exports.respondInterview = exports.startInterview = void 0;
const InterviewService_1 = __importDefault(require("../services/InterviewService"));
const logger_1 = __importDefault(require("../utils/logger"));
// 1. Start Interview Session
const startInterview = async (req, res) => {
    try {
        const userId = req.userId;
        const { position, companyName, jobDescription, personality, voiceEnabled, interviewType, packId } = req.body;
        if (!position || !jobDescription || !personality) {
            return res.status(400).json({ error: 'Position, Job Description, and Personality are required fields.' });
        }
        const result = await InterviewService_1.default.startInterview({
            userId,
            position,
            companyName,
            jobDescription,
            personality,
            resumeFileBuffer: req.file?.buffer,
            voiceEnabled: voiceEnabled === 'true' || voiceEnabled === true,
            interviewType,
            packId
        });
        logger_1.default.info({ event: 'start_interview_success', userId, interviewId: result.interviewId }, 'Started a new interview session');
        return res.status(201).json({
            message: 'Interview started successfully',
            ...result
        });
    }
    catch (error) {
        logger_1.default.error({ event: 'start_interview_error', error: error.message }, 'Error starting interview');
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({ error: error.message || 'Internal server error starting interview.' });
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
        const result = await InterviewService_1.default.respondInterview({
            userId,
            interviewId,
            answer
        });
        logger_1.default.info({ event: 'respond_interview_success', userId, interviewId, isFinished: result.isFinished }, 'Processed interview answer');
        return res.json(result);
    }
    catch (error) {
        logger_1.default.error({ event: 'respond_interview_error', error: error.message }, 'Error processing interview response');
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({ error: error.message || 'Internal server error processing response.' });
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
        const result = await InterviewService_1.default.finishInterview({
            userId,
            interviewId
        });
        logger_1.default.info({ event: 'finish_interview_success', userId, interviewId }, 'Finished interview early');
        return res.json({
            message: 'Interview finished early and evaluated.',
            ...result
        });
    }
    catch (error) {
        logger_1.default.error({ event: 'finish_interview_error', error: error.message }, 'Error finishing interview early');
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({ error: error.message || 'Internal server error finishing interview.' });
    }
};
exports.finishInterview = finishInterview;
// 4. Get History of Past AI Interviews
const getHistory = async (req, res) => {
    try {
        const userId = req.userId;
        const history = await InterviewService_1.default.getHistory(userId);
        return res.json(history);
    }
    catch (error) {
        logger_1.default.error({ event: 'get_history_error', error: error.message }, 'Error fetching interview history');
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({ error: error.message || 'Internal server error fetching history.' });
    }
};
exports.getHistory = getHistory;
// 5. Get Detailed Interview Report
const getInterviewDetails = async (req, res) => {
    try {
        const userId = req.userId;
        const { id } = req.params;
        const details = await InterviewService_1.default.getInterviewDetails(userId, id);
        return res.json(details);
    }
    catch (error) {
        logger_1.default.error({ event: 'get_details_error', error: error.message }, 'Error fetching interview details');
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({ error: error.message || 'Internal server error fetching details.' });
    }
};
exports.getInterviewDetails = getInterviewDetails;
// 6. Purchase Credits (Mock Purchase Integration - Disabled for security)
const purchaseCredits = async (req, res) => {
    logger_1.default.info({ event: 'purchase_credits_attempt', userId: req.userId }, 'Attempted to purchase credits - disabled');
    return res.status(503).json({ error: 'Payment integration coming soon' });
};
exports.purchaseCredits = purchaseCredits;
