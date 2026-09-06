import {
  type CodeTables,
  currencyDefinition,
  DEFAULT_CURRENCY_CODE,
  documentNamespace,
  DocumentType,
  exemptionDefinition,
  type InvoiceProfileId,
  type InvoiceTypeCode,
  isProfileTypeAllowed,
  Namespace,
  RETURN_TYPES,
  UBL_TR_CUSTOMIZATION_ID,
  UBL_VERSION_ID,
  VAT_TAX_CODE,
  VAT_TAX_NAME,
} from '../constants/index.js'
import {
  add,
  container,
  decimal,
  type Decimal,
  isZero,
  leaf,
  optionalContainer,
  optionalLeaf,
  serializeDocument,
  toStringValue,
  toStringValueRange,
  type XmlElement,
} from '../core/index.js'
import {
  amountInWordsNote,
  type AmountInWordsNoteOptions,
  DocumentInputError,
  calculateInvoice,
  type CalculatedInvoice,
  type CalculatedLine,
  type InvoiceLineInput,
  lineUnitCode,
  type NumericInput,
  type TaxSubtotal,
} from '../documents/index.js'

import { buildDelivery, type DeliveryInput } from './delivery.js'
import {
  buildParty,
  buildTaxRepresentativeParty,
  type PartyInput,
  type TaxRepresentativeInput,
} from './party.js'

/**
 * Fatura satırı — hesaplama girdisine belgeye özgü alanlar eklenmiş hâli.
 *
 * Teslim bilgisi tutarları etkilemez, bu yüzden toplam motorunun girdisinde
 * yer almaz; yalnızca belgeye yazılır.
 */
export interface InvoiceBuilderLineInput extends InvoiceLineInput {
  /**
   * Satırın teslim bilgisi — `cac:Delivery`.
   *
   * İhracat, ihraç kayıtlı ve yolcu beraberi eşya faturalarında teslim
   * adresi, teslim şekli (Incoterms) ve GTİP numarası burada taşınır.
   */
  readonly delivery?: DeliveryInput
  /** Marka — `cac:Item/cbc:BrandName`. */
  readonly brandName?: string
  /** Model — `cac:Item/cbc:ModelName`. */
  readonly modelName?: string
  /**
   * Mal sınıflandırma kodu — `cac:CommodityClassification/cbc:ItemClassificationCode`.
   *
   * Yatırım teşvik belgeli faturalarda makine-teçhizat ile inşaat harcaması
   * ayrımı bu kodla yapılır.
   */
  readonly classificationCode?: string
  /** Ürün takip numarası — `cac:ItemInstance/cbc:ProductTraceID`. */
  readonly productTraceId?: string
  /** Seri numarası — `cac:ItemInstance/cbc:SerialID`. */
  readonly serialId?: string
}

const CBC = Namespace.COMMON_BASIC
const CAC = Namespace.COMMON_AGGREGATE
const EXT = Namespace.COMMON_EXTENSION
const INVOICE_NS = documentNamespace(DocumentType.INVOICE)

/**
 * Miktar ve birim fiyatın ondalık aralığı.
 *
 * Bu alanlar parasal görünseler de GİB'in iki basamak kuralı onlara
 * uygulanmaz; sabit iki basamağa zorlamak `0,125 kg` gibi gerçek değerleri
 * `0,13`'e yuvarlayarak veriyi imha eder.
 */
const QUANTITY_MIN_DECIMALS = 2
const QUANTITY_MAX_DECIMALS = 6

/** İade faturasında atıf yapılan asıl faturanın bilgisi. */
export interface BillingReferenceInput {
  /** Asıl faturanın numarası. */
  readonly id: string
  /** Asıl faturanın düzenleme tarihi (`YYYY-MM-DD`). */
  readonly issueDate: string
  /** Asıl faturanın ETTN'si. */
  readonly uuid?: string
  /**
   * Atıf yapılan belgenin tipi — `cbc:DocumentTypeCode`.
   *
   * Verilmezse iade faturalarında faturanın kendi tipi yazılır; GİB'in
   * örneklerinde ve yaygın uygulamada beklenen budur.
   */
  readonly documentTypeCode?: string
}

