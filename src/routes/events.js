const express = require("express");
const { authenticate, optionalAuth } = require("../middleware/auth");
const { searchLimiter, createUserLimiter } = require('../middleware/rateLimiter');
const {
  validate,
  eventSchemas,
  frontendSchemas,
} = require("../middleware/validation");
const { uploadEventImages } = require("../middleware/upload");
const Event = require("../models/Event");

const router = express.Router();

// Helper: map Event model -> frontend shape matching IEvent interface
const mapEventToFrontend = (eventDoc, currentUserId) => {
  const isRegistered = currentUserId
    ? eventDoc.attendees.some(
        (a) => {
          const userId = a.user?._id?.toString() || a.user?.toString();
          return userId === currentUserId.toString();
        }
      )
    : false;

  // Map attendees with full user details
  const mappedAttendees = (eventDoc.attendees || []).map((attendee) => {
    const user = attendee.user?._doc || attendee.user || {};
    return {
      _id: attendee._id?.toString() || attendee.user?._id?.toString() || attendee.user?.toString(),
      user: attendee.user?._id?.toString() || attendee.user?.toString(),
      status: attendee.status || 'attending',
      registeredAt: attendee.registeredAt || attendee.createdAt,
      checkedIn: attendee.checkedIn || false,
      checkedInAt: attendee.checkedInAt,
      name: user.name || 'Unknown',
      email: user.email || '',
      avatar: user.avatar || '',
    };
  });

  // Map location
  const mappedLocation = eventDoc.location ? {
    name: eventDoc.location.name,
    address: eventDoc.location.address,
    city: eventDoc.location.city,
    state: eventDoc.location.state,
    country: eventDoc.location.country,
    coordinates: eventDoc.location.coordinates ? {
      latitude: eventDoc.location.coordinates.latitude,
      longitude: eventDoc.location.coordinates.longitude,
    } : undefined,
  } : undefined;

  // Map online details
  const mappedOnlineDetails = eventDoc.onlineDetails ? {
    platform: eventDoc.onlineDetails.platform,
    meetingLink: eventDoc.onlineDetails.meetingLink,
    meetingId: eventDoc.onlineDetails.meetingId,
    password: eventDoc.onlineDetails.password,
  } : undefined;

  // Map agenda
  const mappedAgenda = (eventDoc.agenda || []).map((item) => ({
    time: item.time,
    title: item.title,
    description: item.description,
    speaker: item.speaker,
  }));

  // Map resources
  const mappedResources = (eventDoc.resources || []).map((resource) => ({
    title: resource.title,
    description: resource.description,
    url: resource.url,
    type: resource.type,
  }));

  // Map images
  const mappedImages = (eventDoc.images || []).map((img) => ({
    filename: img.filename,
    originalName: img.originalName,
    url: img.url,
    isPrimary: img.isPrimary || false,
  }));

  // Map recurring pattern
  const mappedRecurringPattern = eventDoc.recurringPattern ? {
    frequency: eventDoc.recurringPattern.frequency,
    interval: eventDoc.recurringPattern.interval,
    endDate: eventDoc.recurringPattern.endDate,
    daysOfWeek: eventDoc.recurringPattern.daysOfWeek,
    dayOfMonth: eventDoc.recurringPattern.dayOfMonth,
  } : undefined;

  // Map feedback
  const mappedFeedback = (eventDoc.feedback || []).map((fb) => {
    const user = fb.user?._doc || fb.user || {};
    return {
      user: fb.user?._id?.toString() || fb.user?.toString(),
      rating: fb.rating,
      comment: fb.comment,
      submittedAt: fb.submittedAt || fb.createdAt,
    };
  });

  // Map organizer
  const organizer = eventDoc.organizer?._doc || eventDoc.organizer || {};
  const mappedOrganizer = {
    _id: organizer._id?.toString() || eventDoc.organizer?.toString(),
    name: organizer.name || 'Unknown',
    email: organizer.email || '',
    avatar: organizer.avatar || '',
    department: organizer.department || 'General',
  };

  // Map backend fields back to frontend format:
  // - Backend "category" (workshop, lunch-learn, etc.) -> Frontend "category" (event type)
  // - First tag that matches frontend category values (ai-innovation, etc.) -> stored in tags, not returned as category
  // - Backend "type" (online/offline/hybrid) -> Frontend "type"
  // Note: Frontend sends "type" as event type and "category" as event category, but IEvent interface expects:
  //   category = event type (workshop, etc.)
  //   type = online/offline/hybrid
  // So we map: backend.category -> frontend.category, backend.type -> frontend.type

  return {
    _id: eventDoc._id.toString(),
    id: eventDoc._id.toString(),
    title: eventDoc.title,
    description: eventDoc.description,
    organizer: mappedOrganizer,
    category: eventDoc.category, // Event type (workshop, lunch-learn, etc.) - matches IEvent interface
    type: eventDoc.type || 'offline', // Event format (online/offline/hybrid) - matches IEvent interface
    location: mappedLocation,
    onlineDetails: mappedOnlineDetails,
    startDate: eventDoc.startDate ? eventDoc.startDate.toISOString() : null,
    endDate: eventDoc.endDate ? eventDoc.endDate.toISOString() : null,
    timezone: eventDoc.timezone,
    capacity: eventDoc.capacity,
    attendees: mappedAttendees,
    waitlist: (eventDoc.waitlist || []).map((w) => w._id?.toString() || w.toString()),
    status: eventDoc.status || 'draft',
    visibility: eventDoc.visibility || 'public',
    tags: eventDoc.tags || [],
    requirements: eventDoc.requirements || [],
    agenda: mappedAgenda,
    resources: mappedResources,
    images: mappedImages,
    registrationDeadline: eventDoc.registrationDeadline,
    allowWaitlist: eventDoc.allowWaitlist !== undefined ? eventDoc.allowWaitlist : true,
    requiresApproval: eventDoc.requiresApproval || false,
    isRecurring: eventDoc.isRecurring || false,
    recurringPattern: mappedRecurringPattern,
    feedback: mappedFeedback,
    createdAt: eventDoc.createdAt,
    updatedAt: eventDoc.updatedAt,
    // Legacy fields for backward compatibility
    date: eventDoc.startDate ? eventDoc.startDate.toISOString() : null,
    maxAttendees: eventDoc.capacity || 0,
    isRegistered,
  };
};

