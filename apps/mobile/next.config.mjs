import fs from 'fs';
import path from 'path';

// Load root .env if present so NEXT_PUBLIC_* / API_TOKEN stay in sync
try {
  const rootEnvPath = path.resolve(process.cwd(), '../../.env');
  if (fs.existsSync(rootEnvPath)) {
    const lines = fs.readFileSync(rootEnvPath, 'utf8').split('\n');
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eqIdx = line.indexOf('=');
      if (eqIdx > 0) {
        const key = line.slice(0, eqIdx).trim();
        const val = line.slice(eqIdx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
} catch (_) {
  // Ignore fs errors in edge build environments
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: process.cwd(),
  },
  env: {
    NEXT_PUBLIC_SERVER_URL: process.env.NEXT_PUBLIC_SERVER_URL || 'https://api.kiwi.itskrishna.live',
    NEXT_PUBLIC_API_TOKEN:
      process.env.NEXT_PUBLIC_API_TOKEN ||
      process.env.API_TOKEN ||
      'prod_2d1c280ec63bb2d788667661643162b357e86613f68b4fff0baf93549493a867',
  },
};

export default nextConfig;