/** Fatura dönemi — `cac:InvoicePeriod`. */
export interface InvoicePeriodInput {
  /** Dönem başlangıç tarihi (`YYYY-MM-DD`). */
  readonly startDate?: string
  /** Dönem başlangıç saati (`HH:mm:ss`). */
  readonly startTime?: string
  /** Dönem bitiş tarihi (`YYYY-MM-DD`). */
  readonly endDate?: string
  /** Dönem bitiş saati (`HH:mm:ss`). */
  readonly endTime?: string
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
}

/** Sözleşme atfı — `cac:ContractDocumentReference`. */
export interface ContractDocumentReferenceInput {
  /** Sözleşme ya da belge numarası. */
  readonly id: string
  /** Numaranın şeması — `schemeID` (ör. yatırım teşvik için `YTBNO`). */
  readonly schemeId?: string
  /** Belgenin tarihi (`YYYY-MM-DD`). */
  readonly issueDate?: string
}

/** Sipariş atfı — `cac:OrderReference`. */
export interface OrderReferenceInput {
  /** Sipariş numarası. */
  readonly id: string
  /** Sipariş tarihi (`YYYY-MM-DD`). */
  readonly issueDate?: string
}

/** Ödeme bilgisi — `cac:PaymentMeans`. */
export interface PaymentMeansInput {
  /**
   * UN/ECE 4461 ödeme şekli kodu — `cbc:PaymentMeansCode`.
   *
   * Yaygın değerler: `10` nakit, `42` banka havalesi, `48` kredi kartı,
   * `1` belirtilmemiş.
   */
  readonly meansCode: string
  /** Vade tarihi (`YYYY-MM-DD`) — `cbc:PaymentDueDate`. */
  readonly dueDate?: string
  /** Alacaklı hesap numarası ya da IBAN — `cac:PayeeFinancialAccount/cbc:ID`. */
  readonly accountNumber?: string
  /** Ödemeye ilişkin serbest açıklama — `cbc:PaymentNote`. */
  readonly note?: string
}

/** Döviz kuru bilgisi — `cac:PricingExchangeRate`. */
export interface ExchangeRateInput {
  /**
   * Belge para biriminin Türk lirası karşılığı.
   *
   * Yabancı para birimli faturalarda GİB kuru zorunlu tutar; kur olmadan
   * belge Türk lirası karşılığı hesaplanamaz.
   */
  readonly rate: NumericInput
  /** Kaynak para birimi; verilmezse belgenin para birimi. */
  readonly sourceCurrencyCode?: string
  /** Hedef para birimi; varsayılan `TRY`. */
  readonly targetCurrencyCode?: string
}

