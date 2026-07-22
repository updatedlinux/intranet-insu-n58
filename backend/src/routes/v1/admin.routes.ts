import { Router } from 'express';
import { ADMIN_ROLES } from '../../constants/roles';
import {
  createCollaborator,
  deleteCollaborator,
  getCollaborator,
  listCollaborators,
  resetCollaboratorPassword,
  setCollaboratorStatus,
  updateCollaborator,
} from '../../controllers/collaborator.controller';
import { listAreas, listPositions, listRoles } from '../../controllers/catalog.controller';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';

const router = Router();

const adminOnly = [authenticate, authorize(...ADMIN_ROLES)] as const;

router.get('/colaboradores', ...adminOnly, listCollaborators);
router.get('/colaboradores/:id', ...adminOnly, getCollaborator);
router.post('/colaboradores', ...adminOnly, createCollaborator);
router.put('/colaboradores/:id', ...adminOnly, updateCollaborator);
router.patch('/colaboradores/:id/estado', ...adminOnly, setCollaboratorStatus);
router.post('/colaboradores/:id/reset-password', ...adminOnly, resetCollaboratorPassword);
router.delete('/colaboradores/:id', ...adminOnly, deleteCollaborator);

router.get('/catalogos/roles', ...adminOnly, listRoles);
router.get('/catalogos/areas', ...adminOnly, listAreas);
router.get('/catalogos/positions', ...adminOnly, listPositions);

export default router;
