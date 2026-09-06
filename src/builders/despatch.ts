import {
  DEFAULT_UNIT_CODE,
  type DespatchProfileId,
  type DespatchTypeCode,
  documentNamespace,
  DocumentType,
  Namespace,
  UBL_TR_CUSTOMIZATION_ID,
  UBL_VERSION_ID,
} from '../constants/index.js'
import {
  container,
  decimal,
  leaf,
  optionalContainer,
  optionalLeaf,
  serializeDocument,
  toStringValueRange,
  type XmlElement,
} from '../core/index.js'
import type { AdditionalItemIdentificationInput, NumericInput } from '../documents/index.js'

import { buildParty, buildPostalAddress, type AddressInput, type PartyInput } from './party.js'

const CBC = Namespace.COMMON_BASIC
const CAC = Namespace.COMMON_AGGREGATE
const EXT = Namespace.COMMON_EXTENSION
const DESPATCH_NS = documentNamespace(DocumentType.DESPATCH_ADVICE)

/** Miktar alanının ondalık aralığı; faturadaki kuralın aynısı. */
const QUANTITY_MIN_DECIMALS = 2
const QUANTITY_MAX_DECIMALS = 6

/** Sevkiyatı yapan sürücü — `cac:DriverPerson`. */
export interface DriverInput {
  /** Sürücünün adı. */
  readonly firstName: string
  /** Sürücünün soyadı. */
  readonly familyName: string
  /**
   * Sürücünün T.C. kimlik numarası — `cbc:NationalityID`.
   *
   * Alan adı UBL'de "uyruk" anlamına gelse de UBL-TR bu alanı sürücünün
   * kimlik numarası için kullanır.
   */
  readonly nationalityId?: string
}

/** Taşıtın plakası — `cbc:LicensePlateID`. */
export interface LicensePlateInput {
  /** Plaka. */
  readonly plateNumber: string
  /** Plaka türü — `schemeID`; varsayılan `PLAKA`. Dorse için `DORSE`. */
  readonly schemeId?: string
}

/** Taşıma ekipmanı — `cac:TransportHandlingUnit/cac:TransportEquipment`. */
export interface TransportEquipmentInput {
  /** Ekipmanın tanımlayıcısı (ör. dorse plakası). */
  readonly id: string
  /** Tanımlayıcının şeması — `schemeID` (ör. `DORSEPLAKA`). */
  readonly schemeId?: string
}

/** Sevkiyat bilgisi — `cac:Shipment`. */
export interface ShipmentInput {
  /** Sevkiyat sıra numarası; varsayılan `'1'`. */
  readonly id?: string
  /** Fiili sevk tarihi (`YYYY-MM-DD`) — `cbc:ActualDespatchDate`. */
  readonly actualDespatchDate?: string
  /** Fiili sevk saati (`HH:mm:ss`) — `cbc:ActualDespatchTime`. */
  readonly actualDespatchTime?: string
  /** Teslim adresi — `cac:DeliveryAddress`. */
  readonly deliveryAddress?: AddressInput
  /** Taşıyıcı firma — `cac:CarrierParty`. Adres taşımayabilir. */
  readonly carrierParty?: PartyInput
  /** Sürücüler; birden fazla olabilir. */
  readonly drivers?: readonly DriverInput[]
  /** Taşıt plakaları; çekici ve dorse ayrı ayrı yazılır. */
  readonly licensePlates?: readonly LicensePlateInput[]
  /** Taşıma ekipmanları. */
  readonly transportEquipment?: readonly TransportEquipmentInput[]
}

/** Bir e-İrsaliye satırı — `cac:DespatchLine`. */
export interface DespatchLineInput {
  /** Satır numarası; verilmezse sıraya göre üretilir. */
  readonly id?: string
  /** Sevk edilen miktar. */
  readonly quantity: NumericInput
  /** UN/ECE Rec 20 birim kodu; varsayılan `C62`. */
  readonly unitCode?: string
  /** Ürün adı. */
  readonly itemName: string
  /** Satır notu — `cbc:Note`. */
  readonly note?: string
  /** İlişkili sipariş satırı numarası — `cac:OrderLineReference/cbc:LineID`. */
  readonly orderLineId?: string
  /** Kaleme ait ek tanımlayıcılar (ör. İDİS etiket numarası). */
  readonly additionalIdentifications?: readonly AdditionalItemIdentificationInput[]
}

/** Matbu irsaliye gibi belgelere atıf — `cac:AdditionalDocumentReference`. */
export interface DespatchDocumentReferenceInput {
  /** Belge numarası. */
  readonly id: string
  /** Belgenin tarihi (`YYYY-MM-DD`). */
  readonly issueDate?: string
  /** Belge tipi — `cbc:DocumentType` (ör. `MATBU`). */
  readonly documentType?: string
  /** Belge tipi kodu — `cbc:DocumentTypeCode`. */
  readonly documentTypeCode?: string
}

/** Bir e-İrsaliye belgesinin girdisi. */
export interface DespatchAdviceInput {
  /** 16 haneli belge numarası (3 harf + yıl + sıra). */
  readonly id: string
  /** ETTN — belgenin evrensel tekil numarası. */
  readonly uuid: string
  /** Düzenleme tarihi (`YYYY-MM-DD`). */
  readonly issueDate: string
  /** Düzenleme saati (`HH:mm:ss`). */
  readonly issueTime?: string
  /** İrsaliye profili; varsayılan `TEMELIRSALIYE`. */
  readonly profile?: DespatchProfileId
  /** İrsaliye tipi; varsayılan `SEVK`. */
  readonly type?: DespatchTypeCode
  /** Malı gönderen — `cac:DespatchSupplierParty`. */
  readonly supplier: PartyInput
  /** Malı teslim alan — `cac:DeliveryCustomerParty`. */
  readonly customer: PartyInput
  /** Sevkiyat bilgisi. */
  readonly shipment: ShipmentInput
  /** İrsaliye satırları; en az bir tane. */
  readonly lines: readonly DespatchLineInput[]
  /** Serbest notlar. */
  readonly notes?: readonly string[]
  /** Belge atıfları — matbu irsaliyeden dönüşte kaynak belge burada bildirilir. */
  readonly additionalDocuments?: readonly DespatchDocumentReferenceInput[]
}

/** {@link buildDespatchAdvice} seçenekleri. */
export interface BuildDespatchOptions {
  /**
   * İmza zarfı (`ext:UBLExtensions`) yazılsın mı. Varsayılan `true`.
   *
   * Faturadaki gerekçenin aynısı: GİB şemasında kök sıranın ilk öğesidir.
   */
  readonly includeUblExtensions?: boolean
  /**
   * Boş `cac:GoodsItem` yazılsın mı. Varsayılan `true`.
   *
   * UBL'de `cac:GoodsItem` isteğe bağlıdır, ama GİB'in e-İrsaliye paketine
   * karşı doğrulanan üretimlerde `cac:Shipment` içinde — içeriği boş olsa
   * bile — yer alıyor. Boş öğe yazmaktan genel olarak kaçınıyoruz; burada
   * kanıt tersini söylediği için varsayılan açık, ama kapatılabilir.
   */
  readonly includeEmptyGoodsItem?: boolean
  /** Çıktı biçimi. Varsayılan `'compact'` — imzalanmaya elverişli. */
  readonly format?: 'compact' | 'indented'
}

