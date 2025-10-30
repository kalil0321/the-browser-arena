import { pgTable, text, timestamp, varchar, boolean, integer, jsonb } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";

// Users table - for Better Auth
export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  email: text("email"),
  emailVerified: boolean("emailVerified").notNull().default(false),
  name: text("name"),
  image: text("image"),
  isAnonymous: boolean("isAnonymous").notNull().default(true),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

// Sessions table - for Better Auth
export const sessions = pgTable("session", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expiresAt").notNull(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

// Accounts table - for Better Auth
export const accounts = pgTable("account", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

// Verification tokens table - for Better Auth
export const verifications = pgTable("verification", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

// Arena sessions table - for tracking agent competitions
export const arenaSessions = pgTable("arena_session", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  prompt: text("prompt").notNull(),
  status: varchar("status", { length: 50 }).notNull().default("pending"),
  agents: jsonb("agents").notNull().default([]),
  winner: text("winner"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  completedAt: timestamp("completedAt"),
});

// Agent runs table - detailed tracking of each agent's performance
export const agentRuns = pgTable("agent_run", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  arenaSessionId: text("arenaSessionId")
    .notNull()
    .references(() => arenaSessions.id, { onDelete: "cascade" }),
  agentName: varchar("agentName", { length: 100 }).notNull(),
  status: varchar("status", { length: 50 }).notNull().default("initializing"),
  steps: integer("steps").notNull().default(0),
  timeElapsed: integer("timeElapsed").notNull().default(0), // in milliseconds
  error: text("error"),
  result: jsonb("result"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  completedAt: timestamp("completedAt"),
});

