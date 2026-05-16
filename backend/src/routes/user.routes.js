const express = require('express');
const authMiddleware = require('../middleware/auth.middleware');
const { getMyProfile, updateMyProfile, getUserProfile, searchUsersController, 
    updateMyAvatar, 
    updateMyHeaderImage, getWhoToFollow } = require('../controllers/user.controller');
const uploadAvatar = require('../middleware/uploadAvatar');
const uploadHeader = require('../middleware/uploadHeader');


const router = express.Router();
router.get('/who-to-follow', authMiddleware, getWhoToFollow);
router.get('/search', authMiddleware, searchUsersController);
router.get('/:username', authMiddleware, getUserProfile);
router.get('/me', authMiddleware, getMyProfile);
router.put('/me', authMiddleware, updateMyProfile);
router.put('/me/avatar', authMiddleware, uploadAvatar.single('avatar'), updateMyAvatar);
router.put('/me/header', authMiddleware, uploadHeader.single('headerImage'), updateMyHeaderImage);
module.exports = router;