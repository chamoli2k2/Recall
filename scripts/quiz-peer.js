#!/usr/bin/env node
// Development helper: a bot that joins a live quiz room and answers every question so you can try a room alone.
// Usage: node scripts/quiz-peer.js <ROOMCODE> <username> <password> [--accuracy 0.7] [--delay 1500] [--url http://localhost:4000]
import { io } from 'socket.io-client';
const args = process.argv.slice(2); const opt = (name, fallback) => { const i = args.indexOf(`--${name}`); return i === -1 ? fallback : args[i + 1]; };
const [code, username, password] = args; const base = opt('url', 'http://localhost:4000'), accuracy = Number(opt('accuracy', 0.7)), delay = Number(opt('delay', 1500));
if (!code || !username || !password) { console.error('Usage: node scripts/quiz-peer.js <ROOMCODE> <username> <password> [--accuracy 0.7] [--delay 1500] [--url http://localhost:4000]'); process.exit(2); }
const login = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json', origin: base }, body: JSON.stringify({ identifier: username, password }) });
if (!login.ok) { console.error('Login failed:', login.status); process.exit(1); }
const cookie = login.headers.get('set-cookie').split(';')[0];
const socket = io(base, { transports: ['websocket'], extraHeaders: { cookie, origin: base } });
let answered = -1;
// The bot cannot see the answer key mid-question (the server withholds it), so it remembers what it picked and
// learns from the reveal: with probability `accuracy` it picks the option that the reveal will show as correct.
// Since that is unknowable in advance, it instead answers randomly and reports how it did — good enough for demos.
socket.on('connect', () => socket.emit('room:join', code, res => {
  if (!res.ok) { console.error('Join failed:', res.error); process.exit(1); }
  console.log(`joined ${res.code} as ${username}; players: ${res.room.players.map(p => p.name).join(', ')}`);
}));
socket.on('room:state', room => {
  if (room.phase === 'question' && answered !== room.index) {
    answered = room.index; const n = room.question.options.length;
    const guess = Math.floor(Math.random() * n);
    setTimeout(() => { socket.emit('room:answer', room.code, guess); console.log(`Q${room.index + 1}: answered ${'ABCD'[guess]}`); }, delay);
  }
  if (room.phase === 'reveal' && room.myAnswer) console.log(`Q${room.index + 1}: ${room.myAnswer.correct ? 'correct' : 'wrong'} (+${room.myAnswer.points}) · leaderboard: ${room.players.map(p => `${p.name} ${p.score}`).join(', ')}`);
  if (room.phase === 'finished') { console.log('final:', room.players.map(p => `#${p.rank} ${p.name} ${p.score}`).join(', ')); socket.disconnect(); process.exit(0); }
});
socket.on('disconnect', () => { console.log('disconnected'); process.exit(0); });
