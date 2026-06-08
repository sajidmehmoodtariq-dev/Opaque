import express from 'express';
import { uploadPublicKey, getPublicKey } from '../controllers/keyController.js';
import { authenticateJWT } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/', authenticateJWT, uploadPublicKey);
router.get('/:targetUserId', authenticateJWT, getPublicKey);

export default router;
