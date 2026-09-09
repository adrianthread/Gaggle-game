// api/judge.js — thin Vercel Node runtime wrapper (CommonJS). Auto-routed to /api/judge.
'use strict';
const { handleJudgeRequest } = require('../lib/judge');

module.exports = async (req, res) => {
  // Vercel parses JSON bodies into req.body; objects pass through, strings get parsed in lib.
  const rawBody = req.body == null ? '' : req.body;
  const { status, body } = await handleJudgeRequest({ method: req.method, rawBody });
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(body);
};
