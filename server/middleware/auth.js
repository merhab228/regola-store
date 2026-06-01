import jwt from "jsonwebtoken";

const DEV_FALLBACK = "dev_secret_change_me";

function jwtSecret() {
  const s = process.env.JWT_SECRET;
  if (process.env.NODE_ENV === "production" && (!s || s === DEV_FALLBACK)) {
    throw new Error("JWT_SECRET must be set to a strong random value in production");
  }
  return s && s.length >= 32 ? s : DEV_FALLBACK;
}

export function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      isAdmin: !!user.is_admin,
    },
    jwtSecret(),
    { expiresIn: "8h" }
  );
}

export function authRequired(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Unauthorized" });
  try {
    req.user = jwt.verify(token, jwtSecret());
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}

export function adminRequired(req, res, next) {
  if (!req.user?.isAdmin) return res.status(403).json({ message: "Forbidden" });
  return next();
}
