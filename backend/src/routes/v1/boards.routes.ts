import { Router } from 'express';
import {
  createBoardColumn,
  deleteBoardColumn,
  getBoard,
  getBoardMetrics,
  listMyBoards,
  reorderBoardColumns,
  updateBoardColumn,
} from '../../controllers/board.controller';
import { authenticate } from '../../middlewares/authenticate';

const router = Router();

router.use(authenticate);

router.get('/my', listMyBoards);
router.get('/:boardId/metrics', getBoardMetrics);
router.get('/:boardId', getBoard);
router.post('/:boardId/columns', createBoardColumn);
router.patch('/:boardId/columns/reorder', reorderBoardColumns);
router.patch('/:boardId/columns/:columnId', updateBoardColumn);
router.delete('/:boardId/columns/:columnId', deleteBoardColumn);

export default router;
