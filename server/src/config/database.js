import mongoose from 'mongoose';
export async function connectDatabase(uri = process.env.MONGODB_URI) {
  if (!uri) throw new Error('MONGODB_URI is required. Use npm run dev:local for a local development replica set.');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
}
