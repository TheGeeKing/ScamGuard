export type TextRuleMatch = {
  id: string;
  name: string;
};

const rules: (TextRuleMatch & { pattern: RegExp })[] = [
  {
    id: "cash-for-steam",
    name: "Cash for Steam",
    pattern: /\b\d+\$\s+for\s+steam\b/i,
  },
  {
    id: "steam-gift-cash",
    name: "Steam gift cash",
    pattern: /\bsteam\s+gift\s+\d+\$/i,
  },
  { id: "everyone-mention", name: "Everyone mention", pattern: /@everyone/i },
  { id: "here-mention", name: "Here mention", pattern: /@here/i },
  {
    id: "steam-cash",
    name: "Steam and cash",
    pattern: /steam.*\d+\$|\d+\$.*steam/i,
  },
  { id: "cash-gift", name: "Cash gift", pattern: /\b\d+\$\s+gift\b/i },
  {
    id: "telegram-username",
    name: "Telegram username",
    pattern: /\btelegram\b\susername/i,
  },
  {
    id: "north-american-phone",
    name: "North American phone number",
    pattern: /\+\s*1\s*\(\s*\d{3}\s*\)\s*\d{3}\s*-\s*\d{4}/i,
  },
  { id: "ask-me-how", name: "Ask me how", pattern: /ask me\s*\(how\)/i },
  {
    id: "limited-people-offer",
    name: "Limited people offer",
    pattern: /the first\s+\d+\s+people/i,
  },
  {
    id: "earnings-promise",
    name: "Earnings promise",
    pattern: /how to start earning\s*\$\d+k/i,
  },
  {
    id: "remote-hiring",
    name: "Remote hiring",
    pattern: /hiring:\s*.*\(\s*remote\s*\)/i,
  },
  {
    id: "cash-whatsapp",
    name: "Cash and WhatsApp",
    pattern: /\$\d+\s*.*whatsapp/i,
  },
  {
    id: "cash-telegram",
    name: "Cash and Telegram",
    pattern: /\$\d+\s*.*telegram/i,
  },
  { id: "hey-babe", name: "Hey babe", pattern: /hey babe/i },
];

export function matchTextRules(content: string): TextRuleMatch[] {
  const normalized = content.normalize("NFKC").replace(/\s+/g, " ");
  return rules.flatMap(({ id, name, pattern }) =>
    pattern.test(normalized) ? [{ id, name }] : [],
  );
}
