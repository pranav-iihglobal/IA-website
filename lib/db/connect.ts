import mongoose from "mongoose";

/**
 * Cached MongoDB connection.
 *
 * On Vercel every serverless invocation can run in a fresh module scope, and
 * in dev the module is re-evaluated on every hot reload. Without caching we
 * would open a new connection each time and exhaust the Atlas M0 limit
 * (500 connections, but a handful of concurrent lambdas gets there fast).
 * The connection is stashed on `globalThis` so it survives both.
 */

const MONGODB_URI = process.env.MONGODB_URI;

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var _mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache = global._mongooseCache ?? {
  conn: null,
  promise: null,
};
global._mongooseCache = cached;

export async function connectToDatabase(): Promise<typeof mongoose> {
  if (cached.conn) return cached.conn;

  if (!MONGODB_URI) {
    throw new Error(
      "MONGODB_URI is not set. Add it to .env.local (see .env.example).",
    );
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
      // Keep the pool small — many short-lived lambdas share the M0 cluster.
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 10_000,
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (error) {
    cached.promise = null;
    throw error;
  }

  return cached.conn;
}

/** True when a database is configured — lets pages fall back gracefully. */
export function isDatabaseConfigured(): boolean {
  return Boolean(MONGODB_URI);
}
