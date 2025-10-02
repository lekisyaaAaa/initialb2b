const express = require('express');
const { query, validationResult } = require('express-validator');
const Alert = require('../models/Alert');
const { auth, adminOnly } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/alerts
// @desc    Get alerts with pagination and filtering
// @access  Private
router.get('/', auth, [
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('severity').optional().isIn(['low', 'medium', 'high', 'critical']).withMessage('Invalid severity level'),
  query('type').optional().isIn(['temperature', 'humidity', 'moisture', 'device_offline', 'device_online', 'battery_low', 'ph', 'ec', 'nitrogen', 'phosphorus', 'potassium', 'water_level']).withMessage('Invalid alert type'),
  query('deviceId').optional().notEmpty().withMessage('Device ID cannot be empty'),
  query('resolved').optional().isBoolean().withMessage('Resolved must be a boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const {
      limit = 20,
      page = 1,
      severity,
      type,
      deviceId,
      resolved
    } = req.query;

    // Build query
    let query = {};
    
    if (severity) query.severity = severity;
    if (type) query.type = type;
    if (deviceId) query.deviceId = deviceId;
    if (resolved !== undefined) query.isResolved = resolved === 'true';

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get alerts with pagination using Sequelize
    const where = query; // Sequelize will use this object for filtering
    const alerts = await Alert.findAll({
      where,
      order: [['createdAt', 'DESC']],
      offset: skip,
      limit: parseInt(limit)
    });
    const total = await Alert.count({ where });

    res.json({
      success: true,
      data: {
        alerts,
        pagination: {
          current: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });

  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching alerts'
    });
  }
});

// @route   GET /api/alerts/recent
// @desc    Get recent unresolved alerts
// @access  Private
router.get('/recent', auth, async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const alerts = await Alert.findAll({
      where: { isResolved: false },
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      data: alerts
    });

  } catch (error) {
    console.error('Error fetching recent alerts:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching recent alerts'
    });
  }
});

// @route   GET /api/alerts/stats
// @desc    Get alert statistics
// @access  Private
router.get('/stats', auth, async (req, res) => {
  try {
    const { hours = 24 } = req.query;
    
    const hoursAgo = new Date(Date.now() - parseInt(hours) * 60 * 60 * 1000);

    // Use Sequelize to compute breakdown and overall stats
    // Breakdown: counts grouped by severity and type
    const { Sequelize } = require('sequelize');
    const db = Alert.sequelize;

    // Raw query using Sequelize to count by severity and type
    const breakdownRows = await Alert.findAll({
      attributes: [
        'severity', 'type', [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
      ],
      where: { createdAt: { [Sequelize.Op.gte]: hoursAgo } },
      group: ['severity', 'type']
    });

    // Transform rows into desired structure
    const breakdownMap = {};
    breakdownRows.forEach(r => {
      const sev = r.get('severity') || 'unknown';
      const type = r.get('type') || 'unknown';
      const count = parseInt(r.get('count') || 0, 10);
      if (!breakdownMap[sev]) breakdownMap[sev] = { severity: sev, types: [], total: 0 };
      breakdownMap[sev].types.push({ type, count });
      breakdownMap[sev].total += count;
    });

    const breakdown = Object.values(breakdownMap);

    // Overall stats
    const total = await Alert.count({ where: { createdAt: { [Sequelize.Op.gte]: hoursAgo } } });
    const resolved = await Alert.count({ where: { createdAt: { [Sequelize.Op.gte]: hoursAgo }, isResolved: true } });
    const unresolved = await Alert.count({ where: { createdAt: { [Sequelize.Op.gte]: hoursAgo }, isResolved: false } });

    res.json({
      success: true,
      data: {
        summary: { total, resolved, unresolved },
        breakdown,
        period: `${hours} hours`
      }
    });

  } catch (error) {
    console.error('Error fetching alert stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching alert statistics'
    });
  }
});

// @route   PUT /api/alerts/:id/resolve
// @desc    Resolve an alert
// @access  Private (Admin only)
router.put('/:id/resolve', [auth, adminOnly], async (req, res) => {
  try {
  const alert = await Alert.findByPk(req.params.id);
    
    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found'
      });
    }

    if (alert.isResolved) {
      return res.status(400).json({
        success: false,
        message: 'Alert is already resolved'
      });
    }

    await alert.resolve(req.user.username);

    res.json({
      success: true,
      message: 'Alert resolved successfully',
      data: alert
    });

  } catch (error) {
    console.error('Error resolving alert:', error);
    res.status(500).json({
      success: false,
      message: 'Error resolving alert'
    });
  }
});

// @route   PUT /api/alerts/resolve-all
// @desc    Resolve all alerts for a device or all devices
// @access  Private (Admin only)
router.put('/resolve-all', [auth, adminOnly], async (req, res) => {
  try {
    const { deviceId } = req.body;
    
    let query = { isResolved: false };
    if (deviceId) {
      query.deviceId = deviceId;
    }

    // Sequelize equivalent: update matching alerts
    const [updatedCount] = await Alert.update(
      {
        isResolved: true,
        resolvedAt: new Date(),
        acknowledgedBy: req.user.username,
        acknowledgedAt: new Date()
      },
      { where: query }
    );

    res.json({
      success: true,
      message: `${updatedCount} alerts resolved successfully`,
      data: {
        resolved: updatedCount,
        deviceId: deviceId || 'all'
      }
    });

  } catch (error) {
    console.error('Error resolving all alerts:', error);
    res.status(500).json({
      success: false,
      message: 'Error resolving alerts'
    });
  }
});

// @route   DELETE /api/alerts/:id
// @desc    Delete an alert
// @access  Private (Admin only)
router.delete('/:id', [auth, adminOnly], async (req, res) => {
  try {
  const alert = await Alert.findByPk(req.params.id);
    
    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found'
      });
    }

  await Alert.destroy({ where: { id: req.params.id } });

    res.json({
      success: true,
      message: 'Alert deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting alert:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting alert'
    });
  }
});

// @route   POST /api/alerts/test
// @desc    Create a test alert
// @access  Private (Admin only)
router.post('/test', [auth, adminOnly], async (req, res) => {
  try {
    const testAlert = await Alert.createAlert({
      type: 'temperature',
      severity: 'medium',
      message: 'Test alert created by admin',
      deviceId: 'TEST_DEVICE',
      sensorData: {
        temperature: 25.5,
        humidity: 60.0,
        moisture: 45.0
      }
    });

    res.status(201).json({
      success: true,
      message: 'Test alert created successfully',
      data: testAlert
    });

  } catch (error) {
    console.error('Error creating test alert:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating test alert'
    });
  }
});

module.exports = router;
