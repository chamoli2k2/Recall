import 'dotenv/config';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDatabase } from './config/database.js';
import { User, Folder, Card, allModels } from './models/index.js';
import { sampleFolders } from '../../shared/sampleData.js';
if (process.env.NODE_ENV === 'production') throw new Error('Sample seeding is for development only.');
await connectDatabase(); await Promise.all(allModels.map(m => m.init()));
const username = process.env.SEED_USERNAME || 'learner';
let user = await User.findOne({ username });
if (!user) {
  const password = process.env.SEED_PASSWORD || crypto.randomBytes(18).toString('base64url');
  user = await User.create({ username, name: 'Demo Learner', email: 'learner@example.test', passwordHash: await bcrypt.hash(password, 12) });
  console.log(`Development account created: @${username}`);
  if (!process.env.SEED_PASSWORD) console.log(`Generated development password: ${password}`);
}
for (const sample of sampleFolders) {
  if (await Folder.exists({ owner: user.id, title: sample.title })) continue;
  const folder = await Folder.create({ title: sample.title, description: sample.description, color: sample.color, icon: sample.icon, visibility: sample.visibility, owner: user.id });
  await Card.insertMany(sample.cards.map(([front, back, tags]) => ({ folder: folder.id, front: { text: front }, back: { text: back }, tags, createdBy: user.id, updatedBy: user.id })));
}
console.log('Sample collections are ready. Existing data was preserved.');
await mongoose.disconnect();
