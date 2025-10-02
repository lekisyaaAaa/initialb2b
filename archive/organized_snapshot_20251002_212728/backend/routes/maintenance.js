const express = require('express');
const Settings = require('../models/Settings');
const { auth, adminOnly } = require('../middleware/auth');

const router = express.Router();

// @route GET /api/maintenance
// @desc  Get maintenance reminders (public read for admins; authenticated users see limited view)
// @access Private
router.get('/', auth, async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    const reminders = (settings.maintenance && Array.isArray(settings.maintenance.reminders)) ? settings.maintenance.reminders : null;

    // If no reminders in settings, provide sensible defaults for admins
    const defaults = [
      { id: 'm1', title: 'Check ESP32 firmware', dueInDays: 30, note: 'Verify firmware and update if available.' },
      { id: 'm2', title: 'Clean sensor probes', dueInDays: 60, note: 'Remove deposits and recalibrate.' },
      { id: 'm3', title: 'Inspect battery levels', dueInDays: 7, note: 'Replace or recharge low batteries.' }
    ];

    const data = reminders && reminders.length > 0 ? reminders : defaults;

    // Non-admins should not see internal notes
    const out = data.map(r => ({ id: r.id, title: r.title, dueInDays: r.dueInDays, note: req.user.role === 'admin' ? r.note : undefined }));

    res.json({ success: true, data: out });
  } catch (e) {
    console.error('Error fetching maintenance reminders:', e && e.message ? e.message : e);
    res.status(500).json({ success: false, message: 'Error fetching maintenance reminders' });
  }
});

module.exports = router;
