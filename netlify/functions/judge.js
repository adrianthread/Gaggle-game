// netlify/functions/judge.js — thin Netlify wrapper (v1 handler API, CommonJS).
// Reached via the /api/* redirect in netlify.toml. No business logic here.
'use strict';
const { handleJudgeRequest } = require('../../lib/judge');

exports.handler = async (event) => {
  const { status, body } = await handleJudgeRequest({
    method: event.httpMethod,
    rawBody: event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : (event.body || ''),
  });
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    body: JSON.stringify(body),
  };
};