/** Bir e-fatura belgesinin girdisi. */
export interface InvoiceInput {
  /** 16 haneli belge numarası (3 harf + yıl + sıra). */
  readonly id: string
  /** ETTN — belgenin evrensel tekil numarası. */
  readonly uuid: string
  /** Düzenleme tarihi (`YYYY-MM-DD`). */
  readonly issueDate: string
  /** Düzenleme saati (`HH:mm:ss`). */
  readonly issueTime?: string
  /** Fatura profili. */
  readonly profile: InvoiceProfileId
  /** Fatura tipi. */
  readonly type: InvoiceTypeCode
  /** ISO 4217 para birimi kodu; varsayılan `TRY`. */
  readonly currencyCode?: string
  /** Satıcı. */
  readonly supplier: PartyInput
  /** Alıcı. */
  readonly customer: PartyInput
  /**
   * Aracı alıcı — `cac:BuyerCustomerParty`.
   *
   * Malı fiilen alan taraf faturanın muhatabından farklıysa yazılır: kamu
   * alımlarında aracı kurum, ihracatta yurt dışındaki alıcı gibi.
   */
  readonly buyerCustomer?: PartyInput
  /** Fatura satırları; en az bir tane. */
  readonly lines: readonly InvoiceBuilderLineInput[]
  /** Serbest notlar. Yazıyla tutar notu bunlardan önce yazılır. */
  readonly notes?: readonly string[]
  /** İade faturasında asıl faturaya atıf. */
  readonly billingReference?: BillingReferenceInput
  /** Sipariş atfı. */
  readonly orderReference?: OrderReferenceInput
  /** Ödeme bilgisi. */
  readonly paymentMeans?: PaymentMeansInput
  /**
   * Muhasebe kodu — `cbc:AccountingCost`.
   *
   * SGK faturalarında fatura türünü (ör. `SAGLIK_ECZ`) taşır.
   */
  readonly accountingCost?: string
  /**
   * Fatura dönemi.
   *
   * Elektrik, doğalgaz ve şarj hizmeti gibi dönemsel faturalarda hizmetin
   * kapsadığı zaman aralığı.
   */
  readonly invoicePeriod?: InvoicePeriodInput
  /**
   * KDV iade aracı kurumu.
   *
   * Yolcu beraberi eşya (tax free) faturalarında zorunludur.
   */
  readonly taxRepresentative?: TaxRepresentativeInput
  /** Sözleşme atfı. */
  readonly contractDocument?: ContractDocumentReferenceInput
  /** Genel belge atıfları; sırayla yazılır. */
  readonly additionalDocuments?: readonly AdditionalDocumentReferenceInput[]
  /**
   * Belge düzeyinde teslim bilgisi — `cac:Delivery`.
   *
   * Satır düzeyindeki teslimden farklıdır: burada fiili teslim tarihi ve
   * taşıyıcı gibi belgenin tamamına ait bilgiler taşınır.
   */
  readonly delivery?: DeliveryInput
  /**
   * Döviz kuru.
   *
   * Belge para birimi Türk lirası dışındaysa GİB kuru zorunlu tutar.
   */
  readonly exchangeRate?: ExchangeRateInput
}

/** {@link buildInvoice} seçenekleri. */
export interface BuildInvoiceOptions {
  /**
   * Gömülü GİB kod tablolarının önüne geçen ek tanımlar.
   *
   * GİB yeni bir muafiyet, tevkifat ya da vergi türü kodu yayımladığında
   * kütüphane sürümü beklemeden kullanmayı sağlar; var olan bir tanım da
   * düzeltilebilir. Bkz. {@link CodeTables}.
   *
   * @example
   * ```ts
   * buildInvoiceXml(girdi, {
   *   codeTables: {
   *     exemptions: [
   *       { code: '999', name: 'Yeni istisna', taxType: 'KDV', documentType: 'ISTISNA' },
   *     ],
   *   },
   * })
   * ```
   */
  readonly codeTables?: CodeTables

  /**
   * İmza zarfı (`ext:UBLExtensions`) yazılsın mı. Varsayılan `true`.
   *
   * GİB'in UBL-Invoice şemasında kök sıranın **ilk** öğesidir. İskelet
   * yokken şema doğrulaması "bu noktada UBLExtensions bekleniyordu" hatası
   * verir. İçerik boş bırakılır; XAdES imzasını imzalayan doldurur. Zarfı
   * entegratörünüz ekliyorsa `false` yapın.
   */
  readonly includeUblExtensions?: boolean

  /**
   * `cac:Signature` bloğu yazılsın mı. Varsayılan `true`.
   *
   * Satıcının vergi numarasıyla doldurulur. Bu alanın zorunluluğunda
   * uygulamada ayrışma var: yaygın bir üretici hiç yazmıyor ve GİB'in
   * Schematron paketinden geçiyor; XSD doğrulaması yapan bir ekip ise alanı
   * zorunlu buldu. İkisi çelişmez — Schematron her XSD kuralını yeniden
   * denetlemez. Varsayılan, katı olan tarafı seçer.
   */
  readonly includeSignature?: boolean

