/**
 * Browsers only encode UTF-8 natively, and the target system reads Windows-1252: without this
 * conversion `Programación` arrives damaged. Bytes 0x80-0x9F are the only ones that differ from
 * Unicode code points.
 */
const HIGH_BYTES: ReadonlyMap<string, number> = new Map(
  Object.entries({
    '€': 0x80,
    '‚': 0x82,
    ƒ: 0x83,
    '„': 0x84,
    '…': 0x85,
    '†': 0x86,
    '‡': 0x87,
    ˆ: 0x88,
    '‰': 0x89,
    Š: 0x8a,
    '‹': 0x8b,
    Œ: 0x8c,
    Ž: 0x8e,
    '‘': 0x91,
    '’': 0x92,
    '“': 0x93,
    '”': 0x94,
    '•': 0x95,
    '–': 0x96,
    '—': 0x97,
    '˜': 0x98,
    '™': 0x99,
    š: 0x9a,
    '›': 0x9b,
    œ: 0x9c,
    ž: 0x9e,
    Ÿ: 0x9f,
  }),
);

const REPLACEMENT_BYTE = 0x3f; // "?"

export interface EncodedText {
  bytes: Uint8Array;
  /** Characters that do not exist in Windows-1252 and were replaced with `?`. */
  unmappable: string[];
}

export function encodeWindows1252(text: string): EncodedText {
  const bytes: number[] = [];
  const unmappable = new Set<string>();

  for (const character of text) {
    const code = character.codePointAt(0) ?? 0;
    const isSameAsUnicode = code <= 0x7f || (code >= 0xa0 && code <= 0xff);
    const byte = isSameAsUnicode ? code : HIGH_BYTES.get(character);
    if (byte === undefined) {
      unmappable.add(character);
      bytes.push(REPLACEMENT_BYTE);
    } else {
      bytes.push(byte);
    }
  }
  return { bytes: Uint8Array.from(bytes), unmappable: [...unmappable] };
}

/** Reads a file as UTF-8 when it truly is, and as Windows-1252 otherwise (what Excel writes). */
export function decodeCsvBytes(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}
