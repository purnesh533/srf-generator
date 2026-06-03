import bcrypt from "bcryptjs";
import User from "../models/User.js";
import { toApi } from "../utils/toApi.js";

const SALT_ROUNDS = 10;

const SEED_USERS = [
  {
    username: "superadmin",
    passwordHash: bcrypt.hashSync("Super@123", SALT_ROUNDS),
    role: "superadmin",
    displayName: "Super Administrator"
  },
  {
    username: "admin",
    passwordHash: bcrypt.hashSync("admin123", SALT_ROUNDS),
    role: "admin",
    displayName: "Administrator"
  }
];

export async function ensureSeedUsers() {
  for (const seed of SEED_USERS) {
    const exists = await User.findOne({ username: seed.username });
    if (!exists) {
      await User.create(seed);
      console.log(`Seeded user: ${seed.username}`);
    }
  }
}

export async function findUserByUsername(username) {
  const target = String(username || "").trim().toLowerCase();
  const doc = await User.findOne({ username: target });
  return toApi(doc);
}

export async function listUsers() {
  const users = await User.find().sort({ username: 1 });
  return users.map((u) => ({
    username: u.username,
    role: u.role,
    displayName: u.displayName
  }));
}

export async function createUser({ username, password, displayName, role }) {
  const normalized = String(username || "").trim().toLowerCase();
  if (!normalized) throw new Error("Username is required");
  if (!password || String(password).length < 6) {
    throw new Error("Password must be at least 6 characters");
  }

  const existing = await User.findOne({ username: normalized });
  if (existing) throw new Error("Username already exists");

  const newUser = await User.create({
    username: normalized,
    passwordHash: bcrypt.hashSync(String(password), SALT_ROUNDS),
    role: role === "admin" ? "user" : "user",
    displayName: String(displayName || normalized).trim()
  });
  return toApi(newUser);
}

export async function updateUserRole(username, role) {
  const normalized = String(username || "").trim().toLowerCase();
  if (!normalized) throw new Error("Username is required");
  const allowed = ["user", "admin"];
  if (!allowed.includes(role)) {
    throw new Error(`Role must be one of: ${allowed.join(", ")}`);
  }

  const user = await User.findOne({ username: normalized });
  if (!user) throw new Error("User not found");
  if (user.role === "superadmin") {
    throw new Error("Cannot change a superadmin's role");
  }
  user.role = role;
  await user.save();
  return {
    username: user.username,
    role: user.role,
    displayName: user.displayName
  };
}

export async function createAdminUser({ username, password, displayName }) {
  const normalized = String(username || "").trim().toLowerCase();
  if (!normalized) throw new Error("Username is required");
  if (!password || String(password).length < 6) {
    throw new Error("Password must be at least 6 characters");
  }

  const existing = await User.findOne({ username: normalized });
  if (existing) throw new Error("Username already exists");

  const newUser = await User.create({
    username: normalized,
    passwordHash: bcrypt.hashSync(String(password), SALT_ROUNDS),
    role: "admin",
    displayName: String(displayName || normalized).trim()
  });
  return toApi(newUser);
}
