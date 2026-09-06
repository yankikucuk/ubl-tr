/**
 * e-Arşiv'e özgü bilgilerin UBL karşılıklarını üretir.
 *
 * GİB bu bilgileri ayrı öğelerle değil, belirli `documentTypeCode`
 * değerleri taşıyan `cac:AdditionalDocumentReference` girdileriyle ister.
 * Kodları ezberlemek kullanıcının işi değildir; bu modül eşlemeyi yapar.
 */
import { sgkTypeDefinition } from '../constants/index.js'

import type { DeliveryInput } from './delivery.js'
import type { AdditionalDocumentReferenceInput } from './document-reference.js'
import type { PartyInput } from './party.js'

/** e-Arşiv gönderim şekli — `EXT_SEND_METHOD`. */
export type EArchiveSendType = 'ELEKTRONIK' | 'KAGIT'

/**
 * İnternet satışı bilgisi.
 *
 * e-Arşiv faturası internetten yapılan bir satışa aitse GİB bu bilgileri
 * zorunlu tutar: satış yapılan sitenin adresi, ödeme yöntemi ve tarihi.
 * Taşıyıcı ve teslim tarihi `cac:Delivery` bloğuna gider.
 */
export interface OnlineSaleInput {
  /** Satışın yapıldığı sitenin adresi — `EXT_ONLINE_STORE_URL`. */
  readonly storeUrl: string
  /** Ödeme yöntemi — `EXT_PAYMENT_METHOD` (ör. `KREDIKARTI/BANKAKARTI`). */
  readonly paymentMethod: string
  /** Ödeme tarihi (`YYYY-MM-DD`) — `EXT_PAYMENT_DATE`. */
  readonly paymentDate: string
  /** Teslim tarihi (`YYYY-MM-DD`) — `cac:Delivery/cbc:ActualDeliveryDate`. */
  readonly deliveryDate?: string
  /** Taşıyıcı firma — `cac:Delivery/cac:CarrierParty`. */
  readonly carrier?: PartyInput
}

/** SGK faturası bilgisi. */
export interface SgkInput {
  /**
   * Fatura türü kodu — `SAGLIK_ECZ`, `ABONELIK` gibi.
   *
   * Adı, mükellef ek belgelerinin açıklamasında kullanılır. Bu kod ayrıca
   * `cbc:AccountingCost` alanına yazılmalıdır; iki alan aynı bilgiyi
   * farklı yerlerde ister ve bu modül yalnızca ek belgeleri üretir.
   */
  readonly type: string
  /** Döküm numarası — `DOSYA_NO`. */
  readonly documentNo: string
  /** Mükellef adı — `MUKELLEF_ADI`. */
  readonly companyName: string
  /** Mükellef sicil numarası — `MUKELLEF_KODU`. */
  readonly companyCode: string
}

/** e-Arşiv faturasına özgü bilgiler. */
export interface EArchiveInput {
  /**
   * Gönderim şekli.
   *
   * `KAGIT` için ek belge **yazılmaz**: GİB kâğıt gönderimi varsayılan
   * sayar ve alanı yalnızca elektronik gönderimde bekler.
   */
  readonly sendType?: EArchiveSendType
  /** İnternet satışı bilgisi. */
  readonly onlineSale?: OnlineSaleInput
  /** SGK faturası bilgisi. */
  readonly sgk?: SgkInput
  /**
   * Görüntüleme şablonu — base64 kodlanmış XSLT.
   *
   * Belgenin insan tarafından okunan görüntüsünü üreten dönüşüm; ek belge
   * atfına gömülü dosya olarak iliştirilir.
   */
  readonly xsltTemplate?: string
}

/** {@link eArchiveDocuments} için belgeden gelen bağlam. */
export interface EArchiveContext {
  /** Belgenin ETTN'si; şablon ek belgesinin kimliği olur. */
  readonly uuid: string
  /** Belgenin düzenleme tarihi; her ek belgeye yazılır. */
  readonly issueDate: string
}

