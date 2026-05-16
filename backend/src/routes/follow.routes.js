const express = require('express');
const authMiddleware = require('../middleware/auth.middleware');
const { follow, unfollow, getFriends, getUserFriends, getIncoming, markRequestsSeen } = require('../controllers/follow.controller');

const router = express.Router();

router.put('/requests/seen', authMiddleware, markRequestsSeen);
router.get('/requests/incoming', authMiddleware, getIncoming);
router.post('/:userId', authMiddleware, follow);
router.delete('/:userId', authMiddleware, unfollow);
router.get('/', authMiddleware, getFriends);
router.get('/user/:username', authMiddleware, getUserFriends);


module.exports = router;