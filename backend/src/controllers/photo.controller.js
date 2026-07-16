const Photo = require('../models/photo.model');


async function createPhoto(req, res) {
  try {
    const userId = req.user.id;
    const description = req.body.description || '';
    const image = req.file ? `/uploads/photos/${req.file.filename}` : null;

    if (!image) {
      return res.status(400).json({ message: 'Photo image is required' });
    }

    const photo = await Photo.createPhoto(userId, image, description);

    res.status(201).json(photo);
  } catch (error) {
    console.error('Create photo error:', error);
    res.status(500).json({ message: 'Server error' });
  }
}

async function getUserPhotos(req, res) {
  try {
    const userId = req.params.userId;
    const currentUserId = req.user.id;

    const photos = await Photo.getPhotosByUserId(userId, currentUserId);

    res.json(photos);
  } catch (error) {
    console.error('Get photos error:', error);
    res.status(500).json({ message: 'Server error' });
  }
}

async function getAvatarPhoto(req, res) {
  try {
    const userId = req.params.userId;
    const currentUserId = req.user.id;
    const photo = await Photo.getAvatarPhotoByUserId(userId, currentUserId);

    if (!photo) {
      return res.status(404).json({ message: 'Avatar photo not found' });
    }

    res.json(photo);
  } catch (error) {
    console.error('Get avatar photo error:', error);
    res.status(500).json({ message: 'Server error' });
  }
}

async function updatePhoto(req, res) {
  try {
    const photoId = req.params.id;
    const userId = req.user.id;
    const { description } = req.body;

    const photo = await Photo.updatePhotoDescription(photoId, userId, description);

    if (!photo) {
      return res.status(404).json({ message: 'Photo not found' });
    }

    res.json(photo);
  } catch (error) {
    console.error('Update photo error:', error);
    res.status(500).json({ message: 'Server error' });
  }
}

async function deletePhoto(req, res) {
  try {
    const photoId = req.params.id;
    const userId = req.user.id;

    const photo = await Photo.deletePhoto(photoId, userId);

    if (!photo) {
      return res.status(404).json({ message: 'Photo not found' });
    }

    res.json({ message: 'Photo deleted' });
  } catch (error) {
    console.error('Delete photo error:', error);
    res.status(500).json({ message: 'Server error' });
  }
}

async function getPhoto(req, res) {
  try {
    const photoId = req.params.id;
    const userId = req.user.id;

    const photo = await Photo.getPhotoById(photoId, userId);

    if (!photo) {
      return res.status(404).json({ message: 'Photo not found' });
    }

    res.json(photo);
  } catch (error) {
    console.error('Get photo error:', error);
    res.status(500).json({ message: 'Server error' });
  }
}

module.exports = {
  createPhoto,
  getUserPhotos,
  getAvatarPhoto,
  updatePhoto,
  deletePhoto,
  getPhoto,
};
