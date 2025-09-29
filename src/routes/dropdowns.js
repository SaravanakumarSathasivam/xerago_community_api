const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  getDropdownOptions,
  getDropdownCategories,
  getBatchDropdownOptions,
  createDropdownOption,
  updateDropdownOption,
  deleteDropdownOption,
  seedDropdownOptions
} = require('../controllers/dropdownController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Validation middleware
const validateDropdownOption = [
  body('category')
    .notEmpty()
    .withMessage('Category is required')
    .isLength({ min: 1, max: 50 })
    .withMessage('Category must be between 1 and 50 characters'),
  body('value')
    .notEmpty()
    .withMessage('Value is required')
    .isLength({ min: 1, max: 50 })
    .withMessage('Value must be between 1 and 50 characters'),
  body('label')
    .notEmpty()
    .withMessage('Label is required')
    .isLength({ min: 1, max: 100 })
    .withMessage('Label must be between 1 and 100 characters'),
  body('description')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Description cannot exceed 200 characters'),
  body('order')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Order must be a non-negative integer'),
  body('metadata')
    .optional()
    .isObject()
    .withMessage('Metadata must be an object')
];

const validateBatchRequest = [
  body('categories')
    .isArray({ min: 1 })
    .withMessage('Categories must be a non-empty array'),
  body('categories.*')
    .isString()
    .withMessage('Each category must be a string')
];

// Public routes
router.get('/categories', getDropdownCategories);
router.get('/:category', getDropdownOptions);
router.post('/batch', validateBatchRequest, getBatchDropdownOptions);

// Admin routes
// router.post('/', authenticateToken, requireAdmin, validateDropdownOption, createDropdownOption);
// router.put('/:id', authenticateToken, requireAdmin, validateDropdownOption, updateDropdownOption);
// router.delete('/:id', authenticateToken, requireAdmin, deleteDropdownOption);
// router.post('/seed', authenticateToken, requireAdmin, seedDropdownOptions);

module.exports = router;
