const mongoose = require('mongoose');

const attendeeSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['attending', 'maybe', 'not_attending'],
    default: 'attending'
  },
  registeredAt: {
    type: Date,
    default: Date.now
  },
  checkedIn: {
    type: Boolean,
    default: false
  },
  checkedInAt: Date
});

const eventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Event title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Event description is required'],
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  organizer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: [
      'workshop',
      'seminar',
      'meeting',
      'training',
      'conference',
      'social',
      'team-building',
      'presentation',
      'webinar',
      'other'
    ]
  },
  type: {
    type: String,
    enum: ['online', 'offline', 'hybrid'],
    default: 'offline'
  },
  location: {
    name: String,
    address: String,
    city: String,
    state: String,
    country: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  onlineDetails: {
    platform: String, // Zoom, Teams, Google Meet, etc.
    meetingLink: String,
    meetingId: String,
    password: String
  },
  startDate: {
    type: Date,
    required: [true, 'Start date is required']
  },
  endDate: {
    type: Date,
    required: [true, 'End date is required']
  },
  timezone: {
    type: String,
    default: 'UTC'
  },
  capacity: {
    type: Number,
    min: [1, 'Capacity must be at least 1'],
    default: null // null means unlimited
  },
  attendees: [attendeeSchema],
  waitlist: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  status: {
    type: String,
    enum: ['draft', 'published', 'cancelled', 'completed'],
    default: 'draft'
  },
  visibility: {
    type: String,
    enum: ['public', 'private', 'invite-only'],
    default: 'public'
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: [30, 'Tag cannot exceed 30 characters']
  }],
  requirements: [{
    type: String,
    trim: true
  }],
  agenda: [{
    time: String,
    title: String,
    description: String,
    speaker: String
  }],
  resources: [{
    title: String,
    description: String,
    url: String,
    type: {
      type: String,
      enum: ['document', 'video', 'link', 'other']
    }
  }],
  images: [{
    filename: String,
    originalName: String,
    url: String,
    isPrimary: {
      type: Boolean,
      default: false
    }
  }],
  registrationDeadline: Date,
  allowWaitlist: {
    type: Boolean,
    default: true
  },
  requiresApproval: {
    type: Boolean,
    default: false
  },
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurringPattern: {
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'yearly']
    },
    interval: Number,
    endDate: Date,
    daysOfWeek: [Number], // 0-6 (Sunday-Saturday)
    dayOfMonth: Number
  },
  feedback: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    comment: String,
    submittedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
eventSchema.index({ startDate: 1 });
eventSchema.index({ organizer: 1 });
eventSchema.index({ category: 1 });
eventSchema.index({ status: 1 });
eventSchema.index({ visibility: 1 });
eventSchema.index({ 'location.city': 1 });
eventSchema.index({ title: 'text', description: 'text' });

// Virtual for attendee count
eventSchema.virtual('attendeeCount').get(function() {
  return this.attendees.filter(attendee => attendee.status === 'attending').length;
});

// Virtual for waitlist count
eventSchema.virtual('waitlistCount').get(function() {
  return this.waitlist.length;
});

// Virtual for is full
eventSchema.virtual('isFull').get(function() {
  return this.capacity && this.attendeeCount >= this.capacity;
});

// Virtual for is past
eventSchema.virtual('isPast').get(function() {
  return new Date() > this.endDate;
});

// Virtual for is upcoming
eventSchema.virtual('isUpcoming').get(function() {
  return new Date() < this.startDate;
});

// Virtual for is ongoing
eventSchema.virtual('isOngoing').get(function() {
  const now = new Date();
  return now >= this.startDate && now <= this.endDate;
});

// Virtual for average rating
eventSchema.virtual('averageRating').get(function() {
  if (this.feedback.length === 0) return 0;
  const sum = this.feedback.reduce((acc, fb) => acc + fb.rating, 0);
  return sum / this.feedback.length;
});

// Pre-save middleware to validate dates
eventSchema.pre('save', function(next) {
  if (this.endDate <= this.startDate) {
    next(new Error('End date must be after start date'));
  }
  next();
});

// Method to register for event
eventSchema.methods.registerUser = function(userId, status = 'attending') {
  // Check if user is already registered
  const existingAttendee = this.attendees.find(
    attendee => attendee.user.toString() === userId.toString()
  );
  
  if (existingAttendee) {
    existingAttendee.status = status;
  } else {
    // Check capacity
    if (this.isFull && status === 'attending') {
      if (this.allowWaitlist) {
        this.waitlist.push(userId);
      } else {
        throw new Error('Event is full and waitlist is not available');
      }
    } else {
      this.attendees.push({
        user: userId,
        status: status,
        registeredAt: new Date()
      });
    }
  }
  
  return this.save();
};

// Method to unregister from event
eventSchema.methods.unregisterUser = function(userId) {
  // Remove from attendees
  this.attendees = this.attendees.filter(
    attendee => attendee.user.toString() !== userId.toString()
  );
  
  // Remove from waitlist
  this.waitlist = this.waitlist.filter(
    id => id.toString() !== userId.toString()
  );
  
  return this.save();
};

// Method to check in user
eventSchema.methods.checkInUser = function(userId) {
  const attendee = this.attendees.find(
    attendee => attendee.user.toString() === userId.toString()
  );
  
  if (attendee) {
    attendee.checkedIn = true;
    attendee.checkedInAt = new Date();
  }
  
  return this.save();
};

// Method to add feedback
eventSchema.methods.addFeedback = function(userId, rating, comment) {
  // Remove existing feedback from user
  this.feedback = this.feedback.filter(
    fb => fb.user.toString() !== userId.toString()
  );
  
  // Add new feedback
  this.feedback.push({
    user: userId,
    rating: rating,
    comment: comment,
    submittedAt: new Date()
  });
  
  return this.save();
};

// Static method to get upcoming events
eventSchema.statics.getUpcoming = function(limit = 10) {
  return this.find({
    startDate: { $gt: new Date() },
    status: 'published'
  })
    .populate('organizer', 'name email avatar department')
    .sort({ startDate: 1 })
    .limit(limit);
};

// Static method to get events by category
eventSchema.statics.getByCategory = function(category, page = 1, limit = 10) {
  const skip = (page - 1) * limit;
  return this.find({ category, status: 'published' })
    .populate('organizer', 'name email avatar department')
    .sort({ startDate: 1 })
    .skip(skip)
    .limit(limit);
};

// Static method to search events
eventSchema.statics.search = function(query, page = 1, limit = 10) {
  const skip = (page - 1) * limit;
  return this.find({
    $text: { $search: query },
    status: 'published'
  })
    .populate('organizer', 'name email avatar department')
    .sort({ score: { $meta: 'textScore' }, startDate: 1 })
    .skip(skip)
    .limit(limit);
};

// Static method to get events by location
eventSchema.statics.getByLocation = function(city, page = 1, limit = 10) {
  const skip = (page - 1) * limit;
  return this.find({
    'location.city': new RegExp(city, 'i'),
    status: 'published'
  })
    .populate('organizer', 'name email avatar department')
    .sort({ startDate: 1 })
    .skip(skip)
    .limit(limit);
};

module.exports = mongoose.model('Event', eventSchema);
