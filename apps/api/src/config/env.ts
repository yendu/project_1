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
  // Comma-separated. Empty means no cross-origin access.
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
  // Tokens are only accepted for this project. Not a secret.
  FIREBASE_PROJECT_ID: z.string().regex(/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/, {
    error: 'Must be a Firebase project ID such as demo-food-delivery',
  }),
  // The first admin: this address becomes an admin on first sign-in.
  ADMIN_EMAIL: z
    .email()
    .max(254)
    .transform((value) => value.toLowerCase())
    .optional(),
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
