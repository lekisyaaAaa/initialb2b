const { QueryTypes, Op } = require('sequelize');
const sequelize = require('./database_pg');
const SystemTest = require('../models/SystemTest');
const logger = require('../utils/logger');

let systemTestNamespace = null;

const STATUS_WEIGHT = {
  failed: 0,
  error: 0,
  warn: 1,
  warning: 1,
  ok: 2,
  success: 2,
};

const SECTION_ORDER = [
  'Backend & Database',
  'ESP32 Communication',
  'Frontend Integration',
  'Safety Logic & Automation',
];

function setSystemTestNamespace(namespace) {
  systemTestNamespace = namespace;
}

function emitSystemTestUpdate(payload) {
  if (!payload) {
    return;
  }
  if (systemTestNamespace) {
    systemTestNamespace.emit('systemTestUpdate', payload);
  }
}

function resolveStatusWeight(status) {
  if (!status) {
    return -1;
  }
  const normalized = status.toString().toLowerCase();
  return STATUS_WEIGHT.hasOwnProperty(normalized) ? STATUS_WEIGHT[normalized] : -1;
}

async function getLatestResults() {
  const rows = await SystemTest.findAll({
    order: [
      ['section', 'ASC'],
      ['timestamp', 'DESC'],
      ['id', 'DESC'],
    ],
  });

  const bySection = new Map();
  for (const row of rows) {
    const payload = row.get({ plain: true });
    const section = payload.section;
    if (!bySection.has(section)) {
      bySection.set(section, payload);
    }
  }

  const latest = SECTION_ORDER.map((section) => {
    const match = bySection.get(section);
    if (match) {
      return match;
    }
    return {
      section,
      status: 'pending',
      details: 'Awaiting test run',
      timestamp: null,
      runId: null,
      metadata: null,
    };
  });

  const others = Array.from(bySection.entries())
    .filter(([section]) => !SECTION_ORDER.includes(section))
    .map(([, payload]) => payload);

  return [...latest, ...others];
}

async function getRecentRuns(limit = 10) {
  const boundedLimit = Math.max(1, Math.min(50, Number(limit) || 10));
  const rows = await sequelize.query(
    `SELECT run_id AS "runId", MAX(timestamp) AS "completedAt"
     FROM system_tests
     GROUP BY run_id
     ORDER BY MAX(timestamp) DESC
     LIMIT :limit`,
    {
      replacements: { limit: boundedLimit },
      type: QueryTypes.SELECT,
    }
  );

  if (!rows || rows.length === 0) {
    return [];
  }

  const runIds = rows.map((row) => row.runId);
  const tests = await SystemTest.findAll({
    where: { runId: { [Op.in]: runIds } },
    order: [
      ['runId', 'ASC'],
      ['timestamp', 'ASC'],
      ['id', 'ASC'],
    ],
  });

  const byRun = new Map();
  for (const test of tests) {
    const plain = test.get({ plain: true });
    if (!byRun.has(plain.runId)) {
      byRun.set(plain.runId, []);
    }
    byRun.get(plain.runId).push(plain);
  }

  const history = rows.map((row) => {
    const runId = row.runId;
    const entries = (byRun.get(runId) || []).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const startedAt = entries.length > 0 ? entries[0].timestamp : row.completedAt;
    let overallWeight = 2;
    for (const entry of entries) {
      const w = resolveStatusWeight(entry.status);
      if (w >= 0 && w < overallWeight) {
        overallWeight = w;
      }
    }
    const overallStatus = overallWeight <= 0 ? 'failed' : overallWeight === 1 ? 'warn' : 'ok';
    return {
      runId,
      startedAt,
      completedAt: row.completedAt,
      overallStatus,
      entries,
    };
  });

  return history;
}

async function getDashboardSnapshot() {
  const [latest, history] = await Promise.all([getLatestResults(), getRecentRuns(10)]);
  return { latest, history };
}

async function pruneOldRuns(retainRuns = 50) {
  try {
    const history = await getRecentRuns(retainRuns);
    const retainIds = new Set(history.map((run) => run.runId));
    if (retainIds.size === 0) {
      return 0;
    }
    const deleted = await SystemTest.destroy({
      where: {
        runId: {
          [Op.notIn]: Array.from(retainIds),
        },
      },
    });
    return deleted;
  } catch (error) {
    logger.warn('systemTestService.pruneOldRuns failed', error && error.message ? error.message : error);
    return 0;
  }
}

module.exports = {
  setSystemTestNamespace,
  emitSystemTestUpdate,
  getLatestResults,
  getRecentRuns,
  getDashboardSnapshot,
  pruneOldRuns,
  setSystemTestNamespace,
};