// Get events (public)
router.get(
  "/",
  searchLimiter,
  optionalAuth,
  validate(eventSchemas.getEvents, "query"),
  async (req, res, next) => {
    try {
      const { sort, order = 'asc', category, search, status } = req.query;
      const match = {};
      if (category && category !== 'all') match.tags = { $in: [category] };
      if (status && ['upcoming','ongoing','completed'].includes(String(status))) {
        // status is derived on frontend; approximate using dates
        const now = new Date();
        if (status === 'upcoming') match.startDate = { $gt: now };
        if (status === 'ongoing') match.$and = [{ startDate: { $lte: now } }, { endDate: { $gte: now } }];
        if (status === 'completed') match.endDate = { $lt: now };
      }
      if (search) {
        match.$or = [
          { title: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { tags: { $in: [new RegExp(search, 'i')] } },
        ];
      }

      const normalized = String(sort || '').toLowerCase();

      const pipeline = [
        { $match: match },
        { $addFields: { attendeesCount: { $size: { $ifNull: ['$attendees', []] } } } },
      ];

      // Apply filter behavior based on sort option
      switch (normalized) {
        case 'date': // upcoming only
          pipeline.push({ $match: { startDate: { $gte: new Date() } } });
          break;
        case 'popular':
          pipeline.push({ $match: { attendeesCount: { $gt: 0 } } });
          break;
        case 'recent':
          pipeline.push({ $match: { createdAt: { $gte: new Date(Date.now() - 7*24*60*60*1000) } } });
          break;
        default:
          break;
      }

      // Default ordering after filter
      pipeline.push({ $sort: { startDate: 1 } });

      const rows = await Event.aggregate(pipeline);
      const ids = rows.map((r) => r._id);
      const docs = await Event.find({ _id: { $in: ids } })
        .populate("organizer", "name email avatar department")
        .populate("attendees.user", "name email avatar department")
        .populate("waitlist", "name email avatar department")
        .populate("feedback.user", "name email avatar");
      const byId = new Map(docs.map((d) => [String(d._id), d]));
      const ordered = ids.map((id) => byId.get(String(id))).filter(Boolean);
      const mapped = ordered.map((e) => mapEventToFrontend(e, req.user?._id));
      res.json({ success: true, data: { events: mapped } });
    } catch (err) {
      next(err);
    }
  }
);

// Get specific event (public)
router.get("/:id", searchLimiter, optionalAuth, async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate("organizer", "name email avatar department")
      .populate("attendees.user", "name email avatar department")
      .populate("waitlist", "name email avatar department")
      .populate("feedback.user", "name email avatar");
    if (!event) {
      return res
        .status(404)
        .json({ success: false, message: "Event not found" });
    }
    res.json({
      success: true,
      data: { event: mapEventToFrontend(event, req.user?._id) },
    });
  } catch (err) {
    next(err);
  }
});

