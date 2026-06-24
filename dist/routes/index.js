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
// Middleware & Schema Imports
const validate_1 = require("../middleware/validate");
const history_1 = require("../schemas/history");
const analytics_1 = require("../schemas/analytics");
const weakness_1 = require("../schemas/weakness");
const packs_1 = require("../schemas/packs");
const voice_1 = require("../schemas/voice");
const scorecard_1 = require("../schemas/scorecard");
const learningPlan_1 = require("../schemas/learningPlan");
// Controller Imports
const interviewHistoryController_1 = require("../controllers/interviewHistoryController");
const trendsController_1 = require("../controllers/trendsController");
const weaknessProfileController_1 = require("../controllers/weaknessProfileController");
const companyPackController_1 = require("../controllers/companyPackController");
const voiceController_1 = require("../controllers/voiceController");
const scorecardController_1 = require("../controllers/scorecardController");
const learningPlanController_1 = require("../controllers/learningPlanController");
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
// ==========================================
// NEW FEATURE ENDPOINTS
// ==========================================
// Feature 1: Interview History routes
router.get('/interview-history', auth_1.authenticateToken, (0, validate_1.validateRequest)({ query: history_1.getHistoryQuerySchema }), interviewHistoryController_1.getHistory);
router.get('/interview-history/:sessionId', auth_1.authenticateToken, (0, validate_1.validateRequest)({ params: history_1.sessionIdParamSchema }), interviewHistoryController_1.getInterviewDetails);
router.delete('/interview-history/:sessionId', auth_1.authenticateToken, (0, validate_1.validateRequest)({ params: history_1.sessionIdParamSchema }), interviewHistoryController_1.deleteHistory);
// Feature 2: Analytics Trends routes
router.get('/analytics/trends', auth_1.authenticateToken, (0, validate_1.validateRequest)({ query: analytics_1.getTrendsQuerySchema }), trendsController_1.getTrends);
router.get('/analytics/score-breakdown', auth_1.authenticateToken, trendsController_1.getScoreBreakdown);
router.get('/analytics/activity', auth_1.authenticateToken, trendsController_1.getActivity);
// Feature 3: Weak Topic Detection routes
router.get('/weakness-profile', auth_1.authenticateToken, weaknessProfileController_1.getWeaknessProfile);
router.post('/weakness-profile/refresh', auth_1.authenticateToken, (0, validate_1.validateRequest)({ body: weakness_1.emptySchema }), weaknessProfileController_1.refreshWeaknessProfile);
// Feature 4: Company Packs routes
router.get('/packs', auth_1.authenticateToken, companyPackController_1.listPacks);
router.get('/packs/:packId', auth_1.authenticateToken, (0, validate_1.validateRequest)({ params: packs_1.packIdParamSchema }), companyPackController_1.getPackDetail);
router.post('/packs/:packId/start', auth_1.authenticateToken, (0, validate_1.validateRequest)({ params: packs_1.packIdParamSchema }), companyPackController_1.startPackSession);
router.post('/packs/:packId/purchase', auth_1.authenticateToken, (0, validate_1.validateRequest)({ params: packs_1.packIdParamSchema }), companyPackController_1.purchasePack);
// Feature 5: Voice Conversations routes
router.post('/voice/transcribe', auth_1.authenticateToken, upload.single('file'), voiceController_1.transcribe);
router.post('/voice/synthesize', auth_1.authenticateToken, (0, validate_1.validateRequest)({ body: voice_1.synthesizeBodySchema }), voiceController_1.synthesize);
// Feature 6: Recruiter-Ready Scorecards routes
router.post('/scorecards/generate', auth_1.authenticateToken, (0, validate_1.validateRequest)({ body: scorecard_1.generateScorecardSchema }), scorecardController_1.generateScorecard);
router.post('/scorecards/:scorecardId/share', auth_1.authenticateToken, (0, validate_1.validateRequest)({ params: scorecard_1.scorecardIdParamSchema, body: scorecard_1.shareScorecardSchema }), scorecardController_1.shareScorecard);
router.post('/scorecards/:scorecardId/revoke', auth_1.authenticateToken, (0, validate_1.validateRequest)({ params: scorecard_1.scorecardIdParamSchema }), scorecardController_1.revokeScorecard);
router.delete('/scorecards/:scorecardId', auth_1.authenticateToken, (0, validate_1.validateRequest)({ params: scorecard_1.scorecardIdParamSchema }), scorecardController_1.deleteScorecard);
// Public Scorecard Route (UNAUTHENTICATED)
router.get('/scorecard/public/:publicToken', (0, validate_1.validateRequest)({ params: scorecard_1.publicTokenParamSchema }), scorecardController_1.getPublicScorecard);
// Feature 7: Personalized Learning Plans routes
router.get('/learning-plan', auth_1.authenticateToken, learningPlanController_1.getPlan);
router.post('/learning-plan/generate', auth_1.authenticateToken, (0, validate_1.validateRequest)({ body: learningPlan_1.generatePlanSchema }), learningPlanController_1.generatePlan);
router.patch('/learning-plan/task', auth_1.authenticateToken, (0, validate_1.validateRequest)({ body: learningPlan_1.toggleTaskSchema }), learningPlanController_1.toggleTask);
router.post('/learning-plan/regenerate', auth_1.authenticateToken, (0, validate_1.validateRequest)({ body: weakness_1.emptySchema }), learningPlanController_1.regeneratePlan);
exports.default = router;
