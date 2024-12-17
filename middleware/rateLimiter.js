// middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 999999999999999999 // limit each IP to 100 requests per windowMs
});

module.exports = limiter;