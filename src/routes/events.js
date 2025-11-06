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

// Helper: map Event model -> frontend shape the app expects
const mapEventToFrontend = (eventDoc, currentUserId) => {
  const isRegistered = currentUserId
    ? eventDoc.attendees.some(
        (a) => a.user.toString() === currentUserId.toString()
      )
    : false;

  // Derive status similar to UI logic
  const now = new Date();
  let status = "upcoming";
  if (now > eventDoc.endDate) status = "completed";
  else if (now >= eventDoc.startDate && now <= eventDoc.endDate)
    status = "ongoing";

  return {
    id: eventDoc._id.toString(),
    title: eventDoc.title,
    description: eventDoc.description,
    organizer: {
      name: eventDoc.organizer?.name || "Unknown",
      department: eventDoc.organizer?.department || "General",
      avatar: eventDoc.organizer?.avatar,
    },
    date: eventDoc.startDate?.toISOString(),
    endDate: eventDoc.endDate?.toISOString(),
    location: eventDoc.location?.name || "TBD",
    // Frontend uses a semantic "type" (Workshop/Lunch & Learn/Presentation/Team Building)
    // The backend stores type as online/offline/hybrid; keep a best-effort surface
    type:
      eventDoc.tags?.find((t) =>
        ["Workshop", "Lunch & Learn", "Presentation", "Team Building"].includes(
          t
        )
      ) || "Workshop",
    category: eventDoc.tags?.[0] || "Technology",
    attendees: eventDoc.attendeeCount || eventDoc.attendees?.length || 0,
    maxAttendees: eventDoc.capacity || 0,
    isRegistered,
    tags: eventDoc.tags || [],
    status,
    images: (eventDoc.images || []).map((img) => ({
      filename: img.filename,
      originalName: img.originalName,
      url: img.url,
      isPrimary: !!img.isPrimary,
    })),
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
        .populate("organizer", "name email avatar department");
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
    const event = await Event.findById(req.params.id).populate(
      "organizer",
      "name email avatar department"
    );
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
      // Frontend sends: title, description, date, endDate, location (string), type, category, maxAttendees, tags (comma-separated or array)
      const {
        title,
        description,
        date,
        endDate,
        location,
        type,
        category,
        maxAttendees,
        tags,
      } = req.body;

      // Normalize tags array
      const normalizedTags = Array.isArray(tags)
        ? tags
        : typeof tags === "string"
          ? tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
          : [];

      // Map uploaded files to images array
      const images = (req.files || []).map((file, idx) => ({
        filename: file.filename,
        originalName: file.originalname,
        url: file.url || `/uploads/${file.path.replace(/\\/g, '/').split('uploads/')[1]}`,
        isPrimary: idx === 0,
      }));

      // Map to Event model fields
      const event = await Event.create({
        title,
        description,
        organizer: req.user._id,
        category: "other", // keep flexible; semantic category is captured in tags
        type: "offline", // default; frontend semantic type is stored in tags
        location: { name: location || "TBD" },
        startDate: new Date(date),
        endDate: new Date(endDate || date),
        capacity: Number.isFinite(Number(maxAttendees))
          ? Number(maxAttendees)
          : null,
        tags: [...new Set([type, category, ...normalizedTags].filter(Boolean))],
        status: "published",
        images,
      });

      // Auto-register creator
      await event.registerUser(req.user._id, "attending");

      const created = await Event.findById(event._id).populate(
        "organizer",
        "name email avatar department"
      );
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

// Update event (minimal fields used by frontend)
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
        endDate,
        location,
        maxAttendees,
        tags,
        status,
      } = req.body;

      const updates = {};
      if (title !== undefined) updates.title = title;
      if (description !== undefined) updates.description = description;
      if (date) updates.startDate = new Date(date);
      if (endDate) updates.endDate = new Date(endDate);
      if (location !== undefined) updates.location = { name: location };
      if (maxAttendees !== undefined)
        updates.capacity = Number(maxAttendees) || null;
      if (Array.isArray(tags)) updates.tags = tags;
      if (typeof status === "string") updates.status = status;

      const event = await Event.findByIdAndUpdate(req.params.id, updates, {
        new: true,
      }).populate("organizer", "name email avatar department");
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
    const event = await Event.findById(req.params.id).populate('attendees.user', 'name email department avatar');
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    const isOrganizer = event.organizer?.toString?.() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin' || req.user.role === 'moderator';
    if (!isOrganizer && !isAdmin) return res.status(403).json({ success: false, message: 'Not authorized' });

    const attendees = event.attendees.map(a => ({
      id: a.user._id,
      name: a.user.name,
      email: a.user.email,
      department: a.user.department,
      avatar: a.user.avatar,
      status: a.status,
      registeredAt: a.createdAt
    }));

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

      const updated = await Event.findById(req.params.id).populate(
        "organizer",
        "name email avatar department"
      );
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
router.post("/:id/feedback", validate(eventSchemas.addFeedback), (req, res) => {
  // Implementation for adding feedback
  res.json({
    success: true,
    message: "Feedback added successfully",
  });
});

module.exports = router;
