import { Router } from 'express';
import { reportError, ingestLog, getErrors } from '../controllers/telemetryController';

const router = Router();

router.post('/error', reportError);
router.post('/log', ingestLog);
router.get('/errors', getErrors);

export default router;
