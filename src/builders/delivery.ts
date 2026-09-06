import { Namespace } from '../constants/index.js'
import { container, leaf, optionalLeaf, type XmlElement } from '../core/index.js'

import { buildParty, buildPostalAddress, type AddressInput, type PartyInput } from './party.js'

const CBC = Namespace.COMMON_BASIC
const CAC = Namespace.COMMON_AGGREGATE

/** Gümrük beyannamesi — `cac:CustomsDeclaration`. */
export interface CustomsDeclarationInput {
  /** Beyanname sıra numarası; varsayılan `'1'`. */
  readonly id?: string
  /** Beyannameyi düzenleyen taraf — `cac:IssuerParty`. */
  readonly issuerParty: PartyInput
}

/** Teslim bilgisi — `cac:Delivery`. Hem satır hem belge düzeyinde kullanılır. */
export interface DeliveryInput {
  /**
   * Fiili teslim tarihi — `cbc:ActualDeliveryDate` (`YYYY-MM-DD`).
   *
   * e-Arşiv internet satışlarında kargo teslim tarihi olarak yazılır.
   */
  readonly actualDeliveryDate?: string
  /** Teslim adresi — `cac:DeliveryAddress`. */
  readonly address?: AddressInput
  /**
   * Taşıyıcı — `cac:CarrierParty`.
   *
   * e-Arşiv internet satışlarında kargo firması burada bildirilir.
   */
  readonly carrierParty?: PartyInput
  /**
   * Teslim şekli kodu — `cac:DeliveryTerms/cbc:ID` (`schemeID="INCOTERMS"`).
   *
   * İhracat faturalarında beklenir: `FOB`, `CIF`, `EXW`, `DAP` gibi.
   */
  readonly deliveryTermCode?: string
  /**
   * GTİP numarası — `cac:GoodsItem/cbc:RequiredCustomsID`.
   *
   * Gümrük Tarife İstatistik Pozisyonu; ihracat ve ihraç kayıtlı
   * faturalarda malın gümrük sınıflandırmasını verir.
   */
  readonly customsTariffNumber?: string
  /** Sevkiyat sıra numarası — `cac:Shipment/cbc:ID`; varsayılan `'1'`. */
  readonly shipmentId?: string
  /** Gümrük beyannamesi ve düzenleyeni. */
  readonly customsDeclaration?: CustomsDeclarationInput
}

/**
 * Bir satırın teslim bilgisini `cac:Delivery` öğesine çevirir.
 *
 * Öğe sırası UBL `cac:DeliveryType` sequence tanımına uyar:
 * fiili teslim tarihi, adres, taşıyıcı, teslim şartları, sonra sevkiyat.
 * Sevkiyatın içinde önce
 * `cac:GoodsItem` (GTİP), sonra `cac:TransportHandlingUnit` (gümrük
 * beyannamesi) gelir.
 *
 * @param delivery - Teslim girdisi
 * @returns `cac:Delivery` öğesi
 *
 * @example İhracat teslimi
 * ```ts
 * buildDelivery({
 *   address: { street: 'Ambarlı Limanı', district: 'Avcılar', city: 'İstanbul' },
 *   deliveryTermCode: 'FOB',
 *   customsTariffNumber: '620342000010',
 * })
 * ```
 *
 * @example Gümrük beyannameli ihraç kayıtlı teslim
 * ```ts
 * buildDelivery({
 *   customsTariffNumber: '620342000010',
 *   customsDeclaration: {
 *     issuerParty: {
 *       taxNumber: '12345678901',
 *       identificationSchemeId: 'ALICIDIBSATIRKOD',
 *       name: 'İhracat Aracı Kurumu A.Ş.',
 *       address: { district: 'Kadıköy', city: 'İstanbul' },
 *     },
 *   },
 * })
 * ```
 */
export const buildDelivery = (delivery: DeliveryInput): XmlElement =>
  container(CAC, 'Delivery', [
    optionalLeaf(CBC, 'ActualDeliveryDate', delivery.actualDeliveryDate),
    delivery.address === undefined
      ? undefined
      : buildPostalAddress(delivery.address, 'DeliveryAddress'),
    delivery.carrierParty === undefined
      ? undefined
      : buildParty(delivery.carrierParty, 'CarrierParty'),
    delivery.deliveryTermCode === undefined
      ? undefined
      : container(CAC, 'DeliveryTerms', [
          leaf(CBC, 'ID', delivery.deliveryTermCode, [{ name: 'schemeID', value: 'INCOTERMS' }]),
        ]),
    delivery.customsTariffNumber === undefined && delivery.customsDeclaration === undefined
      ? undefined
      : container(CAC, 'Shipment', [
          leaf(CBC, 'ID', delivery.shipmentId ?? '1'),
          delivery.customsTariffNumber === undefined
            ? undefined
            : container(CAC, 'GoodsItem', [
                leaf(CBC, 'RequiredCustomsID', delivery.customsTariffNumber),
              ]),
          delivery.customsDeclaration === undefined
            ? undefined
            : container(CAC, 'TransportHandlingUnit', [
                container(CAC, 'CustomsDeclaration', [
                  leaf(CBC, 'ID', delivery.customsDeclaration.id ?? '1'),
                  // `cac:IssuerParty` bir PartyType'tır: içeriği doğrudan
                  // taraf alanlarıdır, ayrıca `cac:Party` ile sarmalanmaz.
                  buildParty(delivery.customsDeclaration.issuerParty, 'IssuerParty'),
                ]),
              ]),
        ]),
  ])
