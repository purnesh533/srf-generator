import bcrypt from "bcryptjs";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.resolve(__dirname, "../../data");
const usersFile = path.join(dataDir, "users.json");

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

async function ensureStore() {
  await mkdir(dataDir, { recursive: true });
  try {
    await readFile(usersFile, "utf-8");
  } catch {
    await writeFile(usersFile, JSON.stringify(SEED_USERS, null, 2), "utf-8");
    return;
  }
  await ensureSeedUsers();
}

async function ensureSeedUsers() {
  try {
    const raw = await readFile(usersFile, "utf-8");
    const cleaned = raw.replace(/^\uFEFF/, "").trim();
    const list = cleaned ? JSON.parse(cleaned) : [];
    const users = Array.isArray(list) ? list : [];
    let changed = false;
    for (const seed of SEED_USERS) {
      if (!users.some((u) => u.username === seed.username)) {
        users.push(seed);
        changed = true;
      }
    }
    if (changed) {
      await writeFile(usersFile, JSON.stringify(users, null, 2), "utf-8");
    }
  } catch {
    // ignore - reader will handle malformed file
  }
}

async function readUsers() {
  await ensureStore();
  const raw = await readFile(usersFile, "utf-8");
  const cleaned = raw.replace(/^\uFEFF/, "").trim();
  if (!cleaned) return [];
  try {
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeUsers(users) {
  await writeFile(usersFile, JSON.stringify(users, null, 2), "utf-8");
}

export async function findUserByUsername(username) {
  const users = await readUsers();
  const target = String(username || "").trim().toLowerCase();
  return users.find((u) => u.username === target) || null;
}

export async function listUsers() {
  const users = await readUsers();
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

  const users = await readUsers();
  if (users.some((u) => u.username === normalized)) {
    throw new Error("Username already exists");
  }

  const newUser = {
    username: normalized,
    passwordHash: bcrypt.hashSync(String(password), SALT_ROUNDS),
    role: role === "admin" ? "user" : "user",
    displayName: String(displayName || normalized).trim()
  };

  users.push(newUser);
  await writeUsers(users);
  return newUser;
}

export async function updateUserRole(username, role) {
  const normalized = String(username || "").trim().toLowerCase();
  if (!normalized) throw new Error("Username is required");
  const allowed = ["user", "admin"];
  if (!allowed.includes(role)) {
    throw new Error(`Role must be one of: ${allowed.join(", ")}`);
  }
  const users = await readUsers();
  const idx = users.findIndex((u) => u.username === normalized);
  if (idx === -1) throw new Error("User not found");
  if (users[idx].role === "superadmin") {
    throw new Error("Cannot change a superadmin's role");
  }
  users[idx].role = role;
  await writeUsers(users);
  return {
    username: users[idx].username,
    role: users[idx].role,
    displayName: users[idx].displayName
  };
}

export async function createAdminUser({ username, password, displayName }) {
  const normalized = String(username || "").trim().toLowerCase();
  if (!normalized) throw new Error("Username is required");
  if (!password || String(password).length < 6) {
    throw new Error("Password must be at least 6 characters");
  }

  const users = await readUsers();
  if (users.some((u) => u.username === normalized)) {
    throw new Error("Username already exists");
  }

  const newUser = {
    username: normalized,
    passwordHash: bcrypt.hashSync(String(password), SALT_ROUNDS),
    role: "admin",
    displayName: String(displayName || normalized).trim()
  };

  users.push(newUser);
  await writeUsers(users);
  return newUser;
}
