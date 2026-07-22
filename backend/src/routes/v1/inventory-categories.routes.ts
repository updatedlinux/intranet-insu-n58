import { Router } from 'express';
import { ADMIN_ROLES } from '../../constants/roles';
import {
  createAssetCategoryAdmin,
  createConsumableCategoryAdmin,
  deleteAssetCategoryAdmin,
  deleteConsumableCategoryAdmin,
  getAssetCategoryAdmin,
  getConsumableCategoryAdmin,
  listAssetCategoriesAdmin,
  listConsumableCategoriesAdmin,
  updateAssetCategoryAdmin,
  updateConsumableCategoryAdmin,
} from '../../controllers/inventory-category.controller';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';

const router = Router();
const adminOnly = [authenticate, authorize(...ADMIN_ROLES)] as const;

router.get('/assets', ...adminOnly, listAssetCategoriesAdmin);
router.get('/assets/:id', ...adminOnly, getAssetCategoryAdmin);
router.post('/assets', ...adminOnly, createAssetCategoryAdmin);
router.put('/assets/:id', ...adminOnly, updateAssetCategoryAdmin);
router.delete('/assets/:id', ...adminOnly, deleteAssetCategoryAdmin);

router.get('/consumables', ...adminOnly, listConsumableCategoriesAdmin);
router.get('/consumables/:id', ...adminOnly, getConsumableCategoryAdmin);
router.post('/consumables', ...adminOnly, createConsumableCategoryAdmin);
router.put('/consumables/:id', ...adminOnly, updateConsumableCategoryAdmin);
router.delete('/consumables/:id', ...adminOnly, deleteConsumableCategoryAdmin);

export default router;