// Get upcoming events (public)
router.get("/upcoming", searchLimiter, optionalAuth, async (req, res, next) => {
  try {
    const events = await Event.getUpcoming(20);
    // Populate additional fields for upcoming events
    await Event.populate(events, [
      { path: "organizer", select: "name email avatar department" },
      { path: "attendees.user", select: "name email avatar department" },
      { path: "waitlist", select: "name email avatar department" },
    ]);
    const mapped = events.map((e) => mapEventToFrontend(e, req.user?._id));
    res.json({ success: true, data: { events: mapped } });
  } catch (err) {
    next(err);
  }
});

// All routes below require authentication
router.use(authenticate);

// Create event
router.post(
  "/",
  createUserLimiter(60 * 1000, 10, 'Too many events created, please try again later.'),
  uploadEventImages,
  validate(frontendSchemas.createEvent),
  async (req, res, next) => {
    try {
      // Frontend may send simplified fields or full IEvent structure
      const {
        title,
        description,
        date,
        startDate,
        endDate,
        location, // can be string or ILocation object
        type, // 'online' | 'offline' | 'hybrid'
        category, // enum from frontend
        maxAttendees,
        capacity,
        tags,
        timezone,
        onlineDetails,
        agenda,
        resources,
        registrationDeadline,
        allowWaitlist,
        requiresApproval,
        isRecurring,
        recurringPattern,
        visibility,
        status,
      } = req.body;

      // Normalize tags array
      let normalizedTags = [];
      if (Array.isArray(tags)) {
        normalizedTags = tags.map((t) => String(t).trim()).filter(Boolean);
      } else if (typeof tags === "string") {
        try {
          const parsed = JSON.parse(tags);
          normalizedTags = Array.isArray(parsed)
            ? parsed.map((t) => String(t).trim()).filter(Boolean)
            : tags.split(",").map((t) => t.trim()).filter(Boolean);
        } catch {
          normalizedTags = tags.split(",").map((t) => t.trim()).filter(Boolean);
        }
      }

      // Map uploaded files to images array
      const images = (req.files || []).map((file, idx) => ({
        filename: file.filename,
        originalName: file.originalname,
        url: file.url || `/uploads/${file.path.replace(/\\/g, '/').split('uploads/')[1]}`,
        isPrimary: idx === 0,
      }));

      // Normalize location (can be string or object)
      let locationObj = undefined;
      if (location) {
        if (typeof location === 'string') {
          locationObj = { name: location };
        } else if (typeof location === 'object') {
          locationObj = {
            name: location.name,
            address: location.address,
            city: location.city,
            state: location.state,
            country: location.country,
            coordinates: location.coordinates,
          };
        }
      }

      // Map frontend fields to backend:
      // - Frontend "type" (workshop, lunch-learn, etc.) -> backend "category"
      // - Frontend "category" (ai-innovation, analytics, etc.) -> backend "tags" (prepend to tags)
      // - Backend "type" (online/offline/hybrid) defaults to 'offline' or can be inferred from location
      
      // Determine backend type based on location (if it's a URL, assume online)
      let backendType = 'offline';
      if (location && (typeof location === 'string' && (location.startsWith('http') || location.toLowerCase().includes('zoom') || location.toLowerCase().includes('meet') || location.toLowerCase().includes('teams'))) || 
          (typeof location === 'object' && location.meetingLink)) {
        backendType = 'online';
      }

      // Prepend frontend category to tags if provided
      const finalTags = category && !normalizedTags.includes(category) 
        ? [category, ...normalizedTags] 
        : normalizedTags;

      // Map to Event model fields
      const eventData = {
        title,
        description,
        organizer: req.user._id,
        category: type || 'workshop', // Frontend "type" maps to backend "category"
        type: backendType, // Backend "type" is online/offline/hybrid
        startDate: new Date(startDate || date || new Date()),
        endDate: new Date(endDate || date || new Date()),
        capacity: capacity !== undefined ? (Number.isFinite(Number(capacity)) ? Number(capacity) : null) : (Number.isFinite(Number(maxAttendees)) ? Number(maxAttendees) : null),
        tags: finalTags, // Frontend "category" goes into tags
        status: status || 'published',
        visibility: visibility || 'public',
        images,
      };

      // Add optional fields if provided
      if (locationObj) eventData.location = locationObj;
      if (timezone) eventData.timezone = timezone;
      if (onlineDetails) eventData.onlineDetails = onlineDetails;
      if (agenda && Array.isArray(agenda)) eventData.agenda = agenda;
      if (resources && Array.isArray(resources)) eventData.resources = resources;
      if (registrationDeadline) eventData.registrationDeadline = new Date(registrationDeadline);
      if (allowWaitlist !== undefined) eventData.allowWaitlist = allowWaitlist;
      if (requiresApproval !== undefined) eventData.requiresApproval = requiresApproval;
      if (isRecurring !== undefined) eventData.isRecurring = isRecurring;
      if (recurringPattern) eventData.recurringPattern = recurringPattern;

      const event = await Event.create(eventData);

      // Auto-register creator
      await event.registerUser(req.user._id, "attending");

      const created = await Event.findById(event._id)
        .populate("organizer", "name email avatar department")
        .populate("attendees.user", "name email avatar department");
      res
        .status(201)
        .json({
          success: true,
          data: { event: mapEventToFrontend(created, req.user._id) },
        });
    } catch (err) {
      next(err);
    }
  }
);

