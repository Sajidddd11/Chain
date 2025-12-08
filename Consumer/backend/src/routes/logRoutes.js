import { Router } from 'express';
import { addLog, listLogs, suggestUsagePlan } from '../controllers/logController.js';
import { flexibleAuth } from '../middleware/flexibleAuth.js';

const router = Router();

router.get('/', flexibleAuth, listLogs);
router.post('/', flexibleAuth, addLog);
router.post('/suggest', flexibleAuth, suggestUsagePlan);

export default router;

