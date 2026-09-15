export const prerender = false;

export function GET({ request }: { request: Request }) {
  const origin = new URL(request.url).origin;
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>${origin}/sitemap.xml</loc></sitemap></sitemapindex>`, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'no-store' } });
}