const { verifyToken } = require('../auth');

// We export functions at the end. We'll define real implementations first,
// and override them with no-ops if test bypass is enabled.
function realRequireAuth(req, res, next) {
  const hdr = req.headers.authorization || '';
  const m = hdr.match(/^Bearer\s+(.+)$/i);
  if (!m) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  try {
    const decoded = verifyToken(m[1]);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function realRequireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}

// Default to real implementations
let requireAuth = realRequireAuth;
let requireRole = realRequireRole;

// If test bypass is requested, override with no-ops that also provide a test user.
if (process.env.BYPASS_AUTH === 'true') {
  // Provide a stable dummy user so any code accessing req.user works.
  const testUser = { id: 0, email: 'jest@example.com', name: 'Jest', role: 'Admin' };
  console.log('✅ Auth middleware bypassed (test mode)');
  requireAuth = (req, res, next) => { req.user = testUser; next(); };
  requireRole = () => (req, res, next) => next();
}

module.exports = { requireAuth, requireRole };
