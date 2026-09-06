import { Namespace } from '../constants/index.js'
import { attribute, child, children, text, type XmlElement } from '../core/index.js'

import { compact, parseWrappedParty, readDecimal } from './party.js'
import type {
  ParsedInvoice,
  ParsedInvoiceLine,
  ParsedMonetaryTotal,
  ParsedTaxSubtotal,
} from './types.js'

const CBC = Namespace.COMMON_BASIC
const CAC = Namespace.COMMON_AGGREGATE

/** Bir `cac:TaxSubtotal` öğesini okur. */
const parseTaxSubtotal = (subtotal: XmlElement): ParsedTaxSubtotal => {
  const kategori = child(subtotal, CAC, 'TaxCategory')
  const sema = kategori === undefined ? undefined : child(kategori, CAC, 'TaxScheme')
  return compact({
    code: sema === undefined ? undefined : text(sema, 'TaxTypeCode'),
    name: sema === undefined ? undefined : text(sema, 'Name'),
    rate: readDecimal(text(subtotal, 'Percent')),
    taxableAmount: readDecimal(text(subtotal, 'TaxableAmount')),
    taxAmount: readDecimal(text(subtotal, 'TaxAmount')),
    exemptionCode: kategori === undefined ? undefined : text(kategori, 'TaxExemptionReasonCode'),
    exemptionReason: kategori === undefined ? undefined : text(kategori, 'TaxExemptionReason'),
  })
}

/** Bir `cac:InvoiceLine` öğesini okur. */
const parseLine = (line: XmlElement): ParsedInvoiceLine => {
  const miktar = child(line, CBC, 'InvoicedQuantity')
  const kalem = child(line, CAC, 'Item')
  const fiyat = child(line, CAC, 'Price')
  const iskonto = child(line, CAC, 'AllowanceCharge')
  const vergiToplami = child(line, CAC, 'TaxTotal')

  return compact({
    id: text(line, 'ID'),
    notes: children(line, CBC, 'Note').flatMap((n) => (n.kind === 'leaf' ? [n.text] : [])),
    quantity: miktar?.kind === 'leaf' ? readDecimal(miktar.text) : undefined,
    unitCode: miktar === undefined ? undefined : attribute(miktar, 'unitCode'),
    lineExtensionAmount: readDecimal(text(line, 'LineExtensionAmount')),
    unitPrice: fiyat === undefined ? undefined : readDecimal(text(fiyat, 'PriceAmount')),
    itemName: kalem === undefined ? undefined : text(kalem, 'Name'),
    brandName: kalem === undefined ? undefined : text(kalem, 'BrandName'),
    modelName: kalem === undefined ? undefined : text(kalem, 'ModelName'),
    identifications:
      kalem === undefined
        ? []
        : children(kalem, CAC, 'AdditionalItemIdentification').flatMap((k) => {
            const id = child(k, CBC, 'ID')
            return id?.kind === 'leaf'
              ? [compact({ schemeId: attribute(id, 'schemeID'), value: id.text })]
              : []
          }),
    taxSubtotals:
      vergiToplami === undefined
        ? []
        : children(vergiToplami, CAC, 'TaxSubtotal').map(parseTaxSubtotal),
    discountAmount: iskonto === undefined ? undefined : readDecimal(text(iskonto, 'Amount')),
  })
}

/** `cac:LegalMonetaryTotal` öğesini okur. */
const parseTotals = (totals: XmlElement | undefined): ParsedMonetaryTotal =>
  totals === undefined
    ? {}
    : compact({
        lineExtensionAmount: readDecimal(text(totals, 'LineExtensionAmount')),
        taxExclusiveAmount: readDecimal(text(totals, 'TaxExclusiveAmount')),
        taxInclusiveAmount: readDecimal(text(totals, 'TaxInclusiveAmount')),
        allowanceTotalAmount: readDecimal(text(totals, 'AllowanceTotalAmount')),
        payableAmount: readDecimal(text(totals, 'PayableAmount')),
      })

