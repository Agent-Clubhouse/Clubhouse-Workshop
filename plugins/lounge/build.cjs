/* eslint-disable @typescript-eslint/no-require-imports */
const esbuild = require('esbuild');
const path = require('path');

const watch = process.argv.includes('--watch');

const buildOptions = {
  entryPoints: [path.join(__dirname, 'src', 'main.ts')],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  external: ['react', 'react/jsx-runtime'],
  outfile: path.join(__dirname, 'dist', 'main.js'),
  // Force ESM resolution for zustand to avoid CJS require('react') at runtime
  conditions: ['import', 'module', 'browser'],
};

async function run() {
  if (watch) {
    const ctx = await esbuild.context(buildOptions);
    await ctx.watch();
    console.log('Watching for changes...');
  } else {
    await esbuild.build(buildOptions);
    console.log(`✓ Built → ${buildOptions.outfile}`);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
