const express = require('express');
const router = express.Router();

const auth = require('../middleware/auth.middleware');
const controller = require('../controllers/photoLike.controller');

router.post('/:id/like', auth, controller.like);
router.delete('/:id/like', auth, controller.unlike);
router.get('/:id/likes', auth, controller.getLikes);

module.exports = router;