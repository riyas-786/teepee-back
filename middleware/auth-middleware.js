const jwt = require('jsonwebtoken');

function verifyToken(req, res, next) {
  const header = req.header('Authorization');
  if (!header) return res.status(401).send('No token provided');

  // Expect "Bearer <token>"
  const token = header.startsWith('Bearer ') ? header.slice(7) : header;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, email, role, assignedBuildings }
    next();
  } catch (err) {
    res.status(401).send('Invalid or expired token');
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).send('Admin access required');
  }
  next();
}

module.exports = { verifyToken, requireAdmin };
