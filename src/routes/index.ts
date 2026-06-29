import { Router } from 'express';
import multer from 'multer';
import { authenticateToken } from '../middleware/auth';
import { register, login, getMe } from '../controllers/authController';
import { uploadAndParseResume } from '../controllers/resumeController';
import aiInterviewerRouter from './aiInterviewerRoutes';
import {
  listApplications,
  createApplication,
  getApplication,
  updateApplication,
  deleteApplication
} from '../controllers/applicationsController';
import {
  createRound,
  updateRound,
  deleteRound
} from '../controllers/roundsController';
import {
  listQuestions,
  createQuestion,
  updateQuestion,
  deleteQuestion
} from '../controllers/questionsController';
import {
  getWeaknesses,
  getRevisionList,
  completeRevision,
  getLearningItems,
  createLearningItem,
  updateLearningItem,
  deleteLearningItem,
  getJournalEntries,
  createJournalEntry,
  listSkills
} from '../controllers/intelligenceController';
import {
  getSummary,
  getSkillsDistribution,
  getActivityHeatmap,
  getDashboardFeed
} from '../controllers/analyticsController';

// Middleware & Schema Imports
import { validateRequest } from '../middleware/validate';
import { getHistoryQuerySchema, sessionIdParamSchema } from '../schemas/history';
import { getTrendsQuerySchema } from '../schemas/analytics';
import { emptySchema } from '../schemas/weakness';
import { packIdParamSchema } from '../schemas/packs';
import { synthesizeBodySchema } from '../schemas/voice';
import { generateScorecardSchema, scorecardIdParamSchema, shareScorecardSchema, publicTokenParamSchema } from '../schemas/scorecard';
import { generatePlanSchema, toggleTaskSchema, addTaskSchema, editTaskSchema, deleteTaskSchema } from '../schemas/learningPlan';

// Controller Imports
import { getHistory, getInterviewDetails, deleteHistory } from '../controllers/interviewHistoryController';
import { getTrends, getScoreBreakdown, getActivity } from '../controllers/trendsController';
import { getWeaknessProfile, refreshWeaknessProfile } from '../controllers/weaknessProfileController';
import { listPacks, getPackDetail, startPackSession, purchasePack } from '../controllers/companyPackController';
import { transcribe, synthesize } from '../controllers/voiceController';
import { generateScorecard, shareScorecard, getPublicScorecard, revokeScorecard, deleteScorecard } from '../controllers/scorecardController';
import {
  generatePlan as generateLearningPlan,
  getPlan as getLearningPlan,
  toggleTask as toggleLearningTask,
  addTask as addLearningTask,
  editTask as editLearningTask,
  deleteTask as deleteLearningTask,
  regeneratePlan as regenerateLearningPlan
} from '../controllers/learningPlanController';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Auth routes
router.post('/auth/register', register);
router.post('/auth/login', login);
router.get('/auth/me', authenticateToken as any, getMe as any);
router.post('/auth/resume', authenticateToken as any, upload.single('resume'), uploadAndParseResume as any);

// Job applications routes
router.get('/applications', authenticateToken as any, listApplications as any);
router.post('/applications', authenticateToken as any, createApplication as any);
router.get('/applications/:id', authenticateToken as any, getApplication as any);
router.put('/applications/:id', authenticateToken as any, updateApplication as any);
router.delete('/applications/:id', authenticateToken as any, deleteApplication as any);

// Interview rounds routes
router.post('/rounds', authenticateToken as any, createRound as any);
router.put('/rounds/:id', authenticateToken as any, updateRound as any);
router.delete('/rounds/:id', authenticateToken as any, deleteRound as any);

// Question repository routes
router.get('/questions', authenticateToken as any, listQuestions as any);
router.post('/questions', authenticateToken as any, createQuestion as any);
router.put('/questions/:id', authenticateToken as any, updateQuestion as any);
router.delete('/questions/:id', authenticateToken as any, deleteQuestion as any);

// Intelligence features routes
router.get('/intelligence/weaknesses', authenticateToken as any, getWeaknesses as any);
router.get('/intelligence/revision-list', authenticateToken as any, getRevisionList as any);
router.post('/intelligence/revision-list/:id/complete', authenticateToken as any, completeRevision as any);

// Learning tracker routes
router.get('/intelligence/learning', authenticateToken as any, getLearningItems as any);
router.post('/intelligence/learning', authenticateToken as any, createLearningItem as any);
router.put('/intelligence/learning/:id', authenticateToken as any, updateLearningItem as any);
router.delete('/intelligence/learning/:id', authenticateToken as any, deleteLearningItem as any);
router.get('/intelligence/skills', authenticateToken as any, listSkills as any);

// Journal entries routes
router.get('/intelligence/journal', authenticateToken as any, getJournalEntries as any);
router.post('/intelligence/journal', authenticateToken as any, createJournalEntry as any);

// Analytics routes
router.get('/analytics/summary', authenticateToken as any, getSummary as any);
router.get('/analytics/skills-distribution', authenticateToken as any, getSkillsDistribution as any);
router.get('/analytics/activity-heatmap', authenticateToken as any, getActivityHeatmap as any);
router.get('/analytics/dashboard-feed', authenticateToken as any, getDashboardFeed as any);

// AI Interviewer routes
router.use('/ai-interviewer', authenticateToken as any, aiInterviewerRouter);

// ==========================================
// NEW FEATURE ENDPOINTS
// ==========================================

// Feature 1: Interview History routes
router.get(
  '/interview-history',
  authenticateToken as any,
  validateRequest({ query: getHistoryQuerySchema }),
  getHistory as any
);
router.get(
  '/interview-history/:sessionId',
  authenticateToken as any,
  validateRequest({ params: sessionIdParamSchema }),
  getInterviewDetails as any
);
router.delete(
  '/interview-history/:sessionId',
  authenticateToken as any,
  validateRequest({ params: sessionIdParamSchema }),
  deleteHistory as any
);

// Feature 2: Analytics Trends routes
router.get(
  '/analytics/trends',
  authenticateToken as any,
  validateRequest({ query: getTrendsQuerySchema }),
  getTrends as any
);
router.get(
  '/analytics/score-breakdown',
  authenticateToken as any,
  getScoreBreakdown as any
);
router.get(
  '/analytics/activity',
  authenticateToken as any,
  getActivity as any
);

// Feature 3: Weak Topic Detection routes
router.get(
  '/weakness-profile',
  authenticateToken as any,
  getWeaknessProfile as any
);
router.post(
  '/weakness-profile/refresh',
  authenticateToken as any,
  validateRequest({ body: emptySchema }),
  refreshWeaknessProfile as any
);

// Feature 4: Company Packs routes
router.get(
  '/packs',
  authenticateToken as any,
  listPacks as any
);
router.get(
  '/packs/:packId',
  authenticateToken as any,
  validateRequest({ params: packIdParamSchema }),
  getPackDetail as any
);
router.post(
  '/packs/:packId/start',
  authenticateToken as any,
  validateRequest({ params: packIdParamSchema }),
  startPackSession as any
);
router.post(
  '/packs/:packId/purchase',
  authenticateToken as any,
  validateRequest({ params: packIdParamSchema }),
  purchasePack as any
);

// Feature 5: Voice Conversations routes
router.post(
  '/voice/transcribe',
  authenticateToken as any,
  upload.single('file'),
  transcribe as any
);
router.post(
  '/voice/synthesize',
  authenticateToken as any,
  validateRequest({ body: synthesizeBodySchema }),
  synthesize as any
);

// Feature 6: Recruiter-Ready Scorecards routes
router.post(
  '/scorecards/generate',
  authenticateToken as any,
  validateRequest({ body: generateScorecardSchema }),
  generateScorecard as any
);
router.post(
  '/scorecards/:scorecardId/share',
  authenticateToken as any,
  validateRequest({ params: scorecardIdParamSchema, body: shareScorecardSchema }),
  shareScorecard as any
);
router.post(
  '/scorecards/:scorecardId/revoke',
  authenticateToken as any,
  validateRequest({ params: scorecardIdParamSchema }),
  revokeScorecard as any
);
router.delete(
  '/scorecards/:scorecardId',
  authenticateToken as any,
  validateRequest({ params: scorecardIdParamSchema }),
  deleteScorecard as any
);
// Public Scorecard Route (UNAUTHENTICATED)
router.get(
  '/scorecard/public/:publicToken',
  validateRequest({ params: publicTokenParamSchema }),
  getPublicScorecard as any
);

// Feature 7: Personalized Learning Plans routes
router.get(
  '/learning-plan',
  authenticateToken as any,
  getLearningPlan as any
);
router.post(
  '/learning-plan/generate',
  authenticateToken as any,
  validateRequest({ body: generatePlanSchema }),
  generateLearningPlan as any
);
router.patch(
  '/learning-plan/task',
  authenticateToken as any,
  validateRequest({ body: toggleTaskSchema }),
  toggleLearningTask as any
);
router.post(
  '/learning-plan/task',
  authenticateToken as any,
  validateRequest({ body: addTaskSchema }),
  addLearningTask as any
);
router.put(
  '/learning-plan/task',
  authenticateToken as any,
  validateRequest({ body: editTaskSchema }),
  editLearningTask as any
);
router.delete(
  '/learning-plan/task',
  authenticateToken as any,
  validateRequest({ body: deleteTaskSchema }),
  deleteLearningTask as any
);
router.post(
  '/learning-plan/regenerate',
  authenticateToken as any,
  validateRequest({ body: emptySchema }),
  regenerateLearningPlan as any
);

export default router;