/** Sevkiyat bloğunu üretir. */
const buildShipment = (shipment: ShipmentInput, bosGoodsItem: boolean): XmlElement =>
  container(CAC, 'Shipment', [
    leaf(CBC, 'ID', shipment.id ?? '1'),
    bosGoodsItem ? container(CAC, 'GoodsItem', []) : undefined,
    optionalContainer(CAC, 'ShipmentStage', [
      optionalContainer(CAC, 'TransportMeans', [
        optionalContainer(
          CAC,
          'RoadTransport',
          (shipment.licensePlates ?? []).map((plaka) =>
            leaf(CBC, 'LicensePlateID', plaka.plateNumber, [
              { name: 'schemeID', value: plaka.schemeId ?? 'PLAKA' },
            ]),
          ),
        ),
      ]),
      ...(shipment.drivers ?? []).map((surucu) =>
        container(CAC, 'DriverPerson', [
          leaf(CBC, 'FirstName', surucu.firstName),
          leaf(CBC, 'FamilyName', surucu.familyName),
          optionalLeaf(CBC, 'NationalityID', surucu.nationalityId),
        ]),
      ),
    ]),
    optionalContainer(CAC, 'Delivery', [
      shipment.deliveryAddress === undefined
        ? undefined
        : buildPostalAddress(shipment.deliveryAddress, 'DeliveryAddress'),
      shipment.carrierParty === undefined
        ? undefined
        : buildParty(shipment.carrierParty, 'CarrierParty'),
      optionalContainer(CAC, 'Despatch', [
        optionalLeaf(CBC, 'ActualDespatchDate', shipment.actualDespatchDate),
        optionalLeaf(CBC, 'ActualDespatchTime', shipment.actualDespatchTime),
      ]),
    ]),
    ...(shipment.transportEquipment ?? []).map((ekipman) =>
      container(CAC, 'TransportHandlingUnit', [
        container(CAC, 'TransportEquipment', [
          leaf(
            CBC,
            'ID',
            ekipman.id,
            ekipman.schemeId === undefined ? [] : [{ name: 'schemeID', value: ekipman.schemeId }],
          ),
        ]),
      ]),
    ),
  ])

/** Bir irsaliye satırını üretir. */
const buildDespatchLine = (line: DespatchLineInput, index: number): XmlElement =>
  container(CAC, 'DespatchLine', [
    leaf(CBC, 'ID', line.id ?? String(index + 1)),
    optionalLeaf(CBC, 'Note', line.note),
    leaf(
      CBC,
      'DeliveredQuantity',
      toStringValueRange(
        typeof line.quantity === 'object' ? line.quantity : decimal(line.quantity),
        QUANTITY_MIN_DECIMALS,
        QUANTITY_MAX_DECIMALS,
      ),
      [{ name: 'unitCode', value: line.unitCode ?? DEFAULT_UNIT_CODE }],
    ),
    container(CAC, 'OrderLineReference', [
      leaf(CBC, 'LineID', line.orderLineId ?? line.id ?? String(index + 1)),
    ]),
    container(CAC, 'Item', [
      leaf(CBC, 'Name', line.itemName),
      ...(line.additionalIdentifications ?? []).map((kimlik) =>
        container(CAC, 'AdditionalItemIdentification', [
          leaf(CBC, 'ID', kimlik.value, [{ name: 'schemeID', value: kimlik.schemeId }]),
        ]),
      ),
    ]),
  ])

/**
 * Bir e-İrsaliye belgesini UBL-TR öğe ağacına çevirir.
 *
 * e-İrsaliye faturadan bağımsız bir belge tipidir: kök öğesi
 * `DespatchAdvice`, ad alanı ayrıdır ve tutar taşımaz — bu yüzden
 * hesaplama katmanına hiç uğramaz. Ortak olan taraf, adres ve XML
 * katmanları yeniden kullanılır.
 *
 * Öğe sırası UBL `DespatchAdviceType` sequence tanımına uyar.
 *
 * @param input - İrsaliye girdisi
 * @param options - Üretim seçenekleri
 * @returns Belgenin kök öğesi
 * @throws {RangeError} Satır listesi boşsa
 *
 * @example
 * ```ts
 * const { root } = buildDespatchAdvice({
 *   id: 'IRS2026000000001',
 *   uuid: '1a2b3c4d-0001-4000-8001-000000000001',
 *   issueDate: '2026-09-06',
 *   supplier: { taxNumber: '1234567890', name: 'Gönderen A.Ş.',
 *     address: { district: 'Üsküdar', city: 'İstanbul' } },
 *   customer: { taxNumber: '9876543210', name: 'Alıcı Ltd.',
 *     address: { district: 'Kadıköy', city: 'İstanbul' } },
 *   shipment: {
 *     actualDespatchDate: '2026-09-06',
 *     drivers: [{ firstName: 'Mehmet', familyName: 'Sürücü', nationalityId: '12345678901' }],
 *     licensePlates: [{ plateNumber: '34ABC123' }],
 *   },
 *   lines: [{ quantity: 10, itemName: 'Paketlenmiş Ürün' }],
 * })
 * ```
 */
