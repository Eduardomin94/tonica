import jwt from "jsonwebtoken";

export function requireAuth(req, res, next) {
  const auth = req.headers.authorization || "";
  const [type, token] = auth.split(" ");

  if (type !== "Bearer" || !token) {
    return res.status(401).json({ error: "Missing Bearer token" });
  }

  try {
    const decoded = jwt.verify(token, process.env.AUTH_JWT_SECRET);
    req.userId = decoded.sub;
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}
