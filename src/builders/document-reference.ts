/**
 * `cac:DocumentReference` tipindeki belge atıfları.
 *
 * Ek belge, irsaliye, mal kabul makbuzu ve siparişi başlatan belge
 * atıflarının hepsi UBL'de aynı tiptedir. Tipler ve kurucuları burada
 * durur, çünkü hem fatura kurucusu hem e-Arşiv yardımcıları kullanır;
 * fatura kurucusunun içinde kalsalardı iki modül birbirine bağımlı
 * olurdu.
 */
import { Namespace } from '../constants/index.js'
import { container, leaf, optionalLeaf, type XmlElement } from '../core/index.js'

const CBC = Namespace.COMMON_BASIC
const CAC = Namespace.COMMON_AGGREGATE

/** Belgeye gömülü ikili dosya — `cbc:EmbeddedDocumentBinaryObject`. */
export interface EmbeddedBinaryInput {
  /** Dosyanın base64 kodlanmış içeriği. */
  readonly content: string
  /**
   * MIME türü — `mimeCode` özniteliği.
   *
   * UBL bu özniteliği zorunlu tutar; `application/pdf`, `image/png` gibi.
   */
  readonly mimeCode: string
  /** Dosya adı — `filename` özniteliği. */
  readonly fileName?: string
}

/** Belgenin dış adresi — `cac:ExternalReference`. */
export interface ExternalReferenceInput {
  /** Belgenin adresi — `cbc:URI`. */
  readonly uri: string
  /** MIME türü — `cbc:MimeCode`. */
  readonly mimeCode?: string
  /** Dosya adı — `cbc:FileName`. */
  readonly fileName?: string
  /** Serbest açıklama — `cbc:Description`. */
  readonly description?: string
}

/**
 * Belge atfına iliştirilen dosya — `cac:Attachment`.
 *
 * İki yol vardır ve ikisi birlikte de verilebilir: dosyayı belgenin içine
 * base64 olarak gömmek ya da dış adresini yazmak. Gömme, belgeyi tek
 * parça hâlinde taşınabilir kılar; e-Arşiv'de görüntüleme şablonu ve ek
 * belgeler bu yolla iletilir.
 */
export interface AttachmentInput {
  /** Gömülü dosya. */
  readonly embeddedBinary?: EmbeddedBinaryInput
  /** Dış adres. */
  readonly externalReference?: ExternalReferenceInput
}

/** Genel belge atfı — `cac:AdditionalDocumentReference`. */
export interface AdditionalDocumentReferenceInput {
  /** Atıf yapılan belgenin numarası ya da değeri — `cbc:ID`. */
  readonly id: string
  /**
   * Numaranın şeması — `schemeID`.
   *
   * Bazı kurallar bu şemayı anahtar olarak arar: şarj hizmeti
   * faturalarında `ESURaporID` taşıyan bir ek belge zorunludur.
   */
  readonly schemeId?: string
  /** Belgenin tarihi (`YYYY-MM-DD`). */
  readonly issueDate?: string
  /**
   * Belge tipi kodu — `cbc:DocumentTypeCode`.
   *
   * GİB bu alanı anahtar olarak kullanır: `EXT_SEND_METHOD` gönderim
   * şekli, `DOSYA_NO` SGK dosya numarası gibi.
   */
  readonly documentTypeCode?: string
  /** Belge tipi ya da değeri — `cbc:DocumentType`. */
  readonly documentType?: string
  /** Serbest açıklama — `cbc:DocumentDescription`. */
  readonly description?: string
  /** İliştirilen dosya — `cac:Attachment`. */
  readonly attachment?: AttachmentInput
}

/**
 * İrsaliye, makbuz ve sipariş kaynağı atıflarının ortak girdisi.
 *
 * UBL'de bu üçü de `cac:DocumentReference` tipindedir; ek belge atfıyla
 * aynı alanları taşırlar.
 */
export type DocumentReferenceInput = AdditionalDocumentReferenceInput

/** İliştirilen dosyayı `cac:Attachment` öğesine çevirir. */
export const buildAttachment = (attachment: AttachmentInput): XmlElement | undefined => {
  const gomulu = attachment.embeddedBinary
  const dis = attachment.externalReference
  if (gomulu === undefined && dis === undefined) return undefined
  return container(CAC, 'Attachment', [
    gomulu === undefined
      ? undefined
      : leaf(CBC, 'EmbeddedDocumentBinaryObject', gomulu.content, [
          { name: 'mimeCode', value: gomulu.mimeCode },
          ...(gomulu.fileName === undefined ? [] : [{ name: 'filename', value: gomulu.fileName }]),
        ]),
    dis === undefined
      ? undefined
      : container(CAC, 'ExternalReference', [
          leaf(CBC, 'URI', dis.uri),
          optionalLeaf(CBC, 'MimeCode', dis.mimeCode),
          optionalLeaf(CBC, 'FileName', dis.fileName),
          optionalLeaf(CBC, 'Description', dis.description),
        ]),
  ])
}

/**
 * Bir belge atfını verilen adla `cac:` öğesine çevirir.
 *
 * `AdditionalDocumentReference`, `DespatchDocumentReference`,
 * `ReceiptDocumentReference` ve `OriginatorDocumentReference` UBL'de aynı
 * `DocumentReference` tipindedir; öğe sırası da ortaktır.
 */
export const buildDocumentReference = (name: string, ref: DocumentReferenceInput): XmlElement =>
  container(CAC, name, [
    leaf(
      CBC,
      'ID',
      ref.id,
      ref.schemeId === undefined ? [] : [{ name: 'schemeID', value: ref.schemeId }],
    ),
    optionalLeaf(CBC, 'IssueDate', ref.issueDate),
    optionalLeaf(CBC, 'DocumentTypeCode', ref.documentTypeCode),
    optionalLeaf(CBC, 'DocumentType', ref.documentType),
    optionalLeaf(CBC, 'DocumentDescription', ref.description),
    ref.attachment === undefined ? undefined : buildAttachment(ref.attachment),
  ])
