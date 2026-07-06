import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const articleSchema = z.object({
  title: z.string(),
  description: z.string().default(''),
  date: z.coerce.date(),
  tags: z.array(z.string()).default([]),
  draft: z.boolean().default(false),
  cover: z.string().optional()
});

const lifeNoteSchema = articleSchema.extend({
  mood: z.string().optional()
});

const profileSchema = z.object({
  title: z.string(),
  draft: z.boolean().default(false)
});

export const collections = {
  learn: defineCollection({
    loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/learn' }),
    schema: articleSchema
  }),
  essays: defineCollection({
    loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/life/essays' }),
    schema: lifeNoteSchema
  }),
  profile: defineCollection({
    loader: glob({ pattern: 'home.md', base: './src/content/profile' }),
    schema: profileSchema
  })
};
