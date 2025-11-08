const path = require('path');
const { fork } = require('child_process');
const { randomUUID } = require('crypto');
const logger = require('../utils/logger');
const { getDashboardSnapshot, emitSystemTestUpdate } = require('../services/systemTestService');

let activeRun = null;

async function getSystemTests(req, res, next) {
  try {
    const snapshot = await getDashboardSnapshot();
    res.json({ success: true, data: snapshot });
  } catch (error) {
    next(error);
  }
}

function runSystemTests(req, res, next) {
  if (activeRun && activeRun.running) {
    return res.status(409).json({
      success: false,
      message: 'System tests are already running. Please wait for the current run to finish.',
      data: { runId: activeRun.runId },
    });
  }

  const scriptPath = path.join(__dirname, '..', 'tests', 'system-functionality.test.js');
  const runId = req.body?.runId && typeof req.body.runId === 'string' ? req.body.runId : randomUUID();

  try {
    const child = fork(scriptPath, [], {
      stdio: ['inherit', 'pipe', 'pipe', 'ipc'],
      env: {
        ...process.env,
        NODE_ENV: process.env.NODE_ENV || 'production',
        VERMILINKS_SYSTEM_TEST_RUN: '1',
        SYSTEM_TEST_RUN_ID: runId,
      },
    });

    activeRun = { runId, startedAt: new Date(), running: true, child };

    child.on('message', (message) => {
      if (!message || typeof message !== 'object') {
        return;
      }
      if (message.type === 'systemTestUpdate' && message.payload) {
        emitSystemTestUpdate(message.payload);
      }
      if (message.type === 'systemTestLog' && message.payload) {
        const { level = 'info', message: text } = message.payload;
        logger[level] ? logger[level](text) : logger.info(text);
      }
    });

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      logger.debug(text.trim());
    });

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      logger.error(text.trim());
    });

    child.on('exit', (code) => {
      if (activeRun && activeRun.child === child) {
        activeRun.running = false;
        activeRun.finishedAt = new Date();
        activeRun.exitCode = code;
        activeRun = null;
      }
    });

    res.status(202).json({
      success: true,
      message: 'System tests started.',
      data: { runId },
    });
  } catch (error) {
    activeRun = null;
    next(error);
  }
}

module.exports = {
  getSystemTests,
  runSystemTests,
};