  /**
   * Yazıyla tutar notu yazılsın mı ve nasıl. `false` ile kapatılır.
   *
   * Not, `cbc:Note` alanlarının ilkine yazılır.
   */
  readonly amountInWords?: false | AmountInWordsNoteOptions

  /**
   * Profil ve fatura tipi uyumu denetlensin mi. Varsayılan `true`.
   *
   * GİB bu eşleşmeyi yalnızca Schematron düzeyinde denetler; XSD
   * denetlemez. Yani uyumsuz bir belge `xmllint` ile şema doğrulamasından
   * geçer ve karşı tarafta reddedilir.
   */
  readonly validateProfileType?: boolean

  /**
   * Çıktı biçimi. Varsayılan `'compact'` — imzalanmaya elverişli.
   *
   * `'indented'` yalnızca insan gözüyle inceleme içindir; girinti,
   * sarmalanmış XAdES imzasında imzalanan içeriğin parçası olur.
   */
  readonly format?: 'compact' | 'indented'
}

/**
 * Bir yüzde değerini kesre çevirir (10 → 0,1).
 *
 * Bölme yapılmaz: ondalığın basamağı iki artırılır, bu tam olarak yüze
 * bölmektir ve hiçbir hassasiyet kaybı yoktur.
 */
const asFraction = (rate: NumericInput): Decimal => {
  const deger = typeof rate === 'object' ? rate : decimal(rate)
  return { units: deger.units, scale: deger.scale + 2 }
}

/** Bir tutarı para birimi öznitelikli `cbc:` öğesine çevirir. */
const amountLeaf = (
  name: string,
  value: Decimal,
  currencyCode: string,
  tables?: CodeTables,
): XmlElement =>
  leaf(CBC, name, toStringValue(value, currencyDefinition(currencyCode, tables).minorUnits), [
    { name: 'currencyID', value: currencyCode },
  ])

/** Bir vergi alt toplamını `cac:TaxSubtotal` öğesine çevirir. */
const buildTaxSubtotal = (
  subtotal: TaxSubtotal,
  currencyCode: string,
  exemption?: { readonly code?: string | undefined; readonly reason?: string | undefined },
  tables?: CodeTables,
): XmlElement =>
  container(CAC, 'TaxSubtotal', [
    amountLeaf('TaxableAmount', subtotal.taxableAmount, currencyCode, tables),
    amountLeaf('TaxAmount', subtotal.taxAmount, currencyCode, tables),
    leaf(CBC, 'Percent', toStringValue(subtotal.rate, 2)),
    container(CAC, 'TaxCategory', [
      optionalLeaf(CBC, 'TaxExemptionReasonCode', exemption?.code),
      // Açıklama verilmediyse koddan tamamlanır. Yalnızca kodu yazıp
      // açıklamayı atlamak yaygın bir eksiktir; açıklama belgenin insan
      // tarafından okunan görüntüsünde de yer alır.
      optionalLeaf(
        CBC,
        'TaxExemptionReason',
        exemption?.reason ??
          (exemption?.code === undefined
            ? undefined
            : exemptionDefinition(exemption.code, tables)?.name),
      ),
      container(CAC, 'TaxScheme', [
        leaf(CBC, 'Name', subtotal.name),
        leaf(CBC, 'TaxTypeCode', subtotal.code),
      ]),
    ]),
  ])

