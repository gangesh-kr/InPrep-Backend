"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteQuestion = exports.updateQuestion = exports.createQuestion = exports.listQuestions = void 0;
const client_1 = __importDefault(require("../client"));
console.log('=============================================> process', process.memoryUsage());
const listQuestions = async (req, res) => {
    try {
        const { difficulty, category, skill } = req.query;
        const userQuestions = await client_1.default.question.findMany({
            where: {
                userId: req.userId,
                ...(difficulty ? { difficulty: difficulty } : {}),
                ...(category ? { category: category } : {}),
                ...(skill ? {
                    skills: {
                        some: {
                            name: skill,
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
    }
    catch (error) {
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
};
exports.listQuestions = listQuestions;
const createQuestion = async (req, res) => {
    try {
        const { roundId, text, answerDraft, difficulty, category, confidenceLevel, needsRevision, skillNames } = req.body;
        if (!text) {
            return res.status(400).json({ error: 'Question text is required' });
        }
        // Verify round ownership if roundId is provided
        if (roundId) {
            const round = await client_1.default.interviewRound.findUnique({
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
                    let skill = await client_1.default.skill.findUnique({
                        where: {
                            userId_name: {
                                userId: req.userId,
                                name: trimmedName,
                            },
                        },
                    });
                    if (!skill) {
                        skill = await client_1.default.skill.create({
                            data: {
                                userId: req.userId,
                                name: trimmedName,
                            },
                        });
                    }
                    skillsToConnect.push({ id: skill.id });
                }
            }
        }
        const question = await client_1.default.question.create({
            data: {
                userId: req.userId,
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
    }
    catch (error) {
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
};
exports.createQuestion = createQuestion;
const updateQuestion = async (req, res) => {
    try {
        const { id } = req.params;
        const { text, answerDraft, difficulty, category, confidenceLevel, needsRevision, skillNames } = req.body;
        // Verify ownership of the question
        const question = await client_1.default.question.findUnique({
            where: { id },
        });
        if (!question || question.userId !== req.userId) {
            return res.status(404).json({ error: 'Question not found or unauthorized' });
        }
        // Process skills if updated
        let skillsUpdate = {};
        if (skillNames && Array.isArray(skillNames)) {
            const skillsToConnect = [];
            for (const name of skillNames) {
                const trimmedName = name.trim();
                if (trimmedName) {
                    let skill = await client_1.default.skill.findUnique({
                        where: {
                            userId_name: {
                                userId: req.userId,
                                name: trimmedName,
                            },
                        },
                    });
                    if (!skill) {
                        skill = await client_1.default.skill.create({
                            data: {
                                userId: req.userId,
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
        const updated = await client_1.default.question.update({
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
    }
    catch (error) {
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
};
exports.updateQuestion = updateQuestion;
const deleteQuestion = async (req, res) => {
    try {
        const { id } = req.params;
        const question = await client_1.default.question.findUnique({
            where: { id },
        });
        if (!question || question.userId !== req.userId) {
            return res.status(404).json({ error: 'Question not found or unauthorized' });
        }
        await client_1.default.question.delete({
            where: { id },
        });
        return res.json({ message: 'Question deleted successfully' });
    }
    catch (error) {
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
};
exports.deleteQuestion = deleteQuestion;