/**
 * e-Arşiv bilgilerini ek belge atıflarına çevirir.
 *
 * Sıra GİB örneklerindekiyle aynıdır: şablon, gönderim şekli, internet
 * satışı, SGK.
 *
 * @param earchive - e-Arşiv bilgileri
 * @param context - Belgenin ETTN'si ve tarihi
 * @returns Üretilen ek belge atıfları; bilgi yoksa boş dizi
 *
 * @example
 * ```ts
 * eArchiveDocuments(
 *   { sendType: 'ELEKTRONIK' },
 *   { uuid: 'u', issueDate: '2026-09-06' },
 * )
 * // [{ id: 'ELEKTRONIK', issueDate: '2026-09-06', documentTypeCode: 'EXT_SEND_METHOD' }]
 * ```
 */
export const eArchiveDocuments = (
  earchive: EArchiveInput,
  context: EArchiveContext,
): readonly AdditionalDocumentReferenceInput[] => {
  const belgeler: AdditionalDocumentReferenceInput[] = []
  const issueDate = context.issueDate

  if (earchive.xsltTemplate !== undefined) {
    belgeler.push({
      id: context.uuid,
      issueDate,
      attachment: {
        embeddedBinary: {
          content: earchive.xsltTemplate,
          mimeCode: 'application/xslt+xml',
          fileName: `${context.uuid}.xslt`,
        },
      },
    })
  }

  // Kâğıt gönderimde öğe yazılmaz; GİB onu varsayılan sayar.
  if (earchive.sendType !== undefined && earchive.sendType !== 'KAGIT') {
    belgeler.push({ id: earchive.sendType, issueDate, documentTypeCode: 'EXT_SEND_METHOD' })
  }

  const satis = earchive.onlineSale
  if (satis !== undefined) {
    // `id` alanı zorunlu olduğu için GİB örneklerinde nokta yazılır:
    // bilgi taşıyan alan `documentTypeCode`'dur.
    belgeler.push(
      { id: '.', issueDate, documentTypeCode: 'EXT_IS_ONLINE_SALE' },
      { id: satis.storeUrl, issueDate, documentTypeCode: 'EXT_ONLINE_STORE_URL' },
      { id: satis.paymentMethod, issueDate, documentTypeCode: 'EXT_PAYMENT_METHOD' },
      { id: satis.paymentDate, issueDate, documentTypeCode: 'EXT_PAYMENT_DATE' },
    )
  }

  const sgk = earchive.sgk
  if (sgk !== undefined) {
    const tur = sgkTypeDefinition(sgk.type)?.name ?? sgk.type
    belgeler.push(
      {
        id: '.',
        issueDate,
        documentTypeCode: 'DOSYA_NO',
        documentType: sgk.documentNo,
        description: 'Döküm No',
      },
      {
        id: '.',
        issueDate,
        documentTypeCode: 'MUKELLEF_ADI',
        documentType: sgk.companyName,
        description: `${tur} Adı`,
      },
      {
        id: '.',
        issueDate,
        documentTypeCode: 'MUKELLEF_KODU',
        documentType: sgk.companyCode,
        description: `${tur} Sicil Numarası`,
      },
    )
  }

  return belgeler
}

/**
 * İnternet satışının teslim bilgisini üretir.
 *
 * @param onlineSale - İnternet satışı bilgisi
 * @returns Teslim bilgisi; teslim tarihi ve taşıyıcı yoksa `undefined`
 *
 * @example
 * ```ts
 * onlineSaleDelivery({ storeUrl: 'x', paymentMethod: 'y', paymentDate: 'z',
 *                      deliveryDate: '2026-09-07' })
 * // { actualDeliveryDate: '2026-09-07' }
 * ```
 */
export const onlineSaleDelivery = (onlineSale: OnlineSaleInput): DeliveryInput | undefined => {
  const { deliveryDate, carrier } = onlineSale
  if (deliveryDate === undefined && carrier === undefined) return undefined
  return {
    ...(deliveryDate === undefined ? {} : { actualDeliveryDate: deliveryDate }),
    ...(carrier === undefined ? {} : { carrierParty: carrier }),
  }
}
