const express = require('express');
const router = express.Router();

const auth = require('../middleware/auth.middleware');
const controller = require('../controllers/photoComment.controller');

router.post('/:id/comments', auth, controller.createComment);
router.get('/:id/comments', auth, controller.getComments);
router.delete('/comments/:commentId', auth, controller.deleteComment);
router.put('/comments/:commentId', auth, controller.updateComment);

module.exports = router;