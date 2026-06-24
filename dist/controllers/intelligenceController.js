"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listSkills = exports.createJournalEntry = exports.getJournalEntries = exports.deleteLearningItem = exports.updateLearningItem = exports.createLearningItem = exports.getLearningItems = exports.completeRevision = exports.getRevisionList = exports.getWeaknesses = void 0;
const client_1 = __importDefault(require("../client"));
const getWeaknesses = async (req, res) => {
    try {
        const userId = req.userId;
        const userSkills = await client_1.default.skill.findMany({
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
            }
            else if (averageConfidence <= 6 || needsRevisionCount > 0) {
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
    }
    catch (error) {
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
};
exports.getWeaknesses = getWeaknesses;
const getRevisionList = async (req, res) => {
    try {
        const userId = req.userId;
        let scheduled = await client_1.default.revisionList.findMany({
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
            const lowConfidenceQuestions = await client_1.default.question.findMany({
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
            const autoScheduled = await Promise.all(lowConfidenceQuestions.map(async (q) => {
                const rev = await client_1.default.revisionList.create({
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
            }));
            scheduled = [...scheduled, ...autoScheduled];
        }
        return res.json(scheduled);
    }
    catch (error) {
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
};
exports.getRevisionList = getRevisionList;
const completeRevision = async (req, res) => {
    try {
        const { id } = req.params;
        const { confidenceLevel, answerNotes } = req.body;
        const revisionItem = await client_1.default.revisionList.findUnique({
            where: { id },
            include: {
                question: true,
            },
        });
        if (!revisionItem || revisionItem.userId !== req.userId) {
            return res.status(404).json({ error: 'Revision item not found or unauthorized' });
        }
        const newConfidence = parseInt(confidenceLevel);
        await client_1.default.revisionList.update({
            where: { id },
            data: {
                status: 'Completed',
            },
        });
        await client_1.default.question.update({
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
        const nextRevision = await client_1.default.revisionList.create({
            data: {
                userId: req.userId,
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
    }
    catch (error) {
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
};
exports.completeRevision = completeRevision;
const getLearningItems = async (req, res) => {
    try {
        const items = await client_1.default.learningItem.findMany({
            where: { userId: req.userId },
            orderBy: { lastStudiedAt: 'desc' },
        });
        return res.json(items);
    }
    catch (error) {
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
};
exports.getLearningItems = getLearningItems;
const createLearningItem = async (req, res) => {
    try {
        const { skillName, status, progressPercent, hoursInvested } = req.body;
        if (!skillName) {
            return res.status(400).json({ error: 'Skill Name is required' });
        }
        const item = await client_1.default.learningItem.create({
            data: {
                userId: req.userId,
                skillName,
                status: status || 'Backlog',
                progressPercent: progressPercent ? parseInt(progressPercent) : 0,
                hoursInvested: hoursInvested ? parseFloat(hoursInvested) : 0.0,
            },
        });
        return res.status(201).json(item);
    }
    catch (error) {
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
};
exports.createLearningItem = createLearningItem;
const updateLearningItem = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, progressPercent, hoursInvested } = req.body;
        const existing = await client_1.default.learningItem.findUnique({
            where: { id },
        });
        if (!existing || existing.userId !== req.userId) {
            return res.status(404).json({ error: 'Learning item not found or unauthorized' });
        }
        const updated = await client_1.default.learningItem.update({
            where: { id },
            data: {
                status: status !== undefined ? status : existing.status,
                progressPercent: progressPercent !== undefined ? parseInt(progressPercent) : existing.progressPercent,
                hoursInvested: hoursInvested !== undefined ? parseFloat(hoursInvested) : existing.hoursInvested,
                lastStudiedAt: new Date(),
            },
        });
        return res.json(updated);
    }
    catch (error) {
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
};
exports.updateLearningItem = updateLearningItem;
const deleteLearningItem = async (req, res) => {
    try {
        const { id } = req.params;
        const existing = await client_1.default.learningItem.findUnique({
            where: { id },
        });
        if (!existing || existing.userId !== req.userId) {
            return res.status(404).json({ error: 'Learning item not found or unauthorized' });
        }
        await client_1.default.learningItem.delete({
            where: { id },
        });
        return res.json({ message: 'Learning item deleted successfully' });
    }
    catch (error) {
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
};
exports.deleteLearningItem = deleteLearningItem;
const getJournalEntries = async (req, res) => {
    try {
        const entries = await client_1.default.journalEntry.findMany({
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
    }
    catch (error) {
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
};
exports.getJournalEntries = getJournalEntries;
const createJournalEntry = async (req, res) => {
    try {
        const { interviewRoundId, wins, mistakes, mood, nextActions } = req.body;
        if (interviewRoundId) {
            const round = await client_1.default.interviewRound.findUnique({
                where: { id: interviewRoundId },
                include: { application: true },
            });
            if (!round || round.application.userId !== req.userId) {
                return res.status(404).json({ error: 'Interview round not found or unauthorized' });
            }
        }
        const entry = await client_1.default.journalEntry.create({
            data: {
                userId: req.userId,
                interviewRoundId: interviewRoundId || null,
                wins: wins || null,
                mistakes: mistakes || null,
                mood: mood || null,
                nextActions: nextActions || null,
            },
        });
        return res.status(201).json(entry);
    }
    catch (error) {
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
};
exports.createJournalEntry = createJournalEntry;
const listSkills = async (req, res) => {
    try {
        const skills = await client_1.default.skill.findMany({
            where: { userId: req.userId },
            orderBy: { name: 'asc' },
        });
        return res.json(skills);
    }
    catch (error) {
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
};
exports.listSkills = listSkills;
