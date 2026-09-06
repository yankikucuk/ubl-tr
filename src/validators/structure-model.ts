import { Namespace } from '../constants/index.js'

const CBC = Namespace.COMMON_BASIC
const CAC = Namespace.COMMON_AGGREGATE
const EXT = Namespace.COMMON_EXTENSION

/** Bir alt öğenin sıradaki yeri ve kaç kez görünebileceği. */
export interface ChildRule {
  /** Alt öğenin ad alanı URI'si. */
  readonly namespace: string
  /** Ön eksiz yerel ad. */
  readonly name: string
  /** En az kaç kez görünmeli. `0` isteğe bağlı demektir. */
  readonly min: number
  /** En fazla kaç kez görünebilir. `Infinity` sınırsız. */
  readonly max: number
}

/** Bir öğe tipinin alt öğe sırası. */
export interface ElementModel {
  /** Modelin ait olduğu ad alanı. */
  readonly namespace: string
  /** Ön eksiz yerel ad. */
  readonly name: string
  /** Alt öğeler, UBL `xsd:sequence` sırasında. */
  readonly children: readonly ChildRule[]
}

/** Zorunlu, tek örnekli `cbc:` alt öğe. */
const b = (name: string): ChildRule => ({ namespace: CBC, name, min: 1, max: 1 })
/** İsteğe bağlı, tek örnekli `cbc:` alt öğe. */
const b0 = (name: string): ChildRule => ({ namespace: CBC, name, min: 0, max: 1 })
/** İsteğe bağlı, tekrarlanabilir `cbc:` alt öğe. */
const bn = (name: string): ChildRule => ({ namespace: CBC, name, min: 0, max: Infinity })
/** Zorunlu, tek örnekli `cac:` alt öğe. */
const a = (name: string): ChildRule => ({ namespace: CAC, name, min: 1, max: 1 })
/** İsteğe bağlı, tek örnekli `cac:` alt öğe. */
const a0 = (name: string): ChildRule => ({ namespace: CAC, name, min: 0, max: 1 })
/** İsteğe bağlı, tekrarlanabilir `cac:` alt öğe. */
const an = (name: string): ChildRule => ({ namespace: CAC, name, min: 0, max: Infinity })
/** En az bir kez, tekrarlanabilir `cac:` alt öğe. */
const a1n = (name: string): ChildRule => ({ namespace: CAC, name, min: 1, max: Infinity })

/**
 * Bu kütüphanenin ürettiği ve okuduğu UBL-TR öğelerinin sıra modeli.
 *
 * **Bu bir XSD işlemcisi değildir.** Gerçek şema doğrulaması bir XML şema
 * motoru ister; o da çalışma zamanı bağımlılığı demektir ve bu paketin
 * sıfır bağımlılık kısıtına aykırıdır. Bunun yerine, XSD'nin yakaladığı
 * hataların **en sık görülen sınıfı** veri olarak kodlanmıştır: alt öğe
 * sırası ve zorunluluk.
 *
 * Yakaladıkları:
 *
 * - Yanlış sıradaki öğe — UBL `xsd:sequence` kullanır; doğru öğeleri yanlış
 *   sırada yazmak belgeyi geçersiz kılar ve bu, elle üretimde en sık yapılan
 *   hatadır.
 * - Eksik zorunlu öğe.
 * - Tanınmayan öğe — yazım hatası ya da yanlış ad alanı.
 * - Tekrar sınırının aşılması.
 *
 * Yakalamadıkları: veri tipi kısıtları (desen, uzunluk, sayı aralığı),
 * öznitelik kuralları ve GİB'in Schematron katmanındaki iş kuralları.
 * Sonuncusu için {@link validateInvoiceRules} vardır.
 *
 * Modelde bulunmayan bir öğe tipinin altı denetlenmez; bu bilinçli bir
 * seçimdir — eksik modelle yanlış hata üretmektense sessiz kalmak yeğdir.
 */
