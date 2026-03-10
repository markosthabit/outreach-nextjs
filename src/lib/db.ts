// lib/db.ts
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI!;

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable');
}

declare global {
  var mongoose: { conn: mongoose.Connection | null; promise: Promise<mongoose.Connection> | null };
}

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

export async function connectDB() {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(MONGODB_URI, { bufferCommands: false })
      .then((m) => m.connection);
  }

  cached.conn = await cached.promise;

  // ── Force all models to register by importing them ──
  // This ensures populate() works regardless of which
  // API route is invoked by Vercel
  await Promise.all([
    import('@/models/user.model'),
    import('@/models/servantee.model'),
    import('@/models/retreat.model'),
    import('@/models/note.model'),
  ])

  return cached.conn;
}