const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { asyncHandler } = require('../middleware/errorHandler');
const { sendWelcomeEmail, sendEmailVerification, sendPasswordResetEmail } = require('../utils/email');
const { generateRandomString } = require('../utils/helpers');
const logger = require('../utils/logger');
const config = require('../config/config');

/**
 * @desc    Register user
 * @route   POST /api/auth/register
 * @access  Public
 */
const register = asyncHandler(async (req, res) => {
  const { name, email, password, department, bio } = req.body;

  // Check if user already exists
  const existingUser = await User.findByEmail(email);
  if (existingUser) {
    return res.status(400).json({
      success: false,
      message: 'User already exists with this email'
    });
  }

  // Create user
  const user = await User.create({
    name,
    email,
    password,
    department,
    bio
  });

  // Generate email verification token and OTP code
  const verificationToken = generateRandomString(32);
  const verificationCode = String(Math.floor(100000 + Math.random() * 900000));
  user.emailVerificationToken = verificationToken;
  user.emailVerificationCode = verificationCode;
  user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  await user.save();

  // Send welcome email
  try {
    await sendWelcomeEmail(user);
  } catch (error) {
    logger.error('Failed to send welcome email:', error);
  }

  // Send email verification
  try {
    const verificationUrl = `${config.cors.origin}/verify-email?token=${verificationToken}`;
    await sendEmailVerification(user, verificationUrl);
  } catch (error) {
    logger.error('Failed to send verification email:', error);
  }

  // Generate tokens
  const token = user.generateAuthToken();
  const refreshToken = user.generateRefreshToken();

  logger.logUserAction(user._id, 'user_registered', { email: user.email });

  res.status(201).json({
    success: true,
    message: 'User registered successfully. Please check your email for verification.',
    data: {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        department: user.department,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        gamification: {
          points: user.gamification.points,
          level: user.gamification.level
        }
      },
      token,
      refreshToken
    }
  });
});

/**
 * @desc    Login user
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Find user and include password
  const user = await User.findByEmail(email).select('+password');
  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Invalid email or password'
    });
  }

  // Check if user is active
  if (!user.isActive) {
    return res.status(401).json({
      success: false,
      message: 'Account is deactivated'
    });
  }

  // Enforce email verification before login
  if (!user.isEmailVerified) {
    return res.status(401).json({
      success: false,
      message: 'Email not verified. Please complete OTP verification sent to your email.'
    });
  }

  // Check password
  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    return res.status(401).json({
      success: false,
      message: 'Invalid email or password'
    });
  }

  // Update last login
  await user.updateLastLogin();

  // Generate tokens
  const token = user.generateAuthToken();
  const refreshToken = user.generateRefreshToken();

  logger.logUserAction(user._id, 'user_login', { email: user.email });

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        department: user.department,
        role: user.role,
        avatar: user.avatar,
        isEmailVerified: user.isEmailVerified,
        gamification: {
          points: user.gamification.points,
          level: user.gamification.level
        }
      },
      token,
      refreshToken
    }
  });
});

/**
 * @desc    Refresh token
 * @route   POST /api/auth/refresh
 * @access  Public
 */
const refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(401).json({
      success: false,
      message: 'Refresh token is required'
    });
  }

  try {
    const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret);
    const user = await User.findById(decoded.id);

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }

    // Generate new tokens
    const newToken = user.generateAuthToken();
    const newRefreshToken = user.generateRefreshToken();

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        token: newToken,
        refreshToken: newRefreshToken
      }
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid refresh token'
    });
  }
});

/**
 * @desc    Logout user
 * @route   POST /api/auth/logout
 * @access  Private
 */
const logout = asyncHandler(async (req, res) => {
  logger.logUserAction(req.user._id, 'user_logout', { email: req.user.email });

  res.json({
    success: true,
    message: 'Logout successful'
  });
});

/**
 * @desc    Forgot password
 * @route   POST /api/auth/forgot-password
 * @access  Public
 */
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const user = await User.findByEmail(email);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found with this email'
    });
  }

  // Generate reset token
  const resetToken = generateRandomString(32);
  user.passwordResetToken = resetToken;
  user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  await user.save();

  // Send reset email
  try {
    const resetUrl = `${config.cors.origin}/reset-password?token=${resetToken}`;
    await sendPasswordResetEmail(user, resetUrl);
  } catch (error) {
    logger.error('Failed to send password reset email:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send reset email'
    });
  }

  logger.logUserAction(user._id, 'password_reset_requested', { email: user.email });

  res.json({
    success: true,
    message: 'Password reset email sent'
  });
});

/**
 * @desc    Reset password
 * @route   POST /api/auth/reset-password
 * @access  Public
 */
const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;

  const user = await User.findOne({
    passwordResetToken: token,
    passwordResetExpires: { $gt: Date.now() }
  });

  if (!user) {
    return res.status(400).json({
      success: false,
      message: 'Invalid or expired reset token'
    });
  }

  // Update password
  user.password = password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  logger.logUserAction(user._id, 'password_reset_completed', { email: user.email });

  res.json({
    success: true,
    message: 'Password reset successful'
  });
});

/**
 * @desc    Verify email
 * @route   POST /api/auth/verify-email
 * @access  Public
 */
const verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.body;

  const user = await User.findOne({
    emailVerificationToken: token,
    emailVerificationExpires: { $gt: Date.now() }
  });

  if (!user) {
    return res.status(400).json({
      success: false,
      message: 'Invalid or expired verification token'
    });
  }

  // Verify email
  user.isEmailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  await user.save();

  logger.logUserAction(user._id, 'email_verified', { email: user.email });

  res.json({
    success: true,
    message: 'Email verified successfully'
  });
});

/**
 * @desc    Resend verification email
 * @route   POST /api/auth/resend-verification
 * @access  Public
 */
const resendVerification = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const user = await User.findByEmail(email);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found with this email'
    });
  }

  if (user.isEmailVerified) {
    return res.status(400).json({
      success: false,
      message: 'Email is already verified'
    });
  }

  // Generate new verification token
  const verificationToken = generateRandomString(32);
  user.emailVerificationToken = verificationToken;
  user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  await user.save();

  // Send verification email
  try {
    const verificationUrl = `${config.cors.origin}/verify-email?token=${verificationToken}`;
    await sendEmailVerification(user, verificationUrl);
  } catch (error) {
    logger.error('Failed to send verification email:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send verification email'
    });
  }

  logger.logUserAction(user._id, 'verification_email_resent', { email: user.email });

  res.json({
    success: true,
    message: 'Verification email sent'
  });
});

/**
 * @desc    Get current user
 * @route   GET /api/auth/me
 * @access  Private
 */
const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
    .populate('gamification.achievements.achievement')
    .populate('gamification.badges');

  res.json({
    success: true,
    data: {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        department: user.department,
        role: user.role,
        avatar: user.avatar,
        bio: user.bio,
        isEmailVerified: user.isEmailVerified,
        lastLogin: user.lastLogin,
        gamification: {
          points: user.gamification.points,
          level: user.gamification.level,
          badges: user.gamification.badges,
          achievements: user.gamification.achievements
        },
        preferences: user.preferences,
        socialLinks: user.socialLinks,
        createdAt: user.createdAt
      }
    }
  });
});

module.exports = {
  register,
  login,
  refreshToken,
  logout,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerification,
  getMe
};
