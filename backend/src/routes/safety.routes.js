const express = require('express');
const authMiddleware = require('../middleware/auth.middleware');
const {
  getTermsStatus,
  acceptTermsController,
  reportContent,
  blockUserController,
  unblockUserController,
  listBlockedUsers,
  getBlockStatus,
  requestAccountDeletion,
} = require('../controllers/safety.controller');

const router = express.Router();

router.post('/account-deletion-requests', requestAccountDeletion);
router.get('/terms-status', authMiddleware, getTermsStatus);
router.post('/terms/accept', authMiddleware, acceptTermsController);
router.post('/reports', authMiddleware, reportContent);
router.get('/blocks', authMiddleware, listBlockedUsers);
router.get('/blocks/:userId/status', authMiddleware, getBlockStatus);
router.post('/blocks/:userId', authMiddleware, blockUserController);
router.delete('/blocks/:userId', authMiddleware, unblockUserController);

module.exports = router;
