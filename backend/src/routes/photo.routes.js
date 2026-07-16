const express = require('express');
const router = express.Router();

const auth = require('../middleware/auth.middleware');
const uploadPhoto = require('../middleware/uploadPhoto');
const photoController = require('../controllers/photo.controller');

router.post('/', auth, uploadPhoto.single('photo'), photoController.createPhoto);

router.get('/user/:userId/avatar', auth, photoController.getAvatarPhoto);
router.get('/user/:userId', auth, photoController.getUserPhotos);
router.get('/:id', auth, photoController.getPhoto);

router.put('/:id', auth, photoController.updatePhoto);

router.delete('/:id', auth, photoController.deletePhoto);

module.exports = router;
