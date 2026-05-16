const express = require('express');
const router = express.Router();

const auth = require('../middleware/auth.middleware');
const controller = require('../controllers/postComment.controller');

router.post('/:postId/comments', auth, controller.createComment);
router.get('/:postId/comments', auth, controller.getComments);
router.delete('/comments/:commentId', auth, controller.deleteComment);
router.put('/comments/:commentId', auth, controller.updateComment);

module.exports = router;