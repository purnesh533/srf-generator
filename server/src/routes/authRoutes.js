import { Router } from "express";
import bcrypt from "bcryptjs";
import {
  createAdminUser,
  createUser,
  findUserByUsername,
  listUsers,
  updateUserRole
} from "../config/users.js";
import { signToken, requireAuth, requireSuperAdmin } from "../middleware/auth.js";

const router = Router();

function buildAuthResponse(user) {
  const token = signToken({
    username: user.username,
    role: user.role,
    displayName: user.displayName
  });
  return {
    token,
    user: {
      username: user.username,
      role: user.role,
      displayName: user.displayName
    }
  };
}

router.post("/signup", async (req, res) => {
  try {
    const { username, password, displayName } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ message: "Username and password are required" });
    }
    const user = await createUser({ username, password, displayName });
    res.status(201).json({
      message: "Account created. Please log in.",
      user: {
        username: user.username,
        role: user.role,
        displayName: user.displayName
      }
    });
  } catch (error) {
    const msg = error?.message || "Failed to sign up";
    const status = msg.includes("already exists") ? 409 : 400;
    res.status(status).json({ message: msg });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ message: "Username and password are required" });
    }

    const user = await findUserByUsername(username);
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const ok = bcrypt.compareSync(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    res.json(buildAuthResponse(user));
  } catch (error) {
    res.status(500).json({ message: "Login failed", error: error.message });
  }
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

router.get("/users", requireAuth, requireSuperAdmin, async (_req, res) => {
  try {
    const users = await listUsers();
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: "Failed to list users", error: error.message });
  }
});

router.post("/admins", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { username, password, displayName } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ message: "Username and password are required" });
    }
    const user = await createAdminUser({ username, password, displayName });
    res.status(201).json({
      message: "Admin user created",
      user: {
        username: user.username,
        role: user.role,
        displayName: user.displayName
      }
    });
  } catch (error) {
    const msg = error?.message || "Failed to create admin";
    const status = msg.includes("already exists") ? 409 : 400;
    res.status(status).json({ message: msg });
  }
});

router.patch("/users/:username/role", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { role } = req.body || {};
    const user = await updateUserRole(req.params.username, role);
    res.json({ message: `Role updated to ${user.role}`, user });
  } catch (error) {
    const msg = error?.message || "Failed to update role";
    const status =
      msg === "User not found"
        ? 404
        : msg.includes("superadmin")
          ? 403
          : 400;
    res.status(status).json({ message: msg });
  }
});

export default router;
