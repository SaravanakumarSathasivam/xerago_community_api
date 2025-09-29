const DropdownOption = require('../models/DropdownOption');
const { validationResult } = require('express-validator');

/**
 * Get all dropdown options by category
 * @route GET /api/dropdowns/:category
 * @access Public
 */
const getDropdownOptions = async (req, res) => {
  try {
    const { category } = req.params;
    
    if (!category) {
      return res.status(400).json({
        success: false,
        message: 'Category parameter is required'
      });
    }

    const options = await DropdownOption.getByCategory(category);
    
    res.json({
      success: true,
      data: options,
      count: options.length
    });
  } catch (error) {
    console.error('Error fetching dropdown options:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get all available dropdown categories
 * @route GET /api/dropdowns/categories
 * @access Public
 */
const getDropdownCategories = async (req, res) => {
  try {
    const categories = await DropdownOption.getCategories();
    
    res.json({
      success: true,
      data: categories,
      count: categories.length
    });
  } catch (error) {
    console.error('Error fetching dropdown categories:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get multiple dropdown options by categories
 * @route POST /api/dropdowns/batch
 * @access Public
 */
const getBatchDropdownOptions = async (req, res) => {
  try {
    const { categories } = req.body;
    
    if (!categories || !Array.isArray(categories)) {
      return res.status(400).json({
        success: false,
        message: 'Categories array is required'
      });
    }

    const results = {};
    
    for (const category of categories) {
      const options = await DropdownOption.getByCategory(category);
      results[category] = options;
    }
    
    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('Error fetching batch dropdown options:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Create a new dropdown option
 * @route POST /api/dropdowns
 * @access Admin
 */
const createDropdownOption = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { category, value, label, description, order, metadata } = req.body;
    
    // Check if option already exists
    const existingOption = await DropdownOption.findOne({ category, value });
    if (existingOption) {
      return res.status(409).json({
        success: false,
        message: 'Dropdown option already exists'
      });
    }

    const dropdownOption = new DropdownOption({
      category,
      value,
      label,
      description,
      order,
      metadata
    });

    await dropdownOption.save();
    
    res.status(201).json({
      success: true,
      message: 'Dropdown option created successfully',
      data: dropdownOption
    });
  } catch (error) {
    console.error('Error creating dropdown option:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Update a dropdown option
 * @route PUT /api/dropdowns/:id
 * @access Admin
 */
const updateDropdownOption = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const updateData = req.body;
    
    const dropdownOption = await DropdownOption.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!dropdownOption) {
      return res.status(404).json({
        success: false,
        message: 'Dropdown option not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Dropdown option updated successfully',
      data: dropdownOption
    });
  } catch (error) {
    console.error('Error updating dropdown option:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Delete a dropdown option
 * @route DELETE /api/dropdowns/:id
 * @access Admin
 */
const deleteDropdownOption = async (req, res) => {
  try {
    const { id } = req.params;
    
    const dropdownOption = await DropdownOption.findByIdAndDelete(id);
    
    if (!dropdownOption) {
      return res.status(404).json({
        success: false,
        message: 'Dropdown option not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Dropdown option deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting dropdown option:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Seed default dropdown options
 * @route POST /api/dropdowns/seed
 * @access Admin
 */
const seedDropdownOptions = async (req, res) => {
  try {
    await DropdownOption.seedDefaultOptions();
    
    res.json({
      success: true,
      message: 'Default dropdown options seeded successfully'
    });
  } catch (error) {
    console.error('Error seeding dropdown options:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  getDropdownOptions,
  getDropdownCategories,
  getBatchDropdownOptions,
  createDropdownOption,
  updateDropdownOption,
  deleteDropdownOption,
  seedDropdownOptions
};