/** Bir hesaplanmış satırı `cac:InvoiceLine` öğesine çevirir. */
const buildInvoiceLine = (
  line: CalculatedLine,
  currencyCode: string,
  kalem: InvoiceBuilderLineInput | undefined,
  tables?: CodeTables,
): XmlElement => {
  const girdi = line.input
  const delivery = kalem?.delivery

  // Öğe sırası UBL `cac:InvoiceLineType` sequence tanımına uyar:
  // `cac:Delivery`, `cac:AllowanceCharge`'dan ÖNCE gelir.
  return container(CAC, 'InvoiceLine', [
    leaf(CBC, 'ID', String(line.id)),
    leaf(
      CBC,
      'InvoicedQuantity',
      toStringValueRange(line.quantity, QUANTITY_MIN_DECIMALS, QUANTITY_MAX_DECIMALS),
      [{ name: 'unitCode', value: lineUnitCode(girdi) }],
    ),
    amountLeaf('LineExtensionAmount', line.lineExtensionAmount, currencyCode, tables),
    delivery === undefined ? undefined : buildDelivery(delivery),
    isZero(line.discountAmount)
      ? undefined
      : container(CAC, 'AllowanceCharge', [
          leaf(CBC, 'ChargeIndicator', 'false'),
          // İskonto ORANI verildiyse çarpan olarak yazılır (yüzde 10 → 0.1).
          // Oran doğrudan girdiden gelir; brüt tutara bölerek hesaplanmaz.
          // Bölme yolu, bedelsiz bir satırda (brüt 0) sıfıra bölme üretir ve
          // belgeye `Infinity` yazar — incelenen bir pakette bu yol açık.
          girdi.discountRate === undefined
            ? undefined
            : leaf(
                CBC,
                'MultiplierFactorNumeric',
                toStringValueRange(asFraction(girdi.discountRate), 0, 6),
              ),
          amountLeaf('Amount', line.discountAmount, currencyCode, tables),
          amountLeaf('BaseAmount', line.grossAmount, currencyCode, tables),
        ]),
    container(CAC, 'TaxTotal', [
      amountLeaf('TaxAmount', line.vatAmount, currencyCode, tables),
      ...line.taxes.map((tax) => buildTaxSubtotal(tax, currencyCode, undefined, tables)),
      buildTaxSubtotal(
        {
          code: VAT_TAX_CODE,
          name: VAT_TAX_NAME,
          rate: line.vatRate,
          taxableAmount: line.vatBase,
          taxAmount: line.vatAmount,
        },
        currencyCode,
        girdi.exemptionCode === undefined && girdi.exemptionReason === undefined
          ? undefined
          : { code: girdi.exemptionCode, reason: girdi.exemptionReason },
        tables,
      ),
    ]),
    container(CAC, 'Item', [
      leaf(CBC, 'Name', girdi.name),
      optionalLeaf(CBC, 'BrandName', kalem?.brandName),
      optionalLeaf(CBC, 'ModelName', kalem?.modelName),
      ...(girdi.additionalIdentifications ?? []).map((kimlik) =>
        container(CAC, 'AdditionalItemIdentification', [
          leaf(CBC, 'ID', kimlik.value, [{ name: 'schemeID', value: kimlik.schemeId }]),
        ]),
      ),
      kalem?.classificationCode === undefined
        ? undefined
        : container(CAC, 'CommodityClassification', [
            leaf(CBC, 'ItemClassificationCode', kalem.classificationCode),
          ]),
      optionalContainer(CAC, 'ItemInstance', [
        optionalLeaf(CBC, 'ProductTraceID', kalem?.productTraceId),
        optionalLeaf(CBC, 'SerialID', kalem?.serialId),
      ]),
    ]),
    container(CAC, 'Price', [amountLeaf('PriceAmount', line.unitPrice, currencyCode, tables)]),
  ])
}

