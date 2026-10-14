/**
 * Backend Configuration & Environment Secrets
 * Configured specifically for Google Gemini as the dedicated AI engine.
 */

const path = require('path');
const fs = require('fs');

function parseEnvFile(filePath) {
  const result = {};
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    content.split('\n').forEach(line => {
      line = line.trim();
      if (line && !line.startsWith('#') && line.includes('=')) {
        const idx = line.indexOf('=');
        const key = line.slice(0, idx).trim();
        const val = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
        result[key] = val;
        process.env[key] = val;
      }
    });
  }
  return result;
}

// 1. Load Backend Private Environment
const backendEnvPath = path.join(__dirname, '.env');
const rootEnvPath = path.join(__dirname, '..', '.env');
parseEnvFile(backendEnvPath);
parseEnvFile(rootEnvPath);

// 2. Load Frontend Public Environment
const frontendEnvPath = path.join(__dirname, '..', 'frontend', '.env');
const frontendConfig = parseEnvFile(frontendEnvPath);

module.exports = {
  PORT: process.env.PORT || 3000,
  FRONTEND_DIR: path.join(__dirname, '..', 'frontend'),
  
  // Supabase Database Config
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_KEY: process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  
  // 🌟 Google Gemini Configuration (Dedicated)
  AI_PROVIDER: 'gemini',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
  
  ENVIRONMENT: process.env.NODE_ENV || 'development',

  // Public Frontend Configuration
  FRONTEND_PUBLIC_CONFIG: {
    apiUrl: frontendConfig.PUBLIC_API_URL || frontendConfig.VITE_API_BASE_URL || `http://localhost:${process.env.PORT || 3000}`,
    supabaseUrl: process.env.SUPABASE_URL || frontendConfig.VITE_SUPABASE_URL || '',
    aiProvider: 'gemini',
    geminiModel: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
    appTitle: 'Nexus AI Studio (Gemini Powered)',
    appVersion: '3.8',
    defaultTheme: 'dark'
  }
};