export const buildDespatchAdvice = (
  input: DespatchAdviceInput,
  options: BuildDespatchOptions = {},
): { readonly root: XmlElement } => {
  if (input.lines.length === 0) {
    throw new RangeError('İrsaliye en az bir satır içermelidir.')
  }

  const root = container(DESPATCH_NS, 'DespatchAdvice', [
    (options.includeUblExtensions ?? true)
      ? container(EXT, 'UBLExtensions', [
          container(EXT, 'UBLExtension', [leaf(EXT, 'ExtensionContent', '')]),
        ])
      : undefined,
    leaf(CBC, 'UBLVersionID', UBL_VERSION_ID),
    leaf(CBC, 'CustomizationID', UBL_TR_CUSTOMIZATION_ID),
    leaf(CBC, 'ProfileID', input.profile ?? 'TEMELIRSALIYE'),
    leaf(CBC, 'ID', input.id),
    leaf(CBC, 'CopyIndicator', 'false'),
    leaf(CBC, 'UUID', input.uuid),
    leaf(CBC, 'IssueDate', input.issueDate),
    optionalLeaf(CBC, 'IssueTime', input.issueTime),
    leaf(CBC, 'DespatchAdviceTypeCode', input.type ?? 'SEVK'),
    ...(input.notes ?? []).map((note) => leaf(CBC, 'Note', note)),
    leaf(CBC, 'LineCountNumeric', String(input.lines.length)),
    ...(input.additionalDocuments ?? []).map((belge) =>
      container(CAC, 'AdditionalDocumentReference', [
        leaf(CBC, 'ID', belge.id),
        optionalLeaf(CBC, 'IssueDate', belge.issueDate),
        optionalLeaf(CBC, 'DocumentTypeCode', belge.documentTypeCode),
        optionalLeaf(CBC, 'DocumentType', belge.documentType),
      ]),
    ),
    container(CAC, 'DespatchSupplierParty', [buildParty(input.supplier)]),
    container(CAC, 'DeliveryCustomerParty', [buildParty(input.customer)]),
    buildShipment(input.shipment, options.includeEmptyGoodsItem ?? true),
    ...input.lines.map((line, index) => buildDespatchLine(line, index)),
  ])

  return { root }
}

/**
 * Bir e-İrsaliye belgesini UBL-TR XML metnine çevirir.
 *
 * @param input - İrsaliye girdisi
 * @param options - Üretim seçenekleri
 * @returns UBL-TR XML belgesi
 *
 * @example
 * ```ts
 * const xml = buildDespatchAdviceXml(girdi, { format: 'indented' })
 * ```
 */
export const buildDespatchAdviceXml = (
  input: DespatchAdviceInput,
  options: BuildDespatchOptions = {},
): string => {
  const { root } = buildDespatchAdvice(input, options)
  const temel = {
    defaultNamespace: DESPATCH_NS,
    prefixes: {
      cac: Namespace.COMMON_AGGREGATE,
      cbc: Namespace.COMMON_BASIC,
      ext: Namespace.COMMON_EXTENSION,
    },
  }
  return serializeDocument(
    root,
    options.format === undefined ? temel : { ...temel, format: options.format },
  )
}
