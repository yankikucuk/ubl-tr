/**
 * UBL 2.1 ve UBL-TR belgelerinde kullanılan XML ad alanı URI'leri.
 *
 * Bu değerler OASIS UBL 2.1 spesifikasyonundan gelir ve **harfi harfine**
 * doğru olmak zorundadır: bir karakterlik sapma belgeyi şema doğrulamasında
 * geçersiz kılar, ama hiçbir tip kontrolü bunu yakalayamaz. Bu yüzden
 * `constants` katmanı ayrı bir yaprak katmandır ve CODEOWNERS ile korunur.
 */
export const Namespace = {
  /** Ortak temel bileşenler — `cbc:` ön eki. */
  COMMON_BASIC: 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
  /** Ortak birleşik bileşenler — `cac:` ön eki. */
  COMMON_AGGREGATE: 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
  /** Ortak uzantı bileşenleri — `ext:` ön eki. İmza bloğu buraya girer. */
  COMMON_EXTENSION: 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2',
  /** XML Dijital İmza — `ds:` ön eki. */
  XML_DSIG: 'http://www.w3.org/2000/09/xmldsig#',
  /** XAdES 1.3.2 — `xades:` ön eki. Bu kütüphane üretmez, yalnızca tanır. */
  XADES: 'http://uri.etsi.org/01903/v1.3.2#',
} as const

/** Ad alanı URI'lerinin birleşim tipi. */
export type NamespaceUri = (typeof Namespace)[keyof typeof Namespace]

/**
 * UBL 2.1 ad alanlarının geleneksel ön ekleri.
 *
 * Ön ek seçimi teknik olarak serbesttir — XML ad alanı bağlaması ön eke
 * değil URI'ye bakar — ancak GİB kılavuzlarındaki tüm örnekler bu ön ekleri
 * kullanır ve elle incelenen belgelerde tutarlılık pratik bir değerdir.
 */
export const NamespacePrefix = {
  [Namespace.COMMON_BASIC]: 'cbc',
  [Namespace.COMMON_AGGREGATE]: 'cac',
  [Namespace.COMMON_EXTENSION]: 'ext',
  [Namespace.XML_DSIG]: 'ds',
  [Namespace.XADES]: 'xades',
} as const satisfies Record<NamespaceUri, string>
