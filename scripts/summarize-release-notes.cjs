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
// Sanitize text to avoid introducing illegal JSON characters or quotes
function sanitize(s) {
  try {
    // Normalize Unicode to NFC to reduce composition issues
    s = s.normalize('NFC');
  } catch {}
  // Remove quotes/backticks and smart quotes
  s = s.replace(/[`"'“”‘’]/g, '');
  // Strip control characters (C0/C1) except common whitespace
  s = s.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
  // Collapse whitespace
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

bullets = bullets.slice(0, 5).map(sanitize);
const summary = bullets.length ? bullets.join(' • ') : '修复与优化若干问题';
process.stdout.write(sanitize(summary));