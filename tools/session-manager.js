#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const CONFIG_DIR = path.resolve(".config");
const FILE = path.resolve(CONFIG_DIR, "session-manager.json");

function ensureConfig() {
  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
  if (!fs.existsSync(FILE)) {
    fs.writeFileSync(FILE, JSON.stringify({ sessions: [] }, null, 2));
  }
}

function load() {
  ensureConfig();
  const raw = fs.readFileSync(FILE, 'utf8');
  try { return JSON.parse(raw); } catch { return { sessions: [] }; }
}

function save(data) {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

function add(name) {
  const data = load();
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2,6);
  data.sessions.push({ id, name, status: 'pending', created_at: new Date().toISOString() });
  save(data);
  console.log(`Added session ${id} "${name}" with status pending`);
}

function update(id, status) {
  const data = load();
  const s = data.sessions.find(x => x.id === id);
  if (!s) { console.error('Session not found'); process.exit(1); }
  s.status = status;
  save(data);
  console.log(`Session ${id} updated to ${status}`);
}

function listAll() {
  const data = load();
  if (data.sessions.length === 0) {
    console.log("No sessions");
    return;
  }
  data.sessions.forEach(s => console.log(`${s.id} | ${s.name} | ${s.status} | ${s.created_at}`));
}

const args = process.argv.slice(2);
switch (args[0]) {
  case 'add':
    const name = args.slice(1).join(' ').trim();
    if (!name) { console.error("Please provide a session name."); process.exit(1); }
    add(name);
    break;
  case 'update':
    const id = args[1];
    const status = args[2];
    if (!id || !status) { console.error("Usage: update <id> <status>"); process.exit(1); }
    update(id, status);
    break;
  case 'list':
    listAll();
    break;
  default:
    console.log("Usage: node tools/session-manager.js [add|update|list] ...");
}
