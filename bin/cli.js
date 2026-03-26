#!/usr/bin/env node

/**
 * Pageel CMS CLI
 * 
 * Usage:
 *   npx pageel-cms hash <password>    Generate bcrypt hash for CMS_PASS_HASH
 *   npx pageel-cms hash               Interactive mode (hidden input)
 */

import { hash } from 'bcryptjs';
import { createInterface } from 'node:readline';

const COST = 12;
const [,, command, value] = process.argv;

async function generateHash(password) {
  const hashed = await hash(password, COST);
  console.log('');
  console.log('✅ Bcrypt hash generated (cost factor: %d)', COST);
  console.log('');
  console.log('   %s', hashed);
  console.log('');
  console.log('Add to your .env file:');
  console.log('   CMS_PASS_HASH="%s"', hashed);
  console.log('');
  console.log('⚠️  Wrap in double quotes to prevent shell $-expansion.');
}

async function interactiveHash() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  
  return new Promise((resolve) => {
    // Note: readline doesn't support hidden input natively
    // Users wanting hidden input should use: npx pageel-cms hash "$(read -s -p 'Password: ' pw && echo $pw)"
    rl.question('Enter password: ', async (password) => {
      rl.close();
      if (!password) {
        console.error('❌ Password cannot be empty.');
        process.exit(1);
      }
      await generateHash(password);
      resolve();
    });
  });
}

function showHelp() {
  console.log('');
  console.log('  Pageel CMS CLI v2.0.0');
  console.log('');
  console.log('  Usage:');
  console.log('    npx pageel-cms hash <password>   Generate bcrypt hash');
  console.log('    npx pageel-cms hash              Interactive mode');
  console.log('    npx pageel-cms --help             Show this help');
  console.log('');
  console.log('  Examples:');
  console.log('    npx pageel-cms hash mysecretpass');
  console.log('    npx pageel-cms hash "my pass with spaces"');
  console.log('');
}

// --- Main ---

if (!command || command === '--help' || command === '-h') {
  showHelp();
  process.exit(0);
}

if (command === 'hash') {
  if (value) {
    generateHash(value).catch(console.error);
  } else {
    interactiveHash().catch(console.error);
  }
} else {
  console.error('❌ Unknown command: %s', command);
  showHelp();
  process.exit(1);
}