/**
 * Bir e-fatura belgesini UBL-TR öğe ağacına çevirir.
 *
 * Tutarların tamamı {@link calculateInvoice} ile hesaplanır; çağıran toplam
 * vermez. Toplamların satırlarla tutarlı olması bu sayede yapısal bir
 * garantidir — çağıranın verdiği toplama güvenen bir tasarımda, girdi
 * tutarsızsa belge GİB'de reddedilir ve hata çok geç ortaya çıkar.
 *
 * Öğe sırası UBL'nin `xsd:sequence` tanımına uyar. Sıra şemanın parçasıdır:
 * doğru öğeleri yanlış sırada yazmak belgeyi geçersiz kılar.
 *
 * @param input - Fatura girdisi
 * @param options - Üretim seçenekleri
 * @returns Belgenin kök öğesi ve hesaplanmış tutarlar
 * @throws {RangeError} Satır listesi boşsa, bir kod geçersizse ya da profil
 * ile fatura tipi birlikte kullanılamıyorsa
 *
 * @example
 * ```ts
 * const { root, totals } = buildInvoice({
 *   id: 'ABC2026000000001',
 *   uuid: '1a2b3c4d-0001-4000-8001-000000000001',
 *   issueDate: '2026-09-06',
 *   profile: InvoiceProfile.TEMEL,
 *   type: InvoiceType.SATIS,
 *   supplier: { taxNumber: '1234567890', name: 'Satıcı A.Ş.', taxOffice: 'Üsküdar',
 *     address: { district: 'Üsküdar', city: 'İstanbul' } },
 *   customer: { taxNumber: '9876543210', name: 'Alıcı Ltd.',
 *     address: { district: 'Kadıköy', city: 'İstanbul' } },
 *   lines: [{ name: 'Ürün', quantity: 10, unitPrice: 100, vatRate: 20 }],
 * })
 * formatAmount(totals.payableAmount) // '1200.00'
 * ```
 */
