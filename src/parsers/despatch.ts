import { Namespace } from '../constants/index.js'
import { attribute, child, children, text, type XmlElement } from '../core/index.js'

import { compact, parseParty, parseWrappedParty, readDecimal } from './party.js'
import type { ParsedDespatchAdvice, ParsedDespatchLine } from './types.js'

const CBC = Namespace.COMMON_BASIC
const CAC = Namespace.COMMON_AGGREGATE

/** Bir `cac:DespatchLine` öğesini okur. */
const parseLine = (line: XmlElement): ParsedDespatchLine => {
  const miktar = child(line, CBC, 'DeliveredQuantity')
  const kalem = child(line, CAC, 'Item')
  return compact({
    id: text(line, 'ID'),
    quantity: miktar?.kind === 'leaf' ? readDecimal(miktar.text) : undefined,
    unitCode: miktar === undefined ? undefined : attribute(miktar, 'unitCode'),
    itemName: kalem === undefined ? undefined : text(kalem, 'Name'),
    identifications:
      kalem === undefined
        ? []
        : children(kalem, CAC, 'AdditionalItemIdentification').flatMap((k) => {
            const id = child(k, CBC, 'ID')
            return id?.kind === 'leaf'
              ? [compact({ schemeId: attribute(id, 'schemeID'), value: id.text })]
              : []
          }),
  })
}

/**
 * Bir UBL-TR e-İrsaliyesini tipli nesneye çevirir.
 *
 * {@link parseInvoice} ile aynı ilkeler geçerlidir: okuma hoşgörülüdür,
 * hiçbir değerin türü tahmin edilmez, eksik alan `undefined` kalır.
 *
 * @param root - İrsaliyenin kök öğesi
 * @returns Okunmuş irsaliye
 *
 * @example
 * ```ts
 * const { root } = parseDocument(gelenXml)
 * const irsaliye = parseDespatchAdvice(root)
 * irsaliye.shipment?.drivers[0]?.familyName // 'Sürücü'
 * irsaliye.lines.length                     // 1
 * ```
 */
export const parseDespatchAdvice = (root: XmlElement): ParsedDespatchAdvice => {
  const sevkiyat = child(root, CAC, 'Shipment')
  const asama = sevkiyat === undefined ? undefined : child(sevkiyat, CAC, 'ShipmentStage')
  const arac = asama === undefined ? undefined : child(asama, CAC, 'TransportMeans')
  const karayolu = arac === undefined ? undefined : child(arac, CAC, 'RoadTransport')
  const teslim = sevkiyat === undefined ? undefined : child(sevkiyat, CAC, 'Delivery')
  const sevk = teslim === undefined ? undefined : child(teslim, CAC, 'Despatch')
  const tasiyici = teslim === undefined ? undefined : child(teslim, CAC, 'CarrierParty')

  return compact({
    profile: text(root, 'ProfileID'),
    type: text(root, 'DespatchAdviceTypeCode'),
    id: text(root, 'ID'),
    uuid: text(root, 'UUID'),
    issueDate: text(root, 'IssueDate'),
    issueTime: text(root, 'IssueTime'),
    notes: children(root, CBC, 'Note').flatMap((n) => (n.kind === 'leaf' ? [n.text] : [])),
    supplier: parseWrappedParty(child(root, CAC, 'DespatchSupplierParty')),
    customer: parseWrappedParty(child(root, CAC, 'DeliveryCustomerParty')),
    shipment:
      sevkiyat === undefined
        ? undefined
        : compact({
            id: text(sevkiyat, 'ID'),
            actualDespatchDate: sevk === undefined ? undefined : text(sevk, 'ActualDespatchDate'),
            actualDespatchTime: sevk === undefined ? undefined : text(sevk, 'ActualDespatchTime'),
            carrierParty: tasiyici === undefined ? undefined : parseParty(tasiyici),
            drivers:
              asama === undefined
                ? []
                : children(asama, CAC, 'DriverPerson').map((s) =>
                    compact({
                      firstName: text(s, 'FirstName'),
                      familyName: text(s, 'FamilyName'),
                      nationalityId: text(s, 'NationalityID'),
                    }),
                  ),
            licensePlates:
              karayolu === undefined
                ? []
                : children(karayolu, CBC, 'LicensePlateID').flatMap((p) =>
                    p.kind === 'leaf'
                      ? [compact({ plateNumber: p.text, schemeId: attribute(p, 'schemeID') })]
                      : [],
                  ),
          }),
    lines: children(root, CAC, 'DespatchLine').map(parseLine),
  })
}