/**
 * Bir UBL-TR e-faturasını tipli nesneye çevirir.
 *
 * Okuma tipi yazma tipinden **kasten farklıdır**. Yazarken toplamları
 * kütüphane hesaplar; okurken belgede yazan ne ise o gelir — hesaplanmış
 * toplamlar dâhil. İkisini tek tip yapmak, okunan belgenin toplamlarının
 * doğrulanmış olduğu izlenimi verirdi; oysa doğrulama ayrı bir adımdır.
 *
 * Ayrıştırma **hoşgörülüdür**: eksik ya da bozuk bir alan `undefined`
 * kalır, belgenin tamamı okunamaz hâle gelmez. Belgenin geçerliliğini
 * söylemek {@link validateStructure} ve {@link validateInvoiceRules}
 * işlerinin görevidir; ayrıştırıcının görevi okumaktır.
 *
 * Hiçbir değerin türü tahmin edilmez: tanımlayıcılar `string`, tutarlar
 * tam sabit noktalı `Decimal` olarak gelir.
 *
 * @param root - Faturanın kök öğesi
 * @returns Okunmuş fatura
 *
 * @example
 * ```ts
 * const { root } = parseDocument(gelenXml)
 * const fatura = parseInvoice(root)
 * fatura.supplier?.name       // 'Satıcı A.Ş.'
 * fatura.lines.length         // 3
 * formatAmount(fatura.totals.payableAmount!) // '1200.00'
 * ```
 *
 * @example Okuma ve doğrulamayı birlikte kullanmak
 * ```ts
 * const { root } = parseDocument(gelenXml)
 * const sonuc = validateInvoiceRules(root)
 * if (!sonuc.valid) return reddet(sonuc.issues)
 * const fatura = parseInvoice(root)
 * ```
 */
export const parseInvoice = (root: XmlElement): ParsedInvoice => {
  const vergiToplamlari = children(root, CAC, 'TaxTotal')
  const tevkifatToplamlari = children(root, CAC, 'WithholdingTaxTotal')
  const iadeAtfi = child(root, CAC, 'BillingReference')
  const iadeBelgesi =
    iadeAtfi === undefined ? undefined : child(iadeAtfi, CAC, 'InvoiceDocumentReference')
  const siparis = child(root, CAC, 'OrderReference')
  const odeme = child(root, CAC, 'PaymentMeans')
  const hesap = odeme === undefined ? undefined : child(odeme, CAC, 'PayeeFinancialAccount')
  const kur = child(root, CAC, 'PricingExchangeRate')

  return compact({
    profile: text(root, 'ProfileID'),
    type: text(root, 'InvoiceTypeCode'),
    id: text(root, 'ID'),
    uuid: text(root, 'UUID'),
    issueDate: text(root, 'IssueDate'),
    issueTime: text(root, 'IssueTime'),
    currencyCode: text(root, 'DocumentCurrencyCode'),
    notes: children(root, CBC, 'Note').flatMap((n) => (n.kind === 'leaf' ? [n.text] : [])),
    supplier: parseWrappedParty(child(root, CAC, 'AccountingSupplierParty')),
    customer: parseWrappedParty(child(root, CAC, 'AccountingCustomerParty')),
    buyerCustomer: parseWrappedParty(child(root, CAC, 'BuyerCustomerParty')),
    lines: children(root, CAC, 'InvoiceLine').map(parseLine),
    taxSubtotals: vergiToplamlari.flatMap((t) =>
      children(t, CAC, 'TaxSubtotal').map(parseTaxSubtotal),
    ),
    withholdingSubtotals: tevkifatToplamlari.flatMap((t) =>
      children(t, CAC, 'TaxSubtotal').map(parseTaxSubtotal),
    ),
    taxAmount:
      vergiToplamlari[0] === undefined
        ? undefined
        : readDecimal(text(vergiToplamlari[0], 'TaxAmount')),
    withholdingTaxAmount:
      tevkifatToplamlari[0] === undefined
        ? undefined
        : readDecimal(text(tevkifatToplamlari[0], 'TaxAmount')),
    totals: parseTotals(child(root, CAC, 'LegalMonetaryTotal')),
    billingReference:
      iadeBelgesi === undefined
        ? undefined
        : compact({
            id: text(iadeBelgesi, 'ID'),
            issueDate: text(iadeBelgesi, 'IssueDate'),
            uuid: text(iadeBelgesi, 'UUID'),
            documentTypeCode: text(iadeBelgesi, 'DocumentTypeCode'),
          }),
    orderReference:
      siparis === undefined
        ? undefined
        : compact({ id: text(siparis, 'ID'), issueDate: text(siparis, 'IssueDate') }),
    paymentMeans:
      odeme === undefined
        ? undefined
        : compact({
            meansCode: text(odeme, 'PaymentMeansCode'),
            dueDate: text(odeme, 'PaymentDueDate'),
            accountNumber: hesap === undefined ? undefined : text(hesap, 'ID'),
            note: hesap === undefined ? undefined : text(hesap, 'PaymentNote'),
          }),
    exchangeRate:
      kur === undefined
        ? undefined
        : compact({
            sourceCurrencyCode: text(kur, 'SourceCurrencyCode'),
            targetCurrencyCode: text(kur, 'TargetCurrencyCode'),
            rate: readDecimal(text(kur, 'CalculationRate')),
          }),
    additionalDocuments: children(root, CAC, 'AdditionalDocumentReference').map((b) =>
      compact({
        id: text(b, 'ID'),
        issueDate: text(b, 'IssueDate'),
        documentTypeCode: text(b, 'DocumentTypeCode'),
        documentType: text(b, 'DocumentType'),
        description: text(b, 'DocumentDescription'),
      }),
    ),
  })
}
