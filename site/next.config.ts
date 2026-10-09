import path from 'node:path';
import type { NextConfig } from 'next';

// A static site for GitHub Pages at https://tour-planner.iamsaeed.dev, one prerendered page per language.
// The route demo runs the phone app's own planner, imported from ../mobile, so the root is the repository.
const base = process.env.PAGES_BASE ?? '';
const config: NextConfig = {
  output: 'export',
  basePath: base,
  env: { NEXT_PUBLIC_BASE: base },
  trailingSlash: true,
  images: { unoptimized: true },
  turbopack: { root: path.join(import.meta.dirname, '..') },
};

export default config;
