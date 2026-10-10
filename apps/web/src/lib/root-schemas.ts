export const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "AuthHub",
  url: "https://authhub.co",
  logo: "https://authhub.co/authhub.png",
  description:
    "Client access platform for marketing agencies. Replace weeks of OAuth setup with a single 5-minute link.",
  sameAs: [
    "https://twitter.com/authhubco",
    "https://linkedin.com/company/authhub-platform",
  ],
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer support",
    url: "https://authhub.co/contact",
  },
};

export const webSiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "AuthHub",
  url: "https://authhub.co",
  description: "Client access platform for marketing agencies",
};
