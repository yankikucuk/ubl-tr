/**
 * UBL-TR e-İrsaliye profilleri (`cbc:ProfileID`).
 */
export const DespatchProfile = {
  /** Temel irsaliye — tek profil. */
  TEMEL: 'TEMELIRSALIYE',
} as const

/** Tanımlı e-İrsaliye profil kimlikleri. */
export type DespatchProfileId = (typeof DespatchProfile)[keyof typeof DespatchProfile]

/**
 * e-İrsaliye tipleri (`cbc:DespatchAdviceTypeCode`).
 */
export const DespatchType = {
  /** Olağan sevk irsaliyesi. */
  SEVK: 'SEVK',
  /** Matbu (kağıt) irsaliyenin elektronik karşılığı. */
  MATBUDAN: 'MATBUDAN',
} as const

/** Tanımlı e-İrsaliye tip kodları. */
export type DespatchTypeCode = (typeof DespatchType)[keyof typeof DespatchType]

/**
 * Taşıt plakası tanımlayıcı şemaları — `cbc:LicensePlateID/@schemeID`.
 */
export const LicensePlateScheme = {
  /** Çekici ya da kamyon plakası. */
  PLATE: 'PLAKA',
  /** Dorse plakası. */
  TRAILER: 'DORSE',
} as const

/** Tanımlı plaka şemaları. */
export type LicensePlateSchemeId = (typeof LicensePlateScheme)[keyof typeof LicensePlateScheme]
