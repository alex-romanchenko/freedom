const express = require('express');
const { register, login, verifyEmail, forgotPassword, resetPassword, resendVerificationEmail, } = require('../controllers/auth.controller');
const authMiddleware = require('../middleware/auth.middleware');

const router = express.Router();
const { googleLogin, linkGoogle } = require('../controllers/googleAuth.controller');
const googleAuthGuard = require('../middleware/googleAuthGuard');

router.post('/google', googleAuthGuard, googleLogin);
router.post('/google/link', googleAuthGuard, authMiddleware, linkGoogle);

router.post('/register', register);
router.post('/login', login);
router.get('/verify-email', verifyEmail);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/resend-verification', resendVerificationEmail);
router.get('/me', authMiddleware, (req, res) => {
  res.json({
    message: 'User is authorized',
    user: req.user,
  });
});

module.exports = router;
