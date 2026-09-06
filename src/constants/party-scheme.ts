/**
 * `cac:PartyIdentification/cbc:ID` şema kimlikleri — UBL-TR kod listesi.
 *
 * Bir tarafın vergi numarası dışındaki tanımlayıcıları bu şemalarla
 * bildirilir: abone numarası, tesisat numarası, çiftçi numarası gibi.
 *
 * Liste **bilerek kapalı değildir** ve buna dayanan bir doğrulama kuralı
 * yoktur. GİB listeyi zaman zaman genişletir; bilinmeyen bir şemayı hata
 * saymak, yeni yayımlanmış geçerli bir kodu kullanan doğru belgeyi
 * reddederdi. Liste arayüzlerin seçim kutusunu doldurması içindir.
 */
export const PARTY_IDENTIFICATION_SCHEMES = [
  'VKN',
  'TCKN',
  'VKN_TCKN',
  'MERSISNO',
  'TICARETSICILNO',
  'PASAPORTNO',
  'ARACIKURUMVKN',
  'ARACIKURUMETIKET',
  'ABONENO',
  'TESISATNO',
  'SAYACNO',
  'EPDKNO',
  'HIZMETNO',
  'MUSTERINO',
  'TELEFONNO',
  'DISTRIBUTORNO',
  'BAYINO',
  'SUBENO',
  'TAPDKNO',
  'CIFTCINO',
  'IMALATCINO',
  'URETICINO',
  'DOSYANO',
  'HASTANO',
  'ARACKIMLIKNO',
  'PLAKA',
  'SEVKIYATNO',
  'GTB_REFNO',
  'GTB_GCB_TESCILNO',
  'GTB_FIILI_IHRACAT_TARIHI',
] as const

/** {@link PARTY_IDENTIFICATION_SCHEMES} içindeki bir şema kimliği. */
export type PartyIdentificationScheme = (typeof PARTY_IDENTIFICATION_SCHEMES)[number]

/**
 * Bir şema kimliğinin bilinen listede olup olmadığını söyler.
 *
 * `false` dönmesi kodun **geçersiz olduğu anlamına gelmez** — liste kapalı
 * değildir. Arayüzde "bilinmeyen şema" uyarısı göstermek için kullanılır,
 * belgeyi reddetmek için değil.
 *
 * @param scheme - Şema kimliği
 * @returns Listede varsa `true`
 *
 * @example
 * ```ts
 * isKnownPartyIdentificationScheme('ABONENO') // true
 * isKnownPartyIdentificationScheme('YENIKOD') // false — ama geçersiz değil
 * ```
 */
export const isKnownPartyIdentificationScheme = (
  scheme: string,
): scheme is PartyIdentificationScheme =>
  (PARTY_IDENTIFICATION_SCHEMES as readonly string[]).includes(scheme)
