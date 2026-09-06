import { Namespace } from '../constants/index.js'
import {
  attribute,
  child,
  children,
  decimal,
  type Decimal,
  text,
  type XmlElement,
} from '../core/index.js'

import type { ParsedParty } from './types.js'

const CBC = Namespace.COMMON_BASIC
const CAC = Namespace.COMMON_AGGREGATE

/**
 * Bir metni ondalığa çevirir; çevrilemezse `undefined` döndürür.
 *
 * Ayrıştırma bilinçli olarak **hoşgörülüdür**: bozuk bir sayı yüzünden
 * belgenin tamamının okunamaz hâle gelmesi, o alanı boş bırakmaktan daha
 * kötüdür. Bozukluğu bildirmek doğrulayıcının işidir.
 *
 * @param value - Ondalık metin
 * @returns Ondalık değer; okunamazsa `undefined`
 *
 * @example
 * ```ts
 * readDecimal('1200.00') // 1200.00
 * readDecimal('abc')     // undefined
 * ```
 */
export const readDecimal = (value: string | undefined): Decimal | undefined => {
  if (value === undefined) return undefined
  try {
    return decimal(value)
  } catch {
    return undefined
  }
}

/** Yalnızca tanımlı anahtarları taşıyan nesne kurar. */
const compact = <T extends Record<string, unknown>>(obj: T): T =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T

/**
 * Bir `PartyType` öğesini okunabilir taraf nesnesine çevirir.
 *
 * `cac:Party`, `cac:IssuerParty`, `cac:CarrierParty` ve benzeri rollerin
 * hepsi aynı içeriğe sahiptir; bu işlev hepsinde çalışır.
 *
 * @param party - Taraf öğesi
 * @returns Okunmuş taraf
 *
 * @example
 * ```ts
 * const taraf = parseParty(child(invoice, CAC, 'AccountingSupplierParty')!)
 * taraf.taxNumber // '1234567890'
 * ```
 */
export const parseParty = (party: XmlElement): ParsedParty => {
  const kimlikler = children(party, CAC, 'PartyIdentification').flatMap((k) => {
    const id = child(k, CBC, 'ID')
    return id?.kind === 'leaf'
      ? [compact({ schemeId: attribute(id, 'schemeID'), value: id.text })]
      : []
  })
  const [birincil, ...digerleri] = kimlikler

  const partyName = child(party, CAC, 'PartyName')
  const legalEntity = child(party, CAC, 'PartyLegalEntity')
  const taxScheme = child(party, CAC, 'PartyTaxScheme')
  const adres = child(party, CAC, 'PostalAddress')
  const ulke = adres === undefined ? undefined : child(adres, CAC, 'Country')
  const iletisim = child(party, CAC, 'Contact')
  const kisi = child(party, CAC, 'Person')
  const kimlikBelgesi =
    kisi === undefined ? undefined : child(kisi, CAC, 'IdentityDocumentReference')

  return compact({
    taxNumber: birincil?.value,
    taxNumberScheme: birincil?.schemeId,
    identifications: digerleri,
    name: partyName === undefined ? undefined : text(partyName, 'Name'),
    legalRegistrationName:
      legalEntity === undefined ? undefined : text(legalEntity, 'RegistrationName'),
    taxOffice: (() => {
      if (taxScheme === undefined) return undefined
      const sema = child(taxScheme, CAC, 'TaxScheme')
      return sema === undefined ? undefined : text(sema, 'Name')
    })(),
    address:
      adres === undefined
        ? undefined
        : compact({
            street: text(adres, 'StreetName'),
            buildingNumber: text(adres, 'BuildingNumber'),
            district: text(adres, 'CitySubdivisionName'),
            city: text(adres, 'CityName'),
            postalCode: text(adres, 'PostalZone'),
            subDistrict: text(adres, 'District'),
            country: ulke === undefined ? undefined : text(ulke, 'Name'),
          }),
    phone: iletisim === undefined ? undefined : text(iletisim, 'Telephone'),
    fax: iletisim === undefined ? undefined : text(iletisim, 'Telefax'),
    email: iletisim === undefined ? undefined : text(iletisim, 'ElectronicMail'),
    website: text(party, 'WebsiteURI'),
    person:
      kisi === undefined
        ? undefined
        : compact({
            firstName: text(kisi, 'FirstName'),
            familyName: text(kisi, 'FamilyName'),
            nationalityId: text(kisi, 'NationalityID'),
            identityDocumentId: kimlikBelgesi === undefined ? undefined : text(kimlikBelgesi, 'ID'),
          }),
  })
}

/**
 * Bir sarmalayıcının (`cac:AccountingSupplierParty` gibi) içindeki tarafı okur.
 *
 * @param wrapper - Sarmalayıcı öğe; `undefined` verilirse `undefined` döner
 * @returns Okunmuş taraf
 *
 * @example
 * ```ts
 * parseWrappedParty(child(invoice, CAC, 'AccountingCustomerParty'))
 * ```
 */
export const parseWrappedParty = (wrapper: XmlElement | undefined): ParsedParty | undefined => {
  if (wrapper === undefined) return undefined
  const party = child(wrapper, CAC, 'Party')
  return party === undefined ? undefined : parseParty(party)
}

export { compact }
