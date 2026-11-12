#!/usr/bin/env node
/**
 * Pre-commit / CI secret scanner for VOICEUP AI.
 *
 * Fails the build if a tracked file looks like it contains a real credential.
 * This is a safety net, not a substitute for keeping secrets out of the repo
 * in the first place.
 *
 * Usage:  node scripts/check-secrets.mjs
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const RULES = [
  { name: 'Google API key',            re: /AIza[0-9A-Za-z_-]{35}/ },
  { name: 'OpenAI key',                re: /sk-[A-Za-z0-9]{20,}/ },
  { name: 'Groq key',                  re: /gsk_[A-Za-z0-9]{20,}/ },
  { name: 'OpenRouter key',            re: /sk-or-v1-[A-Za-z0-9]{20,}/ },
  { name: 'Sarvam key',                re: /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/ },
  { name: 'Private key block',         re: /-----BEGIN (RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/ },
  { name: 'Firebase service account',  re: /"type"\s*:\s*"service_account"/ },
  { name: 'AWS access key',            re: /AKIA[0-9A-Z]{16}/ },
  { name: 'GitHub token',              re: /gh[pousr]_[A-Za-z0-9]{30,}/ },
  { name: 'Slack token',               re: /xox[baprs]-[A-Za-z0-9-]{10,}/ },
  { name: 'JWT',                       re: /eyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}\./ }
];

const IGNORED_PATHS = [
  /node_modules\//, /\/lib\//, /\/dist\//, /package-lock\.json$/,
  /scripts\/check-secrets\.mjs$/, /docs\//, /README\.md$/
];

const FORBIDDEN_FILES = [
  /(^|\/)\.env$/,
  /(^|\/)\.env\.(?!example$)[A-Za-z0-9_.-]+$/,
  /serviceAccount.*\.json$/,
  /-firebase-adminsdk-.*\.json$/,
  /\.pem$/, /\.key$/, /\.p12$/, /\.pfx$/
];

let files = [];
try {
  files = execSync('git ls-files', { encoding: 'utf8' }).split('\n').filter(Boolean);
} catch {
  console.error('Not a git repository - run this from the project root.');
  process.exit(1);
}

let failures = 0;

for (const file of files) {
  if (FORBIDDEN_FILES.some((re) => re.test(file))) {
    console.error(`BLOCKED FILE  ${file}  (secret-bearing file must not be tracked)`);
    failures++;
    continue;
  }
  if (IGNORED_PATHS.some((re) => re.test(file))) continue;

  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue;
  }

  for (const rule of RULES) {
    const match = text.match(rule.re);
    if (!match) continue;
    const line = text.slice(0, match.index).split('\n').length;
    console.error(`LEAK  ${file}:${line}  ${rule.name}  ->  ${match[0].slice(0, 12)}...`);
    failures++;
  }
}

if (failures > 0) {
  console.error(`\n${failures} potential secret(s) found. Fix before committing.`);
  process.exit(1);
}

console.log(`Secret scan clean: ${files.length} tracked files inspected, 0 findings.`);
