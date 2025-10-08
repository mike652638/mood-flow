#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const input = process.argv[2] || 'dist/meta/release-notes.md';
let text = '';
try { text = fs.readFileSync(path.resolve(input), 'utf8'); }
catch (e) { console.log('修复与优化若干问题'); process.exit(0); }

// Prefer lines under "## Changes" section; fallback to top-level bullets
const lines = text.split(/\r?\n/);
let collecting = false;
let bullets = [];
for (const line of lines) {
  if (/^##\s+Changes\b/i.test(line) || /^##\s+Changes Since/i.test(line)) { collecting = true; continue; }
  if (/^##\s+/.test(line) && collecting) break; // next section
  if (collecting && /^-\s+/.test(line)) bullets.push(line.replace(/^-\s+/, '').trim());
}
if (bullets.length === 0) bullets = lines.filter(l => /^-\s+/.test(l)).map(l => l.replace(/^-\s+/, '').trim());
if (bullets.length === 0) {
  // fallback to first non-empty lines after title
  bullets = lines.filter(l => l.trim() && !/^#/.test(l)).slice(0, 3).map(l => l.trim());
}
bullets = bullets.slice(0, 5).map(s => s.replace(/[`"']/g, '').replace(/\s+/g, ' '));
const summary = bullets.length ? bullets.join(' • ') : '修复与优化若干问题';
process.stdout.write(summary);