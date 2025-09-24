const express = require('express');
const { authenticate, requireAdmin, requireOwnershipOrAdmin } = require('../middleware/auth');
const { validate, userSchemas } = require('../middleware/validation');
const { uploadAvatar } = require('../middleware/upload');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get user profile
router.get('/profile', (req, res) => {
  res.json({
    success: true,
    data: { user: req.user }
  });
});

// Update user profile
router.put('/profile', validate(userSchemas.updateProfile), (req, res) => {
  // Implementation for updating user profile
  res.json({
    success: true,
    message: 'Profile updated successfully'
  });
});

// Upload avatar
router.post('/avatar', uploadAvatar, (req, res) => {
  // Implementation for avatar upload
  res.json({
    success: true,
    message: 'Avatar uploaded successfully'
  });
});

// Change password
router.put('/change-password', validate(userSchemas.changePassword), (req, res) => {
  // Implementation for password change
  res.json({
    success: true,
    message: 'Password changed successfully'
  });
});

// Admin routes
router.get('/', requireAdmin, (req, res) => {
  // Implementation for getting all users
  res.json({
    success: true,
    data: { users: [] }
  });
});

router.put('/:id/role', requireAdmin, validate(userSchemas.updateUserRole), (req, res) => {
  // Implementation for updating user role
  res.json({
    success: true,
    message: 'User role updated successfully'
  });
});

module.exports = router;
