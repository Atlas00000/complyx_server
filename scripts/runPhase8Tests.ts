/**
 * Phase 8 testing: Integration & regression.
 * Run: cd server && pnpm exec tsx scripts/runPhase8Tests.ts
 *
 * Runs Phase 1 (DB + seeds), Phase 3 (assessment flow engine), and Phase 7 (contextual answers)
 * in sequence. Does not require the server. For full integration (Phase 2, 4, 5, 6) start the
 * server and run: pnpm run test:phase2 && pnpm run test:phase5 && pnpm run test:phase6
 */
import { execSync } from 'child_process';
import path from 'path';

const serverDir = path.resolve(__dirname, '..');

function run(cmd: string): void {
  execSync(cmd, { cwd: serverDir, stdio: 'inherit' });
}

function main(): void {
  console.log('🧪 Phase 8: Integration & regression\n');
  console.log('Running Phase 1 (DB + seeds), Phase 3 (flow engine), Phase 7 (contextual)...\n');

  console.log('--- Phase 1: Backend & question bank ---');
  run('pnpm run test:phase1');
  console.log('');

  console.log('--- Phase 3: Assessment flow engine ---');
  run('pnpm run test:phase3');
  console.log('');

  console.log('--- Phase 7: Contextual answers ---');
  run('pnpm run test:phase7');
  console.log('');

  console.log('✅ Phase 8 (Integration & regression) passed.');
}

main();
