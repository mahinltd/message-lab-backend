/**
 * Phone number validation and normalization utility.
 * Supports Bangladeshi mobile numbers primarily,
 * with basic international support.
 */

export interface PhoneValidationResult {
  isValid: boolean;
  normalized: string | null;
  original: string;
  reason?: string;
}

/**
 * Validate and normalize a Bangladeshi mobile number.
 * Accepted formats:
 *   01711111111
 *   8801711111111
 *   +8801711111111
 *   01711-111111
 */
export function normalizeBdPhone(input: string): PhoneValidationResult {
  const original = input.trim();

  // Remove all non-digit characters except leading +
  let cleaned = original.replace(/[^\d+]/g, "");

  // Remove leading + for processing
  if (cleaned.startsWith("+")) {
    cleaned = cleaned.substring(1);
  }

  // Handle different prefixes
  let nationalNumber = "";

  if (cleaned.startsWith("880")) {
    nationalNumber = cleaned.substring(3);
  } else if (cleaned.startsWith("0")) {
    nationalNumber = cleaned.substring(1);
  } else if (cleaned.length === 10) {
    nationalNumber = cleaned;
  } else {
    return {
      isValid: false,
      normalized: null,
      original,
      reason: "Invalid number format",
    };
  }

  // Bangladeshi mobile: 11 digits starting with 01[3-9]
  // After removing country code: 10 digits starting with 1[3-9]
  if (nationalNumber.length !== 10) {
    return {
      isValid: false,
      normalized: null,
      original,
      reason: "Number must be 11 digits (e.g., 01711111111)",
    };
  }

  if (!nationalNumber.startsWith("1")) {
    return {
      isValid: false,
      normalized: null,
      original,
      reason: "Number must start with 01",
    };
  }

  const operatorDigit = nationalNumber[1];
  if (!["3", "4", "5", "6", "7", "8", "9"].includes(operatorDigit)) {
    return {
      isValid: false,
      normalized: null,
      original,
      reason: "Invalid operator prefix",
    };
  }

  const normalized = `+880${nationalNumber}`;

  return {
    isValid: true,
    normalized,
    original,
  };
}

/**
 * Parse a comma-separated list of phone numbers.
 * Returns valid, invalid, and duplicate lists.
 */
export function parseRecipientList(input: string): {
  valid: string[];
  invalid: { original: string; reason: string }[];
  duplicates: string[];
  totalInput: number;
} {
  const rawNumbers = input
    .split(/[,\n;]+/)
    .map((n) => n.trim())
    .filter((n) => n.length > 0);

  const totalInput = rawNumbers.length;
  const seen = new Set<string>();
  const valid: string[] = [];
  const invalid: { original: string; reason: string }[] = [];
  const duplicates: string[] = [];

  for (const raw of rawNumbers) {
    const result = normalizeBdPhone(raw);

    if (!result.isValid) {
      invalid.push({
        original: result.original,
        reason: result.reason || "Invalid number",
      });
      continue;
    }

    const normalized = result.normalized!;

    if (seen.has(normalized)) {
      duplicates.push(normalized);
      continue;
    }

    seen.add(normalized);
    valid.push(normalized);
  }

  return { valid, invalid, duplicates, totalInput };
}

/**
 * Calculate estimated SMS parts based on content.
 * GSM 7-bit: 160 chars single, 153 chars per part (concatenated)
 * Unicode: 70 chars single, 67 chars per part (concatenated)
 */
export function calculateSmsParts(message: string): {
  parts: number;
  encoding: "gsm7" | "unicode";
  charsPerPart: number;
} {
  // Check if message contains non-GSM characters (Bengali, emoji, etc.)
  const gsm7Pattern = /^[\u0000-\u007F\u00A0-\u00FF\u20AC]*$/;
  const isGsm7 = gsm7Pattern.test(message);

  if (isGsm7) {
    const length = message.length;
    if (length <= 160) {
      return { parts: 1, encoding: "gsm7", charsPerPart: 160 };
    }
    return {
      parts: Math.ceil(length / 153),
      encoding: "gsm7",
      charsPerPart: 153,
    };
  } else {
    const length = message.length;
    if (length <= 70) {
      return { parts: 1, encoding: "unicode", charsPerPart: 70 };
    }
    return {
      parts: Math.ceil(length / 67),
      encoding: "unicode",
      charsPerPart: 67,
    };
  }
}