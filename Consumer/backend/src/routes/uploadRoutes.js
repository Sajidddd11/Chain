import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { handleFileUpload, handleReceiptScan, handleLeftoverScan } from '../controllers/uploadController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.resolve(__dirname, '../../uploads');

// Ensure uploads directory exists
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const timestamp = Date.now();
    const sanitized = file.originalname.replace(/\s+/g, '_');
    cb(null, `${timestamp}_${sanitized}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

router.post('/', authenticate, upload.single('file'), handleFileUpload);
router.post('/scan-receipt', authenticate, upload.single('file'), handleReceiptScan);
router.post('/scan-leftovers', authenticate, upload.single('file'), handleLeftoverScan);

export default router;

