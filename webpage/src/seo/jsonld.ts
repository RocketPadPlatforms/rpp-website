import {
  absoluteUrl,
  BRAND,
  CONTACT_EMAIL,
  LEGAL_NAME,
  SITE_URL,
} from "../config/site";
import { Locale, LOCALES, lookup, translate } from "../i18n";
import { Page, pagePath } from "../routes/pages";

const ORG_ID = `${SITE_URL}/#organization`;
const WEBSITE_ID = `${SITE_URL}/#website`;

const SAME_AS = [
  "https://www.linkedin.com/company/rocket-pad-platforms-gmbh",
  "https://github.com/RocketPadPlatforms",
];

// Order matches the team section: the managing director first.
const PEOPLE = [
  {
    slug: "kilian-mehringer",
    name: "Kilian Mehringer",
    roleKey: "home.team.kilianRole",
  },
  {
    slug: "alexander-weidemann",
    name: "Alexander Weidemann",
    roleKey: "home.team.alexanderRole",
  },
];

const ADDRESS = {
  "@type": "PostalAddress",
  streetAddress: "Wallstr. 16",
  postalCode: "40878",
  addressLocality: "Ratingen",
  addressCountry: "DE",
};

interface FaqItem {
  q: string;
  a: string;
}

function personId(slug: string): string {
  return `${SITE_URL}/#${slug}`;
}

function organization(): Record<string, unknown> {
  return {
    "@type": "Organization",
    "@id": ORG_ID,
    name: BRAND,
    legalName: LEGAL_NAME,
    alternateName: "RPP",
    url: absoluteUrl("/"),
    logo: {
      "@type": "ImageObject",
      url: absoluteUrl("/assets/img/rocket-pad-platforms-logo.png"),
      width: 640,
      height: 640,
    },
    image: absoluteUrl("/assets/img/og-default.png"),
    email: CONTACT_EMAIL,
    address: ADDRESS,
    sameAs: SAME_AS,
    employee: PEOPLE.map((person) => ({ "@id": personId(person.slug) })),
  };
}

function people(locale: Locale): Record<string, unknown>[] {
  return PEOPLE.map((person) => ({
    "@type": "Person",
    "@id": personId(person.slug),
    name: person.name,
    jobTitle: translate(locale, person.roleKey),
    worksFor: { "@id": ORG_ID },
  }));
}

function professionalService(
  locale: Locale,
  url: string,
): Record<string, unknown> {
  return {
    "@type": "ProfessionalService",
    "@id": `${SITE_URL}/#service`,
    name: BRAND,
    url,
    description: translate(locale, "pages.home.description"),
    image: absoluteUrl("/assets/img/og-default.png"),
    email: CONTACT_EMAIL,
    address: ADDRESS,
    areaServed: { "@type": "Place", name: "Europe" },
    parentOrganization: { "@id": ORG_ID },
    knowsAbout: [
      "Kubernetes",
      "GitOps",
      "Platform Engineering",
      "Cloud Engineering",
      "DevOps",
      "Sovereign Cloud",
    ],
  };
}

function faqPage(locale: Locale, url: string): Record<string, unknown> {
  const items = lookup(locale, "faq.items") as FaqItem[];
  return {
    "@type": "FAQPage",
    "@id": `${url}#faq`,
    url,
    inLanguage: locale,
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      // Google accepts a small set of HTML tags in answers, <a> among them.
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}

/**
 * The JSON-LD graph for a page. It is emitted as a
 * <script type="application/ld+json"> data block, which browsers never
 * execute, so the strict script-src 'self' policy does not apply to it.
 */
export function jsonLd(
  page: Page,
  locale: Locale,
  title: string,
  description: string,
): string {
  const url = absoluteUrl(pagePath(page, locale));

  const graph: Record<string, unknown>[] = [
    organization(),
    {
      "@type": "WebSite",
      "@id": WEBSITE_ID,
      url: absoluteUrl("/"),
      name: BRAND,
      inLanguage: [...LOCALES],
      publisher: { "@id": ORG_ID },
    },
    ...people(locale),
    {
      "@type": "WebPage",
      "@id": `${url}#webpage`,
      url,
      name: title,
      description,
      inLanguage: locale,
      isPartOf: { "@id": WEBSITE_ID },
      about: { "@id": ORG_ID },
    },
  ];

  if (page.id === "home") {
    graph.push(professionalService(locale, url));
  }
  if (page.id === "faq") {
    graph.push(faqPage(locale, url));
  }

  // "<" is escaped so that no string in the copy can close the script element.
  return JSON.stringify({
    "@context": "https://schema.org",
    "@graph": graph,
  }).replace(/</g, "\\u003c");
}