// Update event
router.put(
  "/:id",
  validate(frontendSchemas.updateEvent),
  async (req, res, next) => {
    try {
      const existing = await Event.findById(req.params.id).populate('organizer', 'name email avatar department');
      if (!existing) {
        return res
          .status(404)
          .json({ success: false, message: "Event not found" });
      }

      // Enforce edit window: only editable before 24 hours of start time
      const now = new Date();
      const start = new Date(existing.startDate);
      const ms24h = 24 * 60 * 60 * 1000;
      const isWithin24h = start.getTime() - now.getTime() < ms24h;
      if (isWithin24h) {
        return res.status(400).json({ success: false, message: 'Event can no longer be edited within 24 hours of start time' });
      }

      const {
        title,
        description,
        date,
        startDate,
        endDate,
        location,
        maxAttendees,
        capacity,
        tags,
        status,
        category,
        type,
        timezone,
        onlineDetails,
        agenda,
        resources,
        registrationDeadline,
        allowWaitlist,
        requiresApproval,
        isRecurring,
        recurringPattern,
        visibility,
      } = req.body;

      const updates = {};
      if (title !== undefined) updates.title = title;
      if (description !== undefined) updates.description = description;
      if (date) updates.startDate = new Date(date);
      if (startDate) updates.startDate = new Date(startDate);
      if (endDate) updates.endDate = new Date(endDate);
      
      // Map frontend fields to backend:
      // - Frontend "type" (workshop, lunch-learn, etc.) -> backend "category"
      // - Frontend "category" (ai-innovation, analytics, etc.) -> backend "tags" (prepend to tags)
      if (type) {
        // Frontend "type" maps to backend "category"
        updates.category = type;
      }
      // Backend "type" (online/offline/hybrid) - infer from location if not provided
      if (location) {
        const isOnline = (typeof location === 'string' && (location.startsWith('http') || location.toLowerCase().includes('zoom') || location.toLowerCase().includes('meet') || location.toLowerCase().includes('teams'))) ||
                        (typeof location === 'object' && location.meetingLink);
        if (isOnline) {
          updates.type = 'online';
        } else if (!updates.type) {
          updates.type = 'offline';
        }
      }
      if (timezone) updates.timezone = timezone;
      if (typeof status === "string") updates.status = status;
      if (typeof visibility === "string") updates.visibility = visibility;
      if (allowWaitlist !== undefined) updates.allowWaitlist = allowWaitlist;
      if (requiresApproval !== undefined) updates.requiresApproval = requiresApproval;
      if (isRecurring !== undefined) updates.isRecurring = isRecurring;
      if (recurringPattern) updates.recurringPattern = recurringPattern;
      if (registrationDeadline) updates.registrationDeadline = new Date(registrationDeadline);
      if (onlineDetails) updates.onlineDetails = onlineDetails;
      if (agenda && Array.isArray(agenda)) updates.agenda = agenda;
      if (resources && Array.isArray(resources)) updates.resources = resources;

      // Handle location (can be string or object)
      if (location !== undefined) {
        if (typeof location === 'string') {
          updates.location = { name: location };
        } else if (typeof location === 'object') {
          updates.location = {
            name: location.name,
            address: location.address,
            city: location.city,
            state: location.state,
            country: location.country,
            coordinates: location.coordinates,
          };
        }
      }

      // Handle capacity/maxAttendees
      if (capacity !== undefined) {
        updates.capacity = Number.isFinite(Number(capacity)) ? Number(capacity) : null;
      } else if (maxAttendees !== undefined) {
        updates.capacity = Number.isFinite(Number(maxAttendees)) ? Number(maxAttendees) : null;
      }

      // Handle tags - prepend frontend category if provided
      if (tags !== undefined || category !== undefined) {
        let tagArray = [];
        
        // Parse existing tags
        if (tags !== undefined) {
          if (Array.isArray(tags)) {
            tagArray = tags.map((t) => String(t).trim()).filter(Boolean);
          } else if (typeof tags === "string") {
            try {
              const parsed = JSON.parse(tags);
              tagArray = Array.isArray(parsed)
                ? parsed.map((t) => String(t).trim()).filter(Boolean)
                : tags.split(",").map((t) => t.trim()).filter(Boolean);
            } catch {
              tagArray = tags.split(",").map((t) => t.trim()).filter(Boolean);
            }
          }
        } else {
          // If tags not provided but category is, use existing tags from event
          tagArray = existing.tags || [];
        }
        
        // Prepend frontend category to tags if provided and not already present
        if (category && !tagArray.includes(category)) {
          tagArray = [category, ...tagArray];
        }
        
        updates.tags = tagArray;
      }

      const event = await Event.findByIdAndUpdate(req.params.id, updates, {
        new: true,
      })
        .populate("organizer", "name email avatar department")
        .populate("attendees.user", "name email avatar department");
      res.json({
        success: true,
        data: { event: mapEventToFrontend(event, req.user._id) },
      });
    } catch (err) {
      next(err);
    }
  }
);

