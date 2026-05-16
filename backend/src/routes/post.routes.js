const express = require('express');
const authMiddleware = require('../middleware/auth.middleware');
const { 
    createNewPost, 
    getFeed,
    like,
    unlike,
    getFavorites,
    updatePost,
     deletePost,
     getMyFeed,
     getPopular,
     getLikes,
     getPost,
     
 } = require('../controllers/post.controller');
const router = express.Router();
const uploadPostImage = require('../middleware/uploadPostImage');

router.get('/popular', authMiddleware, getPopular);
router.get('/my', authMiddleware, getMyFeed);
router.get('/:postId', authMiddleware, getPost);
router.get('/', authMiddleware, getFeed);
router.post('/:postId/like', authMiddleware, like);
router.delete('/:postId/like', authMiddleware, unlike);
router.get('/favorites', authMiddleware, getFavorites);
router.post('/', authMiddleware, uploadPostImage.single('image'), createNewPost);
router.get('/', authMiddleware, getFeed);
router.put('/:postId', authMiddleware, updatePost);
router.get('/:postId/likes', authMiddleware, getLikes);
router.delete('/:postId', authMiddleware, deletePost);

module.exports = router;