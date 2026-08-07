function databaseUrl() {
  const value = process.env.DATABASE_URL ||
    process.env.NEON_DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    '';
  const trimmed = String(value).trim();
  const psqlMatch = trimmed.match(/^psql\s+['"](.+)['"]$/i);
  if (psqlMatch) return psqlMatch[1];
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

module.exports = { databaseUrl };
