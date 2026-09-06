/**
 * UBL-TR belge tipleri: kök öğe adı ve ona ait belge ad alanı.
 *
 * OASIS, her belge tipine kendi ad alanını verir ve bu ad alanı her zaman
 * `...:ubl:schema:xsd:<KökÖğe>-2` biçimindedir. Bu ilişki tesadüf değil,
 * spesifikasyonun kuralıdır — ve testlerle korunur.
 */
export const DocumentType = {
  /** e-Fatura ve e-Arşiv Fatura. Serbest meslek ve müstahsil makbuzu da bu kökü kullanır. */
  INVOICE: 'Invoice',
  /** İade faturası yerine kullanılan alacak dekontu. */
  CREDIT_NOTE: 'CreditNote',
  /** e-İrsaliye. */
  DESPATCH_ADVICE: 'DespatchAdvice',
  /** e-İrsaliye yanıtı — malın teslim alındığının bildirimi. */
  RECEIPT_ADVICE: 'ReceiptAdvice',
  /** Kabul, red ve iade bildirimleri. */
  APPLICATION_RESPONSE: 'ApplicationResponse',
} as const

/** Belge kök öğesi adlarının birleşim tipi. */
export type DocumentTypeName = (typeof DocumentType)[keyof typeof DocumentType]

/** OASIS belge ad alanlarının değişmeyen ön eki. */
const DOCUMENT_NAMESPACE_BASE = 'urn:oasis:names:specification:ubl:schema:xsd:'

/**
 * Bir belge tipinin XML ad alanı URI'sini döndürür.
 *
 * @param type - Belgenin kök öğe adı
 * @returns Tam ad alanı URI'si
 */
export const documentNamespace = (type: DocumentTypeName): string =>
  `${DOCUMENT_NAMESPACE_BASE}${type}-2`

/**
 * UBL sürümü. UBL-TR, UBL 2.1 üzerine tanımlıdır ve bu değer belgenin
 * `cbc:UBLVersionID` alanına yazılır.
 */
export const UBL_VERSION_ID = '2.1'

/**
 * Türkiye özelleştirmesinin kimliği; belgenin `cbc:CustomizationID` alanına
 * yazılır ve karşı tarafa belgenin TR profiline göre okunması gerektiğini
 * söyler.
 */
export const UBL_TR_CUSTOMIZATION_ID = 'TR1.2'
