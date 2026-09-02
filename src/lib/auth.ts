import { createRemoteJWKSet, jwtVerify } from 'jose';
import { getOptionalEnv } from './runtime';

const jwksByDomain = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function readAllowedEmails(value?: string) {
  return new Set((value ?? '').split(',').map((email) => email.trim().toLowerCase()).filter(Boolean));
}

export async function requireAdmin(request: Request, locals: App.Locals) {
  const env = getOptionalEnv(locals);
  const domain = env.CF_ACCESS_TEAM_DOMAIN;
  const audience = env.CF_ACCESS_AUD;
  const allowedEmails = readAllowedEmails(env.ADMIN_EMAILS);
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) return new Response('Cloudflare Access authentication is required.', { status: 401 });
  if (!domain || !audience || !allowedEmails.size) return new Response('Cloudflare Access is not configured.', { status: 503 });
  const normalizedDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
  let jwks = jwksByDomain.get(normalizedDomain);
  if (!jwks) { jwks = createRemoteJWKSet(new URL(`https://${normalizedDomain}/cdn-cgi/access/certs`)); jwksByDomain.set(normalizedDomain, jwks); }
  try {
    const { payload } = await jwtVerify(token, jwks, { audience });
    const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : '';
    return email && allowedEmails.has(email) ? { email } : new Response('This Access identity is not an administrator.', { status: 403 });
  } catch { return new Response('Invalid Cloudflare Access token.', { status: 401 }); }
}

export function requireSameOrigin(request: Request) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) return null;
  const origin = request.headers.get('Origin');
  return origin && origin === new URL(request.url).origin ? null : new Response('Cross-origin mutation rejected.', { status: 403 });
}