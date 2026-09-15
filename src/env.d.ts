/// <reference types="astro/client" />

import type { D1Database, R2Bucket } from '@cloudflare/workers-types';

declare global {
  interface Env {
    HYDROXY_DB: D1Database;
    HYDROXY_MEDIA: R2Bucket;
    CF_ACCESS_TEAM_DOMAIN?: string;
    CF_ACCESS_AUD?: string;
    ADMIN_EMAILS?: string;
  }

  namespace App {
    interface Locals {
      runtime: import('@astrojs/cloudflare').Runtime<Env>;
    }
  }
}

export {};
