export function getEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    // console.warn(`Environment variable ${name} is not set`);
  }
  return value || '';
} 