const { Op, literal } = require('sequelize');
const SensorLog = require('../models/SensorLog');
const sensorLogService = require('../services/sensorLogService');

const getLikeOperator = () => {
  try {
    const dialect = SensorLog.sequelize.getDialect();
    return dialect === 'postgres' ? Op.iLike : Op.like;
  } catch (err) {
    return Op.like;
  }
};

const parseDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

exports.list = async (req, res) => {
  const page = Math.max(Number.parseInt(req.query.page || '1', 10), 1);
  const limitRaw = Number.parseInt(req.query.limit || '25', 10);
  const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 25, 1), 200);
  const offset = (page - 1) * limit;
  const where = {};
  const likeOp = getLikeOperator();

  const deviceId = req.query.deviceId ? req.query.deviceId.toString().trim() : '';
  if (deviceId) {
    where.deviceId = deviceId;
  }

  const sensorName = req.query.sensor ? req.query.sensor.toString().trim() : '';
  if (sensorName) {
    where.sensorName = sensorName;
  }

  const origin = req.query.origin ? req.query.origin.toString().trim() : '';
  if (origin) {
    where.origin = origin;
  }

  const startDate = parseDate(req.query.start);
  const endDate = parseDate(req.query.end);
  if (startDate || endDate) {
    where.recordedAt = {};
    if (startDate) {
      where.recordedAt[Op.gte] = startDate;
    }
    if (endDate) {
      where.recordedAt[Op.lte] = endDate;
    }
  }

  const search = req.query.search ? req.query.search.toString().trim() : '';
  if (search) {
    const pattern = `%${search}%`;
    where[Op.or] = [
      { sensorName: { [likeOp]: pattern } },
      { deviceId: { [likeOp]: pattern } },
      { origin: { [likeOp]: pattern } },
    ];
    try {
      if (SensorLog.sequelize.getDialect() === 'postgres') {
        where[Op.or].push(
          SensorLog.sequelize.where(
            literal('CAST(raw_payload AS TEXT)'),
            { [likeOp]: pattern },
          ),
        );
      }
    } catch (err) {
      // fallback: ignore raw_payload search on dialects without CAST
    }
  }

  try {
    const { rows, count } = await SensorLog.findAndCountAll({
      where,
      order: [['recordedAt', 'DESC']],
      offset,
      limit,
    });

    const items = rows.map((row) => {
      const plain = typeof row.get === 'function' ? row.get({ plain: true }) : row;
      return {
        id: plain.id,
        deviceId: plain.deviceId,
        sensorName: plain.sensorName,
        value: plain.value,
        unit: plain.unit,
        origin: plain.origin,
        recordedAt: plain.recordedAt ? new Date(plain.recordedAt).toISOString() : null,
        mqttTopic: plain.mqttTopic,
        rawPayload: plain.rawPayload,
      };
    });

    return res.json({
      success: true,
      data: {
        items,
        pagination: {
          current: page,
          limit,
          total: count,
          pages: Math.max(1, Math.ceil(count / limit)),
        },
      },
      meta: {
        sensors: Object.keys(sensorLogService.SENSOR_UNITS),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Unable to load sensor logs', error: error && error.message ? error.message : error });
  }
};
