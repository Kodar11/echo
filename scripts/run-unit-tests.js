import { execSync } from 'child_process';

const NODE_ABI = process.versions.modules;

function rebuildForNode() {
  console.log(`Rebuilding better-sqlite3 for Node ABI ${NODE_ABI}...`);
  execSync('npm rebuild better-sqlite3', { stdio: 'inherit' });
}

function restoreElectronBuild() {
  console.log('Restoring better-sqlite3 for Electron...');
  try {
    execSync('npm run rebuild:native', { stdio: 'inherit' });
  } catch (err) {
    console.error(
      'Failed to restore Electron build. Run `npm run rebuild:native` manually.'
    );
    throw err;
  }
}

function runTests() {
  console.log('Running unit tests...');
  execSync('npx vitest run src', { stdio: 'inherit' });
}

rebuildForNode();

let exitCode = 0;
try {
  runTests();
} catch (err) {
  exitCode = err.status || 1;
} finally {
  restoreElectronBuild();
}

process.exit(exitCode);
