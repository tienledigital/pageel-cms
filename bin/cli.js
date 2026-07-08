#!/usr/bin/env node

/**
 * Pageel CMS CLI
 * 
 * Usage:
 *   npx pageel-cms hash <password>    Generate PBKDF2 hash for CMS_PASS_HASH
 *   npx pageel-cms hash               Interactive mode (hidden input)
 */

import { webcrypto } from 'node:crypto';
import { createInterface } from 'node:readline';

const crypto = webcrypto;
const [,, command, value] = process.argv;

async function hashPBKDF2(password) {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);
  
  // Generate random 16-byte salt
  const salt = crypto.getRandomValues(new Uint8Array(16));
  
  const baseKey = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
  
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    baseKey,
    256 // 32 bytes (256 bits)
  );
  
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  const hashHex = Array.from(new Uint8Array(derivedBits)).map(b => b.toString(16).padStart(2, '0')).join('');
  
  return `pbkdf2:100000:${saltHex}:${hashHex}`;
}

async function generateHash(password) {
  const hashed = await hashPBKDF2(password);
  console.log('');
  console.log('✅ PBKDF2 hash generated (iterations: 100000, sha256)');
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
  console.log('  Pageel CMS CLI v2.3.0');
  console.log('');
  console.log('  Usage:');
  console.log('    npx pageel-cms hash <password>   Generate PBKDF2 hash');
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
