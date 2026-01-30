import { build } from 'esbuild';
import { readFileSync } from 'fs';
import { glob } from 'glob';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));

// Discover all TypeScript entry points like Astro does
const patterns = ['src/**/*.ts'];
const entryPoints = [].concat(
  ...(await Promise.all(
    patterns.map((pattern) =>
      glob(pattern, { filesOnly: true, expandDirectories: false, absolute: true })
    )
  ))
);

console.log('📦 Found entry points:', entryPoints.map(p => p.replace(process.cwd() + '/', '')));

// Single build with automatic entry point discovery - just like Astro does it
await build({
  entryPoints,
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  minify: true,
  sourcemap: true,
  outdir: 'dist',
  external: [
    'astro',
    'astro/app',
    '@scaleway/serverless-functions',
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.peerDependencies || {})
  ],
});

console.log('✅ Build completed successfully');