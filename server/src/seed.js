import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDatabase } from './config/database.js';
import { User, Folder, Card, allModels } from './models/index.js';
import { demoLibrary } from '../../shared/demoLibrary.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const credsPath = path.join(root, 'demo-credentials.txt');

function readCredentials() {
  const fromFile = {};
  if (fs.existsSync(credsPath)) {
    for (const line of fs.readFileSync(credsPath, 'utf8').split(/\r?\n/)) {
      if (!line || line.startsWith('#')) continue;
      const i = line.indexOf('=');
      if (i > 0) fromFile[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
  }
  return {
    username: (process.env.SEED_USERNAME || fromFile.username || 'demolearner').toLowerCase(),
    password: process.env.SEED_PASSWORD || fromFile.password,
    email: (process.env.SEED_EMAIL || fromFile.email || 'demolearner@remio.demo').toLowerCase(),
    name: process.env.SEED_NAME || fromFile.name || 'Demo Learner',
  };
}

if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_SEED !== '1') {
  throw new Error('Sample seeding is for development. Set ALLOW_DEMO_SEED=1 to run against production.');
}

const creds = readCredentials();
if (!creds.password || creds.password.length < 10) throw new Error('Set a demo password (10+ characters) in demo-credentials.txt or SEED_PASSWORD.');

await connectDatabase();
await Promise.all(allModels.map(m => m.init()));

const passwordHash = await bcrypt.hash(creds.password, 12);
let user = await User.findOne({ username: creds.username }).select('+email +passwordHash');
if (!user) {
  user = await User.create({
    username: creds.username,
    name: creds.name,
    email: creds.email,
    bio: 'Public demo collections you can browse without signing in.',
    passwordHash,
    account: 'superadmin',
  });
  console.log(`Demo account created: @${creds.username}`);
} else {
  user.name = creds.name;
  user.email = creds.email;
  user.bio = user.bio || 'Public demo collections you can browse without signing in.';
  user.passwordHash = passwordHash;
  user.account = 'superadmin';
  await user.save();
  console.log(`Demo account updated: @${creds.username}`);
}

let created = 0;
for (const sample of demoLibrary) {
  let folder = await Folder.findOne({ owner: user.id, title: sample.title });
  if (!folder) {
    folder = await Folder.create({
      title: sample.title,
      description: sample.description,
      color: sample.color,
      icon: sample.icon,
      visibility: 'global',
      owner: user.id,
    });
    created += 1;
  } else if (folder.visibility !== 'global' || folder.archived) {
    folder.visibility = 'global';
    folder.archived = false;
    folder.description = sample.description;
    folder.color = sample.color;
    folder.icon = sample.icon;
    await folder.save();
  }
  const existing = await Card.countDocuments({ folder: folder.id });
  if (existing) continue;
  await Card.insertMany(sample.cards.map(([front, back, tags]) => ({
    folder: folder.id,
    front: { text: front },
    back: { text: back },
    tags,
    createdBy: user.id,
    updatedBy: user.id,
  })));
}

console.log(`Demo library ready: ${demoLibrary.length} public folders (${created} new). Existing folders were preserved.`);
console.log(`Sign in as ${creds.username} / ${creds.email} using the password in demo-credentials.txt`);
await mongoose.disconnect();
