import { Router } from 'express';
import {
  addMaintenance,
  assignAsset,
  createAsset,
  getAsset,
  listAssetCategories,
  listAssets,
  listUserAssets,
  patchAssetStatus,
  unassignAsset,
  updateAsset,
} from '../../controllers/asset.controller';
import {
  deleteAssetPhoto,
  serveAssetPhoto,
  uploadAssetPhoto,
} from '../../controllers/asset-photo.controller';
import { authenticate } from '../../middlewares/authenticate';
import { requireItInventory } from '../../middlewares/requireItInventory';
import {
  assetPhotoUploadMiddleware,
  handleAssetPhotoUploadError,
} from '../../middlewares/uploadAssetPhoto';

const router = Router();
router.use(authenticate, requireItInventory);

router.get('/categories', listAssetCategories);
router.get('/user/:userId', listUserAssets);
router.post('/', createAsset);
router.get('/', listAssets);
router.get('/:id/photo', serveAssetPhoto);
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
  uploadAssetPhoto,
);
router.delete('/:id/photo', deleteAssetPhoto);
router.get('/:id', getAsset);
router.patch('/:id', updateAsset);
router.patch('/:id/assign', assignAsset);
router.patch('/:id/unassign', unassignAsset);
router.patch('/:id/status', patchAssetStatus);
router.post('/:id/maintenance', addMaintenance);

export default router;