/**
 * `cac:DocumentReference` tipinin çocuk sırası.
 *
 * Ek belge, irsaliye, makbuz ve sipariş kaynağı atıflarının hepsi UBL'de
 * bu tiptedir; sıra tek yerde tanımlanır ki dördü ayrışmasın.
 */
const DOCUMENT_REFERENCE_CHILDREN: readonly ChildRule[] = [
  b('ID'),
  b0('CopyIndicator'),
  b0('UUID'),
  b0('IssueDate'),
  b0('IssueTime'),
  b0('DocumentTypeCode'),
  b0('DocumentType'),
  bn('XPath'),
  b0('LanguageID'),
  b0('LocaleCode'),
  b0('VersionID'),
  b0('DocumentStatusCode'),
  bn('DocumentDescription'),
  a0('Attachment'),
]

/**
 * `cac:ExchangeRate` tipinin çocuk sırası.
 *
 * Fiyatlandırma, vergi ve ödeme kurlarının hepsi UBL'de bu tiptedir.
 */
const EXCHANGE_RATE_CHILDREN: readonly ChildRule[] = [
  b('SourceCurrencyCode'),
  b0('SourceCurrencyBaseRate'),
  b('TargetCurrencyCode'),
  b0('TargetCurrencyBaseRate'),
  b0('ExchangeMarketID'),
  b0('CalculationRate'),
  b0('MathematicOperatorCode'),
  b0('Date'),
  a0('ForeignExchangeContract'),
]

/** `cac:Party` tipinin çocuk sırası; imzalayan taraf da bu tiptedir. */
const PARTY_CHILDREN: readonly ChildRule[] = [
  b0('MarkCareIndicator'),
  b0('MarkAttentionIndicator'),
  b0('WebsiteURI'),
  b0('LogoReferenceID'),
  b0('EndpointID'),
  b0('IndustryClassificationCode'),
  an('PartyIdentification'),
  an('PartyName'),
  b0('Language'),
  a0('PostalAddress'),
  a0('PhysicalLocation'),
  an('PartyTaxScheme'),
  an('PartyLegalEntity'),
  a0('Contact'),
  a0('Person'),
  a0('AgentParty'),
]

/** `cac:Package` tipinin çocuk sırası; fiili kap da bu tiptedir. */
const PACKAGE_CHILDREN: readonly ChildRule[] = [
  b0('ID'),
  b0('Quantity'),
  b0('ReturnableMaterialIndicator'),
  b0('PackageLevelCode'),
  b0('PackagingTypeCode'),
  bn('PackingMaterial'),
  an('ContainedPackage'),
  a0('ContainingTransportEquipment'),
  an('GoodsItem'),
  an('MeasurementDimension'),
  an('DeliveryUnit'),
  a0('Delivery'),
  a0('Despatch'),
]