export const buildInvoice = (
  input: InvoiceInput,
  options: BuildInvoiceOptions = {},
): { readonly root: XmlElement; readonly totals: CalculatedInvoice } => {
  if ((options.validateProfileType ?? true) && !isProfileTypeAllowed(input.profile, input.type)) {
    throw new DocumentInputError(
      'PROFILE_TYPE_MISMATCH',
      'type',
      `"${input.profile}" profilinde "${input.type}" fatura tipi kullanılamaz. ` +
        'GİB bu eşleşmeyi Schematron ile denetler; XSD denetlemez, ' +
        'yani belge şema doğrulamasından geçse bile reddedilir.',
    )
  }

  const tables = options.codeTables
  const currencyCode = input.currencyCode ?? DEFAULT_CURRENCY_CODE
  const totals = calculateInvoice({
    lines: input.lines,
    currencyCode,
    ...(options.codeTables === undefined ? {} : { codeTables: options.codeTables }),
  })

  const yazyla =
    options.amountInWords === false
      ? undefined
      : amountInWordsNote(totals.payableAmount, currencyCode, {
          ...(options.codeTables === undefined ? {} : { codeTables: options.codeTables }),
          ...(options.amountInWords ?? {}),
        })

  const notlar = [...(yazyla === undefined ? [] : [yazyla]), ...(input.notes ?? [])]

  if (RETURN_TYPES.includes(input.type) && input.billingReference === undefined) {
    throw new DocumentInputError(
      'MISSING_BILLING_REFERENCE',
      'billingReference',
      `"${input.type}" iade tipidir; iade edilen faturaya atıf (billingReference) zorunludur.`,
    )
  }

  const root = container(INVOICE_NS, 'Invoice', [
    (options.includeUblExtensions ?? true)
      ? container(EXT, 'UBLExtensions', [
          container(EXT, 'UBLExtension', [leaf(EXT, 'ExtensionContent', '')]),
        ])
      : undefined,
    leaf(CBC, 'UBLVersionID', UBL_VERSION_ID),
    leaf(CBC, 'CustomizationID', UBL_TR_CUSTOMIZATION_ID),
    leaf(CBC, 'ProfileID', input.profile),
    leaf(CBC, 'ID', input.id),
    leaf(CBC, 'CopyIndicator', 'false'),
    leaf(CBC, 'UUID', input.uuid),
    leaf(CBC, 'IssueDate', input.issueDate),
    optionalLeaf(CBC, 'IssueTime', input.issueTime),
    leaf(CBC, 'InvoiceTypeCode', input.type),
    ...notlar.map((note) => leaf(CBC, 'Note', note)),
    leaf(CBC, 'DocumentCurrencyCode', currencyCode),
    optionalLeaf(CBC, 'AccountingCost', input.accountingCost),
    leaf(CBC, 'LineCountNumeric', String(totals.lines.length)),
    input.invoicePeriod === undefined
      ? undefined
      : container(CAC, 'InvoicePeriod', [
          optionalLeaf(CBC, 'StartDate', input.invoicePeriod.startDate),
          optionalLeaf(CBC, 'StartTime', input.invoicePeriod.startTime),
          optionalLeaf(CBC, 'EndDate', input.invoicePeriod.endDate),
          optionalLeaf(CBC, 'EndTime', input.invoicePeriod.endTime),
        ]),
    input.orderReference === undefined
      ? undefined
      : container(CAC, 'OrderReference', [
          leaf(CBC, 'ID', input.orderReference.id),
          optionalLeaf(CBC, 'IssueDate', input.orderReference.issueDate),
        ]),
    input.billingReference === undefined
      ? undefined
      : container(CAC, 'BillingReference', [
          container(CAC, 'InvoiceDocumentReference', [
            leaf(CBC, 'ID', input.billingReference.id),
            leaf(CBC, 'IssueDate', input.billingReference.issueDate),
            optionalLeaf(CBC, 'UUID', input.billingReference.uuid),
            optionalLeaf(
              CBC,
              'DocumentTypeCode',
              input.billingReference.documentTypeCode ??
                (RETURN_TYPES.includes(input.type) ? input.type : undefined),
            ),
          ]),
        ]),
    input.contractDocument === undefined
      ? undefined
      : container(CAC, 'ContractDocumentReference', [
          leaf(
            CBC,
            'ID',
            input.contractDocument.id,
            input.contractDocument.schemeId === undefined
              ? []
              : [{ name: 'schemeID', value: input.contractDocument.schemeId }],
          ),
          optionalLeaf(CBC, 'IssueDate', input.contractDocument.issueDate),
        ]),
    ...(input.additionalDocuments ?? []).map((belge) =>
      container(CAC, 'AdditionalDocumentReference', [
        leaf(
          CBC,
          'ID',
          belge.id,
          belge.schemeId === undefined ? [] : [{ name: 'schemeID', value: belge.schemeId }],
        ),
        optionalLeaf(CBC, 'IssueDate', belge.issueDate),
        optionalLeaf(CBC, 'DocumentTypeCode', belge.documentTypeCode),
        optionalLeaf(CBC, 'DocumentType', belge.documentType),
        optionalLeaf(CBC, 'DocumentDescription', belge.description),
      ]),
    ),
    (options.includeSignature ?? true)
      ? container(CAC, 'Signature', [
          leaf(CBC, 'ID', input.supplier.taxNumber, [{ name: 'schemeID', value: 'VKN_TCKN' }]),
          container(CAC, 'SignatoryParty', [
            container(CAC, 'PartyIdentification', [
              leaf(CBC, 'ID', input.supplier.taxNumber, [
                {
                  name: 'schemeID',
                  value: input.supplier.taxNumber.length === 11 ? 'TCKN' : 'VKN',
                },
              ]),
            ]),
          ]),
        ])
      : undefined,
    container(CAC, 'AccountingSupplierParty', [buildParty(input.supplier)]),
    container(CAC, 'AccountingCustomerParty', [buildParty(input.customer)]),
    input.buyerCustomer === undefined
      ? undefined
      : container(CAC, 'BuyerCustomerParty', [buildParty(input.buyerCustomer)]),
    input.taxRepresentative === undefined
      ? undefined
      : buildTaxRepresentativeParty(input.taxRepresentative),
    input.delivery === undefined ? undefined : buildDelivery(input.delivery),
    input.paymentMeans === undefined
      ? undefined
      : container(CAC, 'PaymentMeans', [
          leaf(CBC, 'PaymentMeansCode', input.paymentMeans.meansCode),
          optionalLeaf(CBC, 'PaymentDueDate', input.paymentMeans.dueDate),
          optionalContainer(CAC, 'PayeeFinancialAccount', [
            optionalLeaf(CBC, 'ID', input.paymentMeans.accountNumber),
            optionalLeaf(CBC, 'PaymentNote', input.paymentMeans.note),
          ]),
        ]),
    input.exchangeRate === undefined
      ? undefined
      : container(CAC, 'PricingExchangeRate', [
          leaf(CBC, 'SourceCurrencyCode', input.exchangeRate.sourceCurrencyCode ?? currencyCode),
          leaf(
            CBC,
            'TargetCurrencyCode',
            input.exchangeRate.targetCurrencyCode ?? DEFAULT_CURRENCY_CODE,
          ),
          // Kur altı basamakla yazılır: TL karşılığı hesabında kuruş
          // farkı yaratmaması için ondalık hassasiyeti korunur.
          leaf(
            CBC,
            'CalculationRate',
            toStringValue(
              typeof input.exchangeRate.rate === 'object'
                ? input.exchangeRate.rate
                : decimal(input.exchangeRate.rate),
              6,
            ),
          ),
        ]),
    container(CAC, 'TaxTotal', [
      // Kök vergi toplamı alt toplamların MUTLAK toplamıdır: stopaj burada
      // pozitif görünür, ödenecek tutar hesabında ise eksi girer.
      amountLeaf(
        'TaxAmount',
        add(totals.vatTotalAmount, totals.otherTaxTotalAmount),
        currencyCode,
        tables,
      ),
      ...totals.otherTaxSubtotals.map((s) => buildTaxSubtotal(s, currencyCode, undefined, tables)),
      ...totals.vatSubtotals.map((s) =>
        buildTaxSubtotal(
          s,
          currencyCode,
          s.exemptionCode === undefined && s.exemptionReason === undefined
            ? undefined
            : { code: s.exemptionCode, reason: s.exemptionReason },
          tables,
        ),
      ),
    ]),
    totals.withholdingSubtotals.length === 0
      ? undefined
      : container(CAC, 'WithholdingTaxTotal', [
          amountLeaf('TaxAmount', totals.withholdingTotalAmount, currencyCode, tables),
          ...totals.withholdingSubtotals.map((s) =>
            buildTaxSubtotal(s, currencyCode, undefined, tables),
          ),
        ]),
    container(CAC, 'LegalMonetaryTotal', [
      amountLeaf('LineExtensionAmount', totals.lineExtensionAmount, currencyCode, tables),
      amountLeaf('TaxExclusiveAmount', totals.taxExclusiveAmount, currencyCode, tables),
      amountLeaf('TaxInclusiveAmount', totals.taxInclusiveAmount, currencyCode, tables),
      amountLeaf('AllowanceTotalAmount', totals.allowanceTotalAmount, currencyCode, tables),
      amountLeaf('PayableAmount', totals.payableAmount, currencyCode, tables),
    ]),
    ...totals.lines.map((line) =>
      buildInvoiceLine(line, currencyCode, input.lines[line.id - 1], tables),
    ),
  ])

  return { root, totals }
}

