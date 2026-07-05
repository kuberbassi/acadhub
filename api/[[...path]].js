// Vercel serverless catch-all — delegates to the compiled Express app
const handler = require('../api-node/dist/vercel');
module.exports = handler.default || handler;
