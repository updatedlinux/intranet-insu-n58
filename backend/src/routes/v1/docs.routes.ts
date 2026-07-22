import { Router } from 'express';
import {
  approveDocument,
  browseFolder,
  browseRootFolder,
  createFolder,
  deleteDocument,
  deleteFolder,
  downloadDocument,
  listMyUploads,
  listPendingDocuments,
  listRejectedDocuments,
  rejectDocument,
  uploadDocument,
} from '../../controllers/document.controller';
import { authenticate } from '../../middlewares/authenticate';
import { wrapDocumentUpload } from '../../middlewares/uploadDocument';

const router = Router();

router.use(authenticate);

router.get('/pending', listPendingDocuments);
router.get('/rejected', listRejectedDocuments);
router.get('/my-uploads', listMyUploads);

router.get('/folders', browseRootFolder);
router.get('/folders/:id', browseFolder);
router.post('/folders', createFolder);
router.delete('/folders/:id', deleteFolder);
router.post('/upload', wrapDocumentUpload, uploadDocument);

router.post('/:documentId/approve', approveDocument);
router.post('/:documentId/reject', rejectDocument);
router.get('/:documentId/download', downloadDocument);
router.delete('/:documentId', deleteDocument);

export default router;
