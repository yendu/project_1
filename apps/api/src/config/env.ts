import { z } from 'zod';

// Browsers send the Origin header in exactly this form: scheme, lowercase host, optional port.
const corsOrigin = z
  .string()
  .refine((value) => URL.canParse(value) && new URL(value).origin === value, {
    message: 'Must be an exact origin such as https://dashboard.example.com',
  });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  // Comma-separated. Empty means no cross-origin access; mobile apps don't need CORS.
  CORS_ORIGINS: z
    .string()
    .max(2_000)
    .default('')
    .transform((value) =>
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    )
    .pipe(z.array(corsOrigin).max(20)),
  // Required everywhere; holds the database password.
  DATABASE_URL: z
    .url({
      protocol: /^postgres(ql)?$/,
      error: 'Must be a postgres:// or postgresql:// URL',
    })
    .max(2_000),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validates the environment once at startup. The only place that reads `process.env`.
 * Error messages name the variable but never echo its value, which may be a secret.
 */
export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`,
    );
    throw new Error(`Invalid environment variables. ${problems.join('; ')}`);
  }
  return result.data;
}
