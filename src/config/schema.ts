import { z } from 'zod';

const routeSchema = z.object({
  path: z.string().min(1, 'Route path cannot be empty'),
  name: z.string().min(1, 'Route name cannot be empty'),
  waitFor: z.enum(['domcontentloaded', 'load', 'networkidle']).optional(),
});

const authSchema = z.object({
  type: z.enum(['cookie', 'header']),
  name: z.string().min(1),
  value: z.string().min(1),
});

const outputSchema = z.object({
  dir: z.string().default('./a11y-reports'),
  formats: z.array(z.enum(['json', 'html', 'terminal'])).default(['terminal']),
  embedScreenshots: z.boolean().default(true),
});

const thresholdsSchema = z.object({
  maxCritical: z.number().int().min(0),
  maxMajor: z.number().int().min(0),
});

export const sentinelConfigSchema = z.object({
  baseUrl: z.string().url('baseUrl must be a valid URL'),
  auth: authSchema.optional(),
  routes: z.array(routeSchema).min(1, 'At least one route is required'),
  thresholds: thresholdsSchema.optional(),
  output: outputSchema.optional().default({
    dir: './a11y-reports',
    formats: ['terminal'],
    embedScreenshots: true,
  }),
  excludeRules: z.array(z.string()).optional().default([]),
});

export type ValidatedConfig = z.infer<typeof sentinelConfigSchema>;
