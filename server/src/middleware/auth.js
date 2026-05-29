import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "srf-prototype-secret-key";

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "8h" });
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "Authentication required" });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin" && req.user?.role !== "superadmin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
}

export function requireSuperAdmin(req, res, next) {
  if (req.user?.role !== "superadmin") {
    return res.status(403).json({ message: "Super admin access required" });
  }
  next();
}