// Get event attendees (admin or organizer)
router.get('/:id/attendees', async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate('attendees.user', 'name email department avatar')
      .populate('organizer', 'name email department avatar');
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    const isOrganizer = event.organizer?._id?.toString() === req.user._id.toString() || 
                        event.organizer?.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin' || req.user.role === 'moderator';
    if (!isOrganizer && !isAdmin) return res.status(403).json({ success: false, message: 'Not authorized' });

    // Map attendees to match IAttendee interface
    const attendees = event.attendees.map(a => {
      const user = a.user?._doc || a.user || {};
      return {
        _id: a._id?.toString() || a.user?._id?.toString() || a.user?.toString(),
        user: a.user?._id?.toString() || a.user?.toString(),
        status: a.status || 'attending',
        registeredAt: a.registeredAt || a.createdAt,
        checkedIn: a.checkedIn || false,
        checkedInAt: a.checkedInAt,
        name: user.name || 'Unknown',
        email: user.email || '',
        avatar: user.avatar || '',
        department: user.department || '',
      };
    });

    res.json({ success: true, data: { attendees } });
  } catch (err) { next(err); }
});

// Delete event
router.delete("/:id", async (req, res, next) => {
  try {
    const deleted = await Event.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Event not found" });
    }
    res.json({ success: true, message: "Event deleted successfully" });
  } catch (err) {
    next(err);
  }
});

// RSVP to event (toggle attending for current user)
router.post(
  "/:id/rsvp",
  createUserLimiter(60 * 1000, 30, 'Too many RSVP actions, please try again later.'),
  validate(eventSchemas.rsvp),
  async (req, res, next) => {
    try {
      const event = await Event.findById(req.params.id).populate(
        "organizer",
        "name email avatar department"
      );
      if (!event) {
        return res
          .status(404)
          .json({ success: false, message: "Event not found" });
      }

      const already = event.attendees.find(
        (a) => a.user.toString() === req.user._id.toString()
      );
      if (already) {
        // Unregister
        await event.unregisterUser(req.user._id);
      } else {
        await event.registerUser(req.user._id, "attending");
      }

      const updated = await Event.findById(req.params.id)
        .populate("organizer", "name email avatar department")
        .populate("attendees.user", "name email avatar department");
      res.json({
        success: true,
        data: { event: mapEventToFrontend(updated, req.user._id) },
      });
    } catch (err) {
      next(err);
    }
  }
);

// Add feedback to event
router.post("/:id/feedback", validate(eventSchemas.addFeedback), async (req, res, next) => {
  try {
    const { rating, comment } = req.body;
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ success: false, message: "Event not found" });
    }

    await event.addFeedback(req.user._id, rating, comment);
    
    const updated = await Event.findById(req.params.id)
      .populate("organizer", "name email avatar department")
      .populate("attendees.user", "name email avatar department")
      .populate("feedback.user", "name email avatar");
    
    res.json({
      success: true,
      data: { event: mapEventToFrontend(updated, req.user._id) },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
