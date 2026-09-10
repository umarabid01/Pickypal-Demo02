// ============================================================
// PickyPal — Onboarding validators
// Deterministic (non-AI) checks for the name/phone/address steps
// so onboarding never depends on an LLM call succeeding, and the
// user always gets a clear, consistent "please try again" message.
// ============================================================

// Allows English letters, Urdu/Arabic script, spaces, dots, and
// hyphens/apostrophes (for names like "O'Brien" or "Ali-Raza").
const NAME_RE = /^[A-Za-z\u0600-\u06FF][A-Za-z\u0600-\u06FF\s.'-]{1,49}$/;

export function validateName(raw) {
  const name = (raw || "").trim().replace(/\s+/g, " ");
  if (!name) return { valid: false, reason: "empty" };
  if (name.length < 2 || name.length > 50) return { valid: false, reason: "length" };
  if (!NAME_RE.test(name)) return { valid: false, reason: "format" };
  // Reject names that are only a single repeated character or all-numeric-looking
  if (/^\d+$/.test(name.replace(/[\s.'-]/g, ""))) return { valid: false, reason: "format" };
  return { valid: true, value: name };
}

// Pakistani mobile numbers: 03XXXXXXXXX (11 digits), +923XXXXXXXXX,
// 00923XXXXXXXXX, or 923XXXXXXXXX. Normalizes to 03XXXXXXXXX.
export function validatePhone(raw) {
  const digitsOnly = (raw || "").replace(/[^\d+]/g, "");
  let normalized = digitsOnly;

  if (normalized.startsWith("+92")) normalized = "0" + normalized.slice(3);
  else if (normalized.startsWith("0092")) normalized = "0" + normalized.slice(4);
  else if (normalized.startsWith("92") && normalized.length === 12) normalized = "0" + normalized.slice(2);

  if (!/^03\d{9}$/.test(normalized)) {
    return { valid: false, reason: "format" };
  }
  return { valid: true, value: normalized };
}

const ADDRESS_SKIP_WORDS = new Set(["skip", "none", "n/a", "na"]);

export function validateAddress(raw) {
  const address = (raw || "").trim().replace(/\s+/g, " ");
  if (!address) return { valid: false, reason: "empty" };
  if (ADDRESS_SKIP_WORDS.has(address.toLowerCase())) {
    return { valid: false, reason: "required" };
  }
  if (address.length < 10) return { valid: false, reason: "length" };
  // A real delivery address should have at least one digit (house/street
  // number) or be reasonably descriptive (multiple words).
  const hasDigit = /\d/.test(address);
  const wordCount = address.split(" ").length;
  if (!hasDigit && wordCount < 3) return { valid: false, reason: "vague" };
  return { valid: true, value: address };
}

const NO_ALLERGY_PHRASES = [
  "none",
  "no",
  "nope",
  "n/a",
  "na",
  "nothing",
  "no allergies",
  "no allergy",
  "nahi",
  "nai",
  "koi nahi",
  "kuch nahi",
  "koi allergy nahi",
];

// Returns true if the message is a clear "I have no allergies" response,
// so we can skip the AI extraction call entirely for that common case.
export function isNoAllergyResponse(raw) {
  const text = (raw || "").trim().toLowerCase().replace(/[.!]+$/g, "");
  return NO_ALLERGY_PHRASES.includes(text);
}
