import { Router } from 'express';
import multer from 'multer';
import {
  startInterview,
  respondInterview,
  finishInterview,
  getHistory,
  getInterviewDetails,
  purchaseCredits
} from '../controllers/aiInterviewerController';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/start', upload.single('resume'), startInterview as any);
router.post('/respond', respondInterview as any);
router.post('/finish', finishInterview as any);
router.get('/history', getHistory as any);
router.get('/history/:id', getInterviewDetails as any);
router.post('/purchase-credits', purchaseCredits as any);

export default router;
