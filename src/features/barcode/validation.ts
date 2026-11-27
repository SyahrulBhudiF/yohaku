import type { BarcodeFormat } from "@/libs/schemas/barcode"

export type BarcodeValueResult =
  | { readonly ok: true; readonly value: string }
  | { readonly ok: false; readonly message: string }

const isDigits = (value: string) => /^\d+$/.test(value)

const ean13CheckDigit = (base: string) => {
  let sum = 0

  for (let index = 0; index < base.length; index += 1) {
    sum += Number(base[index]) * (index % 2 === 0 ? 1 : 3)
  }

  return (10 - (sum % 10)) % 10
}

const upcaCheckDigit = (base: string) => {
  let sum = 0

  for (let index = 0; index < base.length; index += 1) {
    sum += Number(base[index]) * (index % 2 === 0 ? 3 : 1)
  }

  return (10 - (sum % 10)) % 10
}

/**
 * Normalize a barcode value before encoding. EAN-13 and UPC-A accept the
 * human-readable digits without the check digit and add it; when the check
 * digit is supplied it must match.
 */
export const normalizeBarcodeValue = (format: BarcodeFormat, raw: string): BarcodeValueResult => {
  const value = raw.trim()

  if (!value) return { ok: false, message: "Enter a value to encode." }

  if (format === "code128") {
    if (value.length > 128) {
      return { ok: false, message: "Keep Code 128 values under 128 characters." }
    }

    if (
      Array.from(value).some((character) => {
        const code = character.codePointAt(0) ?? 0

        return code < 32 || code > 126
      })
    ) {
      return { ok: false, message: "Code 128 supports printable ASCII text only." }
    }

    return { ok: true, value }
  }

  const expectedLength = format === "ean13" ? 12 : 11
  const checkLength = expectedLength + 1

  if (!isDigits(value) || (value.length !== expectedLength && value.length !== checkLength)) {
    return {
      ok: false,
      message:
        format === "ean13"
          ? "EAN-13 uses 12 digits; the 13th check digit is added automatically."
          : "UPC-A uses 11 digits; the 12th check digit is added automatically.",
    }
  }

  const base = value.slice(0, expectedLength)
  const checkDigit = format === "ean13" ? ean13CheckDigit(base) : upcaCheckDigit(base)
  const normalized = `${base}${checkDigit}`

  if (value.length === checkLength && Number(value[checkLength - 1]) !== checkDigit) {
    return {
      ok: false,
      message: `The check digit should be ${checkDigit}. Remove it and let the tool add it, or correct it.`,
    }
  }

  return { ok: true, value: normalized }
}
