/**
 * The business's own social pages (footer "Follow us"). Admin-editable under Homepage; every link must be
 * https on the platform's own domain, so a typo or a pasted tracking redirect can't send visitors elsewhere.
 */
export interface SocialLinks {
  facebook: string;
  whatsappChannel: string;
  instagram: string;
  tiktok: string;
}

export type SocialKey = keyof SocialLinks;

export const SOCIAL_HOSTS: Record<SocialKey, RegExp> = {
  facebook: /(?:^|\.)(?:facebook\.com|fb\.com|fb\.me)$/i,
  whatsappChannel: /^(?:www\.)?whatsapp\.com$/i,
  instagram: /(?:^|\.)instagram\.com$/i,
  tiktok: /(?:^|\.)tiktok\.com$/i,
};

export const SOCIAL_LABEL: Record<SocialKey, string> = {
  facebook: "Facebook",
  whatsappChannel: "WhatsApp channel",
  instagram: "Instagram",
  tiktok: "TikTok",
};

/** The Facebook page and WhatsApp channel the owner gave us; used until Admin → Homepage changes them. */
export const DEFAULT_SOCIAL: SocialLinks = {
  facebook: "https://www.facebook.com/share/1FJPrwXmzL/",
  whatsappChannel: "https://whatsapp.com/channel/0029Vb8xIEK2ER6fm4ZXoG2n",
  instagram: "",
  tiktok: "",
};

export function socialLinkProblem(key: SocialKey, value: string): string | null {
  if (!value) return null;
  let u: URL;
  try {
    u = new URL(value);
  } catch {
    return `Paste the full ${SOCIAL_LABEL[key]} link, starting with https://`;
  }
  if (u.protocol !== "https:" || !SOCIAL_HOSTS[key].test(u.hostname)) {
    return `That doesn't look like a ${SOCIAL_LABEL[key]} link. Copy it from the page's Share menu.`;
  }
  return null;
}

/** Only valid, non-empty links, in display order. */
export function socialLinkList(links: Partial<SocialLinks> | null | undefined): { key: SocialKey; label: string; href: string }[] {
  return (Object.keys(SOCIAL_LABEL) as SocialKey[]).flatMap((key) => {
    const href = (links?.[key] ?? "").trim();
    return href && !socialLinkProblem(key, href) ? [{ key, label: SOCIAL_LABEL[key], href }] : [];
  });
}