/**
 * Bir e-fatura belgesini UBL-TR XML metnine çevirir.
 *
 * {@link buildInvoice} ile aynı işi yapar, sonucu serileştirir.
 *
 * @param input - Fatura girdisi
 * @param options - Üretim seçenekleri
 * @returns UBL-TR XML belgesi
 *
 * @example
 * ```ts
 * const xml = buildInvoiceXml({
 *   id: 'ABC2026000000001',
 *   uuid: '1a2b3c4d-0001-4000-8001-000000000001',
 *   issueDate: '2026-09-06',
 *   profile: InvoiceProfile.TEMEL,
 *   type: InvoiceType.TEVKIFAT,
 *   supplier, customer,
 *   lines: [
 *     { name: 'Bakım', quantity: 10, unitPrice: 100, vatRate: 20, withholdingCode: '603' },
 *   ],
 * })
 * ```
 *
 * @example İnceleme için girintili çıktı
 * ```ts
 * buildInvoiceXml(girdi, { format: 'indented' })
 * // İmzalanacak belgede KULLANMAYIN.
 * ```
 */
export const buildInvoiceXml = (input: InvoiceInput, options: BuildInvoiceOptions = {}): string => {
  const { root } = buildInvoice(input, options)
  const temel = {
    defaultNamespace: INVOICE_NS,
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
