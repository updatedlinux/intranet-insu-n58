import { Router } from 'express';
import {
  createConsumable,
  getConsumable,
  listConsumableCategories,
  listConsumables,
  listTicketConsumableUsage,
  stockAdjust,
  stockIn,
  stockOut,
  updateConsumable,
} from '../../controllers/consumable.controller';
import {
  deleteConsumablePhoto,
  serveConsumablePhoto,
  uploadConsumablePhoto,
} from '../../controllers/consumable-photo.controller';
import { authenticate } from '../../middlewares/authenticate';
import { requireItInventory } from '../../middlewares/requireItInventory';
import {
  assetPhotoUploadMiddleware,
  handleAssetPhotoUploadError,
} from '../../middlewares/uploadAssetPhoto';

const router = Router();
router.use(authenticate, requireItInventory);

router.get('/categories', listConsumableCategories);
router.get('/ticket-usage/:ticketId', listTicketConsumableUsage);
router.post('/', createConsumable);
router.get('/', listConsumables);
router.get('/:id/photo', serveConsumablePhoto);
router.post(
  '/:id/photo',
  (req, res, next) => {
    assetPhotoUploadMiddleware(req, res, (err) => {
      if (err) {
        handleAssetPhotoUploadError(err, req, res, next);
        return;
      }
      next();
    });
  },
  uploadConsumablePhoto,
);
router.delete('/:id/photo', deleteConsumablePhoto);
router.get('/:id', getConsumable);
router.patch('/:id', updateConsumable);
router.post('/:id/stock/in', stockIn);
router.post('/:id/stock/out', stockOut);
router.post('/:id/stock/adjust', stockAdjust);

export default router;