export const STRUCTURE_MODELS: readonly ElementModel[] = [
  {
    namespace: 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
    name: 'Invoice',
    children: [
      { namespace: EXT, name: 'UBLExtensions', min: 0, max: 1 },
      b0('UBLVersionID'),
      b('CustomizationID'),
      b('ProfileID'),
      b('ID'),
      b0('CopyIndicator'),
      b0('UUID'),
      b('IssueDate'),
      b0('IssueTime'),
      b0('DueDate'),
      b('InvoiceTypeCode'),
      bn('Note'),
      b0('TaxPointDate'),
      b('DocumentCurrencyCode'),
      b0('TaxCurrencyCode'),
      b0('PricingCurrencyCode'),
      b0('PaymentCurrencyCode'),
      b0('PaymentAlternativeCurrencyCode'),
      b0('AccountingCostCode'),
      b0('AccountingCost'),
      b0('LineCountNumeric'),
      a0('InvoicePeriod'),
      a0('OrderReference'),
      an('BillingReference'),
      an('DespatchDocumentReference'),
      an('ReceiptDocumentReference'),
      an('OriginatorDocumentReference'),
      an('ContractDocumentReference'),
      an('AdditionalDocumentReference'),
      an('Signature'),
      a('AccountingSupplierParty'),
      a('AccountingCustomerParty'),
      a0('PayeeParty'),
      a0('BuyerCustomerParty'),
      a0('SellerSupplierParty'),
      a0('TaxRepresentativeParty'),
      an('Delivery'),
      a0('DeliveryTerms'),
      an('PaymentMeans'),
      an('PaymentTerms'),
      an('PrepaidPayment'),
      an('AllowanceCharge'),
      a0('TaxExchangeRate'),
      a0('PricingExchangeRate'),
      a0('PaymentExchangeRate'),
      a0('PaymentAlternativeExchangeRate'),
      an('TaxTotal'),
      an('WithholdingTaxTotal'),
      a('LegalMonetaryTotal'),
      a1n('InvoiceLine'),
    ],
  },
  {
    namespace: 'urn:oasis:names:specification:ubl:schema:xsd:DespatchAdvice-2',
    name: 'DespatchAdvice',
    children: [
      { namespace: EXT, name: 'UBLExtensions', min: 0, max: 1 },
      b0('UBLVersionID'),
      b('CustomizationID'),
      b('ProfileID'),
      b('ID'),
      b0('CopyIndicator'),
      b0('UUID'),
      b('IssueDate'),
      b0('IssueTime'),
      b0('DespatchAdviceTypeCode'),
      bn('Note'),
      b0('LineCountNumeric'),
      an('OrderReference'),
      an('AdditionalDocumentReference'),
      an('Signature'),
      a('DespatchSupplierParty'),
      a('DeliveryCustomerParty'),
      a0('BuyerCustomerParty'),
      a0('SellerSupplierParty'),
      a0('OriginatorCustomerParty'),
      a0('Shipment'),
      a1n('DespatchLine'),
    ],
  },
  {
    namespace: CAC,
    name: 'Party',
    children: PARTY_CHILDREN,
  },
  {
    namespace: CAC,
    name: 'PostalAddress',
    children: [
      b0('ID'),
      b0('Postbox'),
      b0('Room'),
      b0('StreetName'),
      b0('BlockName'),
      b0('BuildingName'),
      b0('BuildingNumber'),
      b0('CitySubdivisionName'),
      b0('CityName'),
      b0('PostalZone'),
      b0('Region'),
      b0('District'),
      an('AddressLine'),
      a0('Country'),
    ],
  },
  {
    namespace: CAC,
    name: 'InvoiceLine',
    children: [
      b('ID'),
      bn('Note'),
      b('InvoicedQuantity'),
      b('LineExtensionAmount'),
      b0('AccountingCost'),
      b0('FreeOfChargeIndicator'),
      a0('InvoicePeriod'),
      an('OrderLineReference'),
      an('DespatchLineReference'),
      an('ReceiptLineReference'),
      an('BillingReference'),
      an('DocumentReference'),
      a0('PricingReference'),
      a0('OriginatorParty'),
      an('Delivery'),
      an('PaymentTerms'),
      an('AllowanceCharge'),
      an('TaxTotal'),
      an('WithholdingTaxTotal'),
      a('Item'),
      a0('Price'),
      a0('DeliveryTerms'),
      an('SubInvoiceLine'),
    ],
  },
  {
    namespace: CAC,
    name: 'DespatchLine',
    children: [
      b('ID'),
      bn('Note'),
      b('DeliveredQuantity'),
      b0('OutstandingQuantity'),
      bn('OutstandingReason'),
      b0('OversupplyQuantity'),
      an('OrderLineReference'),
      an('DocumentReference'),
      a('Item'),
      an('Shipment'),
    ],
  },
  {
    namespace: CAC,
    name: 'TaxTotal',
    children: [b('TaxAmount'), b0('RoundingAmount'), b0('TaxEvidenceIndicator'), an('TaxSubtotal')],
  },
  {
    namespace: CAC,
    name: 'WithholdingTaxTotal',
    children: [b('TaxAmount'), b0('RoundingAmount'), an('TaxSubtotal')],
  },
  {
    namespace: CAC,
    name: 'TaxSubtotal',
    children: [
      b('TaxableAmount'),
      b('TaxAmount'),
      b0('CalculationSequenceNumeric'),
      b0('TransactionCurrencyTaxAmount'),
      b0('Percent'),
      b0('BaseUnitMeasure'),
      b0('PerUnitAmount'),
      b0('TierRange'),
      b0('TierRatePercent'),
      a('TaxCategory'),
    ],
  },
  {
    namespace: CAC,
    name: 'TaxCategory',
    children: [
      b0('ID'),
      b0('Name'),
      b0('Percent'),
      b0('BaseUnitMeasure'),
      b0('PerUnitAmount'),
      b0('TaxExemptionReasonCode'),
      bn('TaxExemptionReason'),
      b0('TierRange'),
      b0('TierRatePercent'),
      a('TaxScheme'),
    ],
  },
  {
    namespace: CAC,
    name: 'TaxScheme',
    children: [b0('ID'), b0('Name'), b0('TaxTypeCode'), b0('CurrencyCode')],
  },
  {
    namespace: CAC,
    name: 'LegalMonetaryTotal',
    children: [
      b('LineExtensionAmount'),
      b('TaxExclusiveAmount'),
      b('TaxInclusiveAmount'),
      b0('AllowanceTotalAmount'),
      b0('ChargeTotalAmount'),
      b0('PrepaidAmount'),
      b0('PayableRoundingAmount'),
      b('PayableAmount'),
    ],
  },
  {
    namespace: CAC,
    name: 'Item',
    children: [
      b0('Description'),
      b0('PackQuantity'),
      b0('PackSizeNumeric'),
      b('Name'),
      b0('Keyword'),
      b0('BrandName'),
      b0('ModelName'),
      a0('BuyersItemIdentification'),
      a0('SellersItemIdentification'),
      a0('ManufacturersItemIdentification'),
      a0('StandardItemIdentification'),
      an('AdditionalItemIdentification'),
      a0('OriginCountry'),
      an('CommodityClassification'),
      an('AdditionalItemProperty'),
      an('ItemInstance'),
    ],
  },
  {
    namespace: CAC,
    name: 'Price',
    children: [
      b('PriceAmount'),
      b0('BaseQuantity'),
      b0('OrderableUnitFactorRate'),
      an('AllowanceCharge'),
    ],
  },
  {
    namespace: CAC,
    name: 'AllowanceCharge',
    children: [
      b('ChargeIndicator'),
      b0('AllowanceChargeReasonCode'),
      b0('AllowanceChargeReason'),
      b0('MultiplierFactorNumeric'),
      b0('SequenceNumeric'),
      b('Amount'),
      b0('BaseAmount'),
      b0('PerUnitAmount'),
      an('TaxCategory'),
      a0('TaxTotal'),
    ],
  },
  {
    namespace: CAC,
    name: 'PaymentMeans',
    children: [
      b('PaymentMeansCode'),
      b0('PaymentDueDate'),
      b0('PaymentChannelCode'),
      b0('InstructionID'),
      bn('InstructionNote'),
      b0('PaymentID'),
      a0('PayeeFinancialAccount'),
      a0('CreditAccount'),
    ],
  },
  {
    namespace: CAC,
    name: 'PayeeFinancialAccount',
    children: [
      b0('ID'),
      b0('Name'),
      b0('CurrencyCode'),
      b0('PaymentNote'),
      a0('FinancialInstitutionBranch'),
    ],
  },
  {
    namespace: CAC,
    name: 'Delivery',
    children: [
      b0('ID'),
      b0('Quantity'),
      b0('ActualDeliveryDate'),
      b0('ActualDeliveryTime'),
      b0('LatestDeliveryDate'),
      b0('LatestDeliveryTime'),
      b0('TrackingID'),
      a0('DeliveryAddress'),
      a0('DeliveryLocation'),
      a0('RequestedDeliveryPeriod'),
      a0('PromisedDeliveryPeriod'),
      a0('EstimatedDeliveryPeriod'),
      a0('DeliveryParty'),
      a0('CarrierParty'),
      an('NotifyParty'),
      a0('Despatch'),
      an('DeliveryTerms'),
      a0('Shipment'),
    ],
  },
  {
    namespace: CAC,
    name: 'Shipment',
    children: [
      b('ID'),
      b0('ShippingPriorityLevelCode'),
      b0('HandlingCode'),
      bn('HandlingInstructions'),
      bn('Information'),
      b0('GrossWeightMeasure'),
      b0('NetWeightMeasure'),
      b0('GrossVolumeMeasure'),
      b0('NetVolumeMeasure'),
      b0('TotalGoodsItemQuantity'),
      b0('TotalTransportHandlingUnitQuantity'),
      b0('InsuranceValueAmount'),
      b0('DeclaredCustomsValueAmount'),
      b0('DeclaredForCarriageValueAmount'),
      b0('DeclaredStatisticsValueAmount'),
      b0('FreeOnBoardValueAmount'),
      bn('SpecialInstructions'),
      b0('DeliveryInstructions'),
      b0('SplitConsignmentIndicator'),
      an('Consignment'),
      an('GoodsItem'),
      an('ShipmentStage'),
      a0('Delivery'),
      an('TransportHandlingUnit'),
      a0('ReturnAddress'),
      a0('FirstArrivalPortLocation'),
      a0('LastExitPortLocation'),
    ],
  },
  {
    namespace: CAC,
    name: 'ShipmentStage',
    children: [
      b0('ID'),
      b0('TransportModeCode'),
      b0('TransportMeansTypeCode'),
      b0('TransitDirectionCode'),
      a0('TransportMeans'),
      an('DriverPerson'),
      a0('LoadingPortLocation'),
      a0('UnloadingPortLocation'),
    ],
  },
  {
    namespace: CAC,
    name: 'TransportMeans',
    children: [
      b0('JourneyID'),
      b0('RegistrationNationalityID'),
      b0('DirectionCode'),
      b0('TransportMeansTypeCode'),
      b0('TradeServiceCode'),
      a0('AirTransport'),
      a0('RoadTransport'),
      a0('RailTransport'),
      a0('MaritimeTransport'),
      a0('OwnerParty'),
    ],
  },
  { namespace: CAC, name: 'RoadTransport', children: [bn('LicensePlateID')] },
  {
    namespace: CAC,
    name: 'Person',
    children: [
      b0('FirstName'),
      b0('FamilyName'),
      b0('Title'),
      b0('MiddleName'),
      b0('NameSuffix'),
      b0('JobTitle'),
      b0('NationalityID'),
      b0('GenderCode'),
      b0('BirthDate'),
      b0('BirthplaceName'),
      a0('Contact'),
      an('IdentityDocumentReference'),
    ],
  },
  {
    namespace: CAC,
    name: 'Contact',
    children: [
      b0('ID'),
      b0('Name'),
      b0('Telephone'),
      b0('Telefax'),
      b0('ElectronicMail'),
      b0('Note'),
    ],
  },
  { namespace: CAC, name: 'Country', children: [b0('IdentificationCode'), b0('Name')] },
  { namespace: CAC, name: 'PartyName', children: [b('Name')] },
  { namespace: CAC, name: 'PartyIdentification', children: [b('ID')] },
  { namespace: CAC, name: 'PartyLegalEntity', children: [b0('RegistrationName'), b0('CompanyID')] },
  {
    namespace: CAC,
    name: 'PartyTaxScheme',
    children: [b0('RegistrationName'), b0('CompanyID'), a0('TaxScheme')],
  },
  {
    namespace: CAC,
    name: 'InvoicePeriod',
    children: [
      b0('StartDate'),
      b0('StartTime'),
      b0('EndDate'),
      b0('EndTime'),
      b0('DurationMeasure'),
      b0('DescriptionCode'),
      bn('Description'),
    ],
  },
  {
    namespace: CAC,
    name: 'OrderReference',
    children: [
      b('ID'),
      b0('SalesOrderID'),
      b0('CopyIndicator'),
      b0('UUID'),
      b0('IssueDate'),
      b0('IssueTime'),
      b0('CustomerReference'),
      b0('OrderTypeCode'),
      bn('DocumentReference'),
    ],
  },
  {
    namespace: CAC,
    name: 'OrderLineReference',
    children: [
      b('LineID'),
      b0('SalesOrderLineID'),
      b0('UUID'),
      b0('LineStatusCode'),
      a0('OrderReference'),
    ],
  },
  {
    namespace: CAC,
    name: 'AdditionalDocumentReference',
    children: DOCUMENT_REFERENCE_CHILDREN,
  },
  {
    namespace: CAC,
    name: 'DespatchDocumentReference',
    children: DOCUMENT_REFERENCE_CHILDREN,
  },
  {
    namespace: CAC,
    name: 'ReceiptDocumentReference',
    children: DOCUMENT_REFERENCE_CHILDREN,
  },
  {
    namespace: CAC,
    name: 'OriginatorDocumentReference',
    children: DOCUMENT_REFERENCE_CHILDREN,
  },
  {
    namespace: CAC,
    name: 'Attachment',
    children: [b0('EmbeddedDocumentBinaryObject'), a0('ExternalReference')],
  },
  {
    namespace: CAC,
    name: 'ExternalReference',
    children: [
      b0('URI'),
      b0('DocumentHash'),
      b0('HashAlgorithmMethod'),
      b0('ExpiryDate'),
      b0('ExpiryTime'),
      b0('MimeCode'),
      b0('FormatCode'),
      b0('EncodingCode'),
      b0('CharacterSetCode'),
      b0('FileName'),
      bn('Description'),
    ],
  },
  {
    namespace: CAC,
    name: 'PaymentTerms',
    children: [
      b0('ID'),
      b0('PaymentMeansID'),
      b0('PrepaidPaymentReferenceID'),
      bn('Note'),
      b0('ReferenceEventCode'),
      b0('SettlementDiscountPercent'),
      b0('PenaltySurchargePercent'),
      b0('PaymentPercent'),
      b0('Amount'),
      b0('SettlementDiscountAmount'),
      b0('PenaltyAmount'),
      b0('PaymentTermsDetailsURI'),
      b0('PaymentDueDate'),
      b0('InstallmentDueDate'),
      b0('InvoicePeriod'),
    ],
  },
  {
    namespace: CAC,
    name: 'ContractDocumentReference',
    children: [
      b('ID'),
      b0('CopyIndicator'),
      b0('UUID'),
      b0('IssueDate'),
      b0('IssueTime'),
      b0('DocumentTypeCode'),
      b0('DocumentType'),
      bn('DocumentDescription'),
    ],
  },
  {
    namespace: CAC,
    name: 'BillingReference',
    children: [
      a0('InvoiceDocumentReference'),
      a0('SelfBilledInvoiceDocumentReference'),
      a0('CreditNoteDocumentReference'),
      a0('DespatchDocumentReference'),
    ],
  },
  {
    namespace: CAC,
    name: 'InvoiceDocumentReference',
    children: [
      b('ID'),
      b0('CopyIndicator'),
      b0('UUID'),
      b0('IssueDate'),
      b0('IssueTime'),
      b0('DocumentTypeCode'),
      b0('DocumentType'),
      bn('DocumentDescription'),
    ],
  },
  {
    namespace: CAC,
    name: 'Signature',
    children: [
      b('ID'),
      b0('Note'),
      b0('ValidationDate'),
      b0('ValidationTime'),
      b0('ValidatorID'),
      b0('CanonicalizationMethod'),
      b0('SignatureMethod'),
      a0('SignatoryParty'),
      a0('DigitalSignatureAttachment'),
      a0('OriginalDocumentReference'),
    ],
  },
  {
    namespace: CAC,
    name: 'PricingExchangeRate',
    children: EXCHANGE_RATE_CHILDREN,
  },
  {
    namespace: CAC,
    name: 'TaxExchangeRate',
    children: EXCHANGE_RATE_CHILDREN,
  },
  {
    namespace: CAC,
    name: 'PaymentExchangeRate',
    children: EXCHANGE_RATE_CHILDREN,
  },
  {
    namespace: CAC,
    name: 'SignatoryParty',
    children: PARTY_CHILDREN,
  },
  {
    namespace: CAC,
    name: 'DigitalSignatureAttachment',
    children: [b0('EmbeddedDocumentBinaryObject'), a0('ExternalReference')],
  },
  {
    namespace: CAC,
    name: 'CommodityClassification',
    children: [
      b0('NatureCode'),
      b0('CargoTypeCode'),
      b0('CommodityCode'),
      b0('ItemClassificationCode'),
    ],
  },
  {
    namespace: CAC,
    name: 'ItemInstance',
    children: [
      b0('ProductTraceID'),
      b0('ManufactureDate'),
      b0('ManufactureTime'),
      b0('BestBeforeDate'),
      b0('RegistrationID'),
      b0('SerialID'),
      an('AdditionalItemProperty'),
      a0('LotIdentification'),
    ],
  },
  { namespace: CAC, name: 'AdditionalItemIdentification', children: [b('ID'), b0('ExtendedID')] },
  {
    namespace: CAC,
    name: 'DeliveryTerms',
    children: [
      b0('ID'),
      bn('SpecialTerms'),
      b0('LossRiskResponsibilityCode'),
      bn('LossRisk'),
      b0('Amount'),
      a0('DeliveryLocation'),
      a0('AllowanceCharge'),
    ],
  },
  {
    namespace: CAC,
    name: 'Despatch',
    children: [
      b0('ID'),
      b0('RequestedDespatchDate'),
      b0('RequestedDespatchTime'),
      b0('EstimatedDespatchDate'),
      b0('EstimatedDespatchTime'),
      b0('ActualDespatchDate'),
      b0('ActualDespatchTime'),
      b0('GuaranteedDespatchDate'),
      b0('GuaranteedDespatchTime'),
      b0('ReleaseID'),
      bn('Instructions'),
      a0('DespatchAddress'),
      a0('DespatchLocation'),
      a0('DespatchParty'),
      a0('CarrierParty'),
      an('NotifyParty'),
      a0('Contact'),
      a0('EstimatedDespatchPeriod'),
    ],
  },
  {
    namespace: CAC,
    name: 'GoodsItem',
    children: [
      b0('ID'),
      b0('SequenceNumberID'),
      bn('Description'),
      b0('HazardousRiskIndicator'),
      b0('DeclaredCustomsValueAmount'),
      b0('DeclaredForCarriageValueAmount'),
      b0('DeclaredStatisticsValueAmount'),
      b0('FreeOnBoardValueAmount'),
      b0('InsuranceValueAmount'),
      b0('ValueAmount'),
      b0('GrossWeightMeasure'),
      b0('NetWeightMeasure'),
      b0('ChargeableWeightMeasure'),
      b0('GrossVolumeMeasure'),
      b0('NetVolumeMeasure'),
      b0('Quantity'),
      b0('PreferenceCriterionCode'),
      b0('RequiredCustomsID'),
      b0('CustomsStatusCode'),
      b0('CustomsTariffQuantity'),
      b0('CustomsImportClassifiedIndicator'),
      b0('ChargeableQuantity'),
      b0('ReturnableQuantity'),
      b0('TraceID'),
      an('Item'),
      an('GoodsItemContainer'),
      an('FreightAllowanceCharge'),
      an('InvoiceLine'),
      an('Temperature'),
      an('ContainedGoodsItem'),
      a0('OriginAddress'),
      a0('Delivery'),
      a0('Despatch'),
      an('MeasurementDimension'),
      an('ContainingPackage'),
      a0('ShipmentDocumentReference'),
      a0('MinimumTemperature'),
      a0('MaximumTemperature'),
    ],
  },
  {
    namespace: CAC,
    name: 'ActualPackage',
    children: PACKAGE_CHILDREN,
  },
  {
    namespace: CAC,
    name: 'Package',
    children: PACKAGE_CHILDREN,
  },
  {
    namespace: CAC,
    name: 'TransportHandlingUnit',
    children: [
      b0('ID'),
      b0('TransportHandlingUnitTypeCode'),
      b0('HandlingCode'),
      bn('HandlingInstructions'),
      b0('HazardousRiskIndicator'),
      b0('TotalGoodsItemQuantity'),
      b0('TotalPackageQuantity'),
      bn('DamageRemarks'),
      bn('ShippingMarks'),
      b0('TraceID'),
      an('HandlingUnitDespatchLine'),
      an('ActualPackage'),
      an('ReceivedHandlingUnitReceiptLine'),
      an('TransportEquipment'),
      an('TransportMeans'),
      an('HazardousGoodsTransit'),
      an('MeasurementDimension'),
      an('MinimumTemperature'),
      an('MaximumTemperature'),
      an('GoodsItem'),
      an('FloorSpaceMeasurementDimension'),
      an('PalletSpaceMeasurementDimension'),
      an('ShipmentDocumentReference'),
      an('Status'),
      an('CustomsDeclaration'),
      an('Package'),
    ],
  },
  { namespace: CAC, name: 'CustomsDeclaration', children: [b('ID'), a0('IssuerParty')] },
  {
    namespace: CAC,
    name: 'IdentityDocumentReference',
    children: [b('ID'), b0('IssueDate'), b0('DocumentTypeCode'), b0('DocumentType')],
  },
  {
    namespace: CAC,
    name: 'TransportEquipment',
    children: [
      b0('ID'),
      b0('ReferencedConsignmentID'),
      b0('TransportEquipmentTypeCode'),
      b0('ProviderTypeCode'),
      b0('OwnerTypeCode'),
      b0('SizeTypeCode'),
      b0('DispositionCode'),
      b0('FullnessIndicationCode'),
      b0('RefrigerationOnIndicator'),
      bn('Information'),
      b0('ReturnabilityIndicator'),
      b0('LegalStatusIndicator'),
    ],
  },
]

const MODEL_MAP = new Map(STRUCTURE_MODELS.map((m) => [`${m.namespace}#${m.name}`, m]))

/**
 * Bir öğe tipinin sıra modelini döndürür.
 *
 * @param namespace - Öğenin ad alanı URI'si
 * @param name - Ön eksiz yerel ad
 * @returns Model; tanımlı değilse `undefined`
 *
 * @example
 * ```ts
 * structureModel(Namespace.COMMON_AGGREGATE, 'TaxTotal')?.children.length // 4
 * structureModel(Namespace.COMMON_AGGREGATE, 'Bilinmeyen') // undefined
 * ```
 */
export const structureModel = (namespace: string, name: string): ElementModel | undefined =>
  MODEL_MAP.get(`${namespace}#${name}`)
