type RuntimeBindings = {
  env?: Env;
  runtime?: { env?: Env };
};

function bindings(locals: App.Locals) {
  const runtime = locals.runtime as unknown as RuntimeBindings | undefined;
  return runtime?.env ?? runtime?.runtime?.env;
}

export function getEnv(locals: App.Locals): Env {
  const env = bindings(locals);
  if (!env?.HYDROXY_DB || !env?.HYDROXY_MEDIA) {
    throw new Error('Cloudflare D1 and R2 bindings are required. Use `wrangler pages dev` locally.');
  }
  return env;
}

export function getOptionalEnv(locals: App.Locals): Partial<Env> {
  return bindings(locals) ?? {};
}

export function mediaHref(key?: string | null) {
  return key ? '/media/' + key.split('/').map(encodeURIComponent).join('/') : undefined;
}
