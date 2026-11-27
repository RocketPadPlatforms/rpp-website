/**
 * Public origin of the site, used for every absolute URL a crawler sees:
 * canonical links, hreflang alternates, Open Graph tags, JSON-LD and the
 * sitemap. Those must never echo the request's Host header, or a staging or
 * spoofed host would end up canonicalised.
 */
export const SITE_URL = (
  process.env.SITE_URL ?? "https://rocketpadplatforms.de"
).replace(/\/+$/, "");

export const BRAND = "Rocket Pad Platforms";
export const LEGAL_NAME = "Rocket Pad Platforms GmbH";
export const CONTACT_EMAIL = "hello@rpp.gmbh";

export function absoluteUrl(pathname: string): string {
  return `${SITE_URL}${pathname}`;
}
