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
  getActivityHeatmap
} from '../controllers/analyticsController';

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

// AI Interviewer routes
router.use('/ai-interviewer', authenticateToken as any, aiInterviewerRouter);

export default router;
