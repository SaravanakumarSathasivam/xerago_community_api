const express = require('express');
const { authenticate } = require('../middleware/auth');
const { authLimiter, passwordResetLimiter, emailVerificationLimiter } = require('../middleware/rateLimiter');
const { validate, userSchemas } = require('../middleware/validation');
const {
  register,
  login,
  refreshToken,
  logout,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerification,
  getMe
} = require('../controllers/authController');
const User = require('../models/User');
const { sendEmailVerification } = require('../utils/email');
const { generateRandomString } = require('../utils/helpers');

const router = express.Router();

// Public routes
router.post('/register', authLimiter, validate(userSchemas.register), register);
router.post('/login', authLimiter, validate(userSchemas.login), login);
router.post('/refresh', validate(userSchemas.refreshToken), refreshToken);
router.post('/forgot-password', passwordResetLimiter, validate(userSchemas.forgotPassword), forgotPassword);
router.post('/reset-password', passwordResetLimiter, validate(userSchemas.resetPassword), resetPassword);
router.post('/verify-email', emailVerificationLimiter, validate(userSchemas.verifyEmail), verifyEmail);
router.post('/resend-verification', emailVerificationLimiter, validate(userSchemas.resendVerification), resendVerification);

// Verify via OTP code
router.post('/verify-otp', emailVerificationLimiter, validate(userSchemas.verifyOtp), async (req, res, next) => {
  try {
    const { email, code } = req.body;
    const user = await User.findByEmail(email);
    if (!user || !user.emailVerificationCode || !user.emailVerificationExpires) {
      return res.status(400).json({ success: false, message: 'Invalid verification request' });
    }
    if (user.emailVerificationExpires <= new Date()) {
      return res.status(400).json({ success: false, message: 'Verification code expired' });
    }
    if (String(user.emailVerificationCode) !== String(code)) {
      return res.status(400).json({ success: false, message: 'Invalid verification code' });
    }
    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationCode = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();
    return res.json({ success: true, message: 'Email verified successfully' });
  } catch (err) {
    next(err);
  }
});

// Resend OTP code
router.post('/resend-otp', emailVerificationLimiter, validate(userSchemas.resendVerification), async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findByEmail(email);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const newCode = String(Math.floor(100000 + Math.random() * 900000));
    const newToken = generateRandomString(32);
    user.emailVerificationCode = newCode;
    user.emailVerificationToken = newToken;
    user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();
    const verificationUrl = `${require('../config/config').cors.origin}/verify-email?token=${newToken}`;
    await sendEmailVerification(user, verificationUrl);
    res.json({ success: true, message: 'Verification OTP sent' });
  } catch (err) { next(err); }
});

// Protected routes
router.get('/me', authenticate, getMe);
router.post('/logout', authenticate, logout);

module.exports = router;
