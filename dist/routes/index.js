"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const auth_1 = require("../middleware/auth");
const authController_1 = require("../controllers/authController");
const resumeController_1 = require("../controllers/resumeController");
const aiInterviewerRoutes_1 = __importDefault(require("./aiInterviewerRoutes"));
const applicationsController_1 = require("../controllers/applicationsController");
const roundsController_1 = require("../controllers/roundsController");
const questionsController_1 = require("../controllers/questionsController");
const intelligenceController_1 = require("../controllers/intelligenceController");
const analyticsController_1 = require("../controllers/analyticsController");
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
// Auth routes
router.post('/auth/register', authController_1.register);
router.post('/auth/login', authController_1.login);
router.get('/auth/me', auth_1.authenticateToken, authController_1.getMe);
router.post('/auth/resume', auth_1.authenticateToken, upload.single('resume'), resumeController_1.uploadAndParseResume);
// Job applications routes
router.get('/applications', auth_1.authenticateToken, applicationsController_1.listApplications);
router.post('/applications', auth_1.authenticateToken, applicationsController_1.createApplication);
router.get('/applications/:id', auth_1.authenticateToken, applicationsController_1.getApplication);
router.put('/applications/:id', auth_1.authenticateToken, applicationsController_1.updateApplication);
router.delete('/applications/:id', auth_1.authenticateToken, applicationsController_1.deleteApplication);
// Interview rounds routes
router.post('/rounds', auth_1.authenticateToken, roundsController_1.createRound);
router.put('/rounds/:id', auth_1.authenticateToken, roundsController_1.updateRound);
router.delete('/rounds/:id', auth_1.authenticateToken, roundsController_1.deleteRound);
// Question repository routes
router.get('/questions', auth_1.authenticateToken, questionsController_1.listQuestions);
router.post('/questions', auth_1.authenticateToken, questionsController_1.createQuestion);
router.put('/questions/:id', auth_1.authenticateToken, questionsController_1.updateQuestion);
router.delete('/questions/:id', auth_1.authenticateToken, questionsController_1.deleteQuestion);
// Intelligence features routes
router.get('/intelligence/weaknesses', auth_1.authenticateToken, intelligenceController_1.getWeaknesses);
router.get('/intelligence/revision-list', auth_1.authenticateToken, intelligenceController_1.getRevisionList);
router.post('/intelligence/revision-list/:id/complete', auth_1.authenticateToken, intelligenceController_1.completeRevision);
// Learning tracker routes
router.get('/intelligence/learning', auth_1.authenticateToken, intelligenceController_1.getLearningItems);
router.post('/intelligence/learning', auth_1.authenticateToken, intelligenceController_1.createLearningItem);
router.put('/intelligence/learning/:id', auth_1.authenticateToken, intelligenceController_1.updateLearningItem);
router.delete('/intelligence/learning/:id', auth_1.authenticateToken, intelligenceController_1.deleteLearningItem);
router.get('/intelligence/skills', auth_1.authenticateToken, intelligenceController_1.listSkills);
// Journal entries routes
router.get('/intelligence/journal', auth_1.authenticateToken, intelligenceController_1.getJournalEntries);
router.post('/intelligence/journal', auth_1.authenticateToken, intelligenceController_1.createJournalEntry);
// Analytics routes
router.get('/analytics/summary', auth_1.authenticateToken, analyticsController_1.getSummary);
router.get('/analytics/skills-distribution', auth_1.authenticateToken, analyticsController_1.getSkillsDistribution);
router.get('/analytics/activity-heatmap', auth_1.authenticateToken, analyticsController_1.getActivityHeatmap);
// AI Interviewer routes
router.use('/ai-interviewer', auth_1.authenticateToken, aiInterviewerRoutes_1.default);
exports.default = router;
