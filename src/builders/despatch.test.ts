import { describe, expect, it } from 'vitest'

import { DespatchType, LicensePlateScheme, Namespace } from '../constants/index.js'
import { parseDocument } from '../core/index.js'

import {
  buildDespatchAdvice,
  buildDespatchAdviceXml,
  type DespatchAdviceInput,
} from './despatch.js'
import type { PartyInput } from './party.js'

const gonderen: PartyInput = {
  taxNumber: '1234567890',
  name: 'Gönderen Lojistik A.Ş.',
  taxOffice: 'Üsküdar',
  address: { street: 'Cadde 1', district: 'Üsküdar', city: 'İstanbul', postalCode: '34664' },
}
const alici: PartyInput = {
  taxNumber: '9876543210',
  name: 'Alıcı Ltd. Şti.',
  address: { district: 'Kadıköy', city: 'İstanbul' },
}

const girdi = (over: Partial<DespatchAdviceInput> = {}): DespatchAdviceInput => ({
  id: 'IRS2026000000001',
  uuid: '1a2b3c4d-0001-4000-8001-000000000001',
  issueDate: '2026-09-06',
  issueTime: '10:00:00',
  supplier: gonderen,
  customer: alici,
  shipment: {
    actualDespatchDate: '2026-09-06',
    actualDespatchTime: '14:00:00',
    deliveryAddress: { street: 'Cadde 2', district: 'Kadıköy', city: 'İstanbul' },
    drivers: [{ firstName: 'Mehmet', familyName: 'Sürücü', nationalityId: '12345678901' }],
    licensePlates: [{ plateNumber: '34ABC123' }],
  },
  lines: [{ quantity: 10, itemName: 'Paketlenmiş Ürün' }],
  ...over,
})

const kokSirasi = (xml: string): string[] => {
  const kok = parseDocument(xml).root
  return kok.kind === 'container' ? kok.children.map((c) => c.name) : []
}

describe('belge yapısı', () => {
  it('kendi kök öğesini ve ad alanını kullanır', () => {
    // e-İrsaliye faturadan bağımsız bir belge tipidir: kök öğesi
    // `DespatchAdvice`, ad alanı `…:DespatchAdvice-2`'dir.
    const { root } = buildDespatchAdvice(girdi())
    expect(root.name).toBe('DespatchAdvice')
    expect(root.namespace).toBe('urn:oasis:names:specification:ubl:schema:xsd:DespatchAdvice-2')
  })

  it('UBL sırasına uyar', () => {
    expect(kokSirasi(buildDespatchAdviceXml(girdi(), { includeUblExtensions: false }))).toEqual([
      'UBLVersionID',
      'CustomizationID',
      'ProfileID',
      'ID',
      'CopyIndicator',
      'UUID',
      'IssueDate',
      'IssueTime',
      'DespatchAdviceTypeCode',
      'LineCountNumeric',
      'DespatchSupplierParty',
      'DeliveryCustomerParty',
      'Shipment',
      'DespatchLine',
    ])
  })

  it('varsayılan profil ve tip', () => {
    const xml = buildDespatchAdviceXml(girdi())
    expect(xml).toContain('<cbc:ProfileID>TEMELIRSALIYE</cbc:ProfileID>')
    expect(xml).toContain('<cbc:DespatchAdviceTypeCode>SEVK</cbc:DespatchAdviceTypeCode>')
  })

  it('matbu irsaliye atfını yazar', () => {
    const xml = buildDespatchAdviceXml(
      girdi({
        type: DespatchType.MATBUDAN,
        additionalDocuments: [
          { id: 'MATBU-2026-042', issueDate: '2026-04-20', documentType: 'MATBU' },
        ],
      }),
    )
    expect(xml).toContain('<cbc:DespatchAdviceTypeCode>MATBUDAN</cbc:DespatchAdviceTypeCode>')
    expect(xml).toContain('<cbc:DocumentType>MATBU</cbc:DocumentType>')
    const sira = kokSirasi(xml)
    expect(sira.indexOf('AdditionalDocumentReference')).toBeLessThan(
      sira.indexOf('DespatchSupplierParty'),
    )
  })

  it('boş satır listesini reddeder', () => {
    expect(() => buildDespatchAdviceXml(girdi({ lines: [] }))).toThrow(RangeError)
  })

  it('çıktı deterministiktir ve varsayılan olarak boşluksuzdur', () => {
    const xml = buildDespatchAdviceXml(girdi())
    expect(xml).toBe(buildDespatchAdviceXml(girdi()))
    expect(xml.slice(xml.indexOf('?>') + 2)).not.toMatch(/>\s+</)
  })
})

describe('sevkiyat', () => {
  it('sürücü ve plakayı yazar', () => {
    const xml = buildDespatchAdviceXml(girdi())
    expect(xml).toContain('<cbc:LicensePlateID schemeID="PLAKA">34ABC123</cbc:LicensePlateID>')
    expect(xml).toContain('<cbc:FirstName>Mehmet</cbc:FirstName>')
    expect(xml).toContain('<cbc:NationalityID>12345678901</cbc:NationalityID>')
  })

  it('birden fazla sürücü ve plakayı sırayla yazar', () => {
    const xml = buildDespatchAdviceXml(
      girdi({
        shipment: {
          ...girdi().shipment,
          drivers: [
            { firstName: 'Mehmet', familyName: 'Birinci', nationalityId: '12345678901' },
            { firstName: 'Ali', familyName: 'İkinci', nationalityId: '23456789012' },
          ],
          licensePlates: [
            { plateNumber: '34ABC123', schemeId: LicensePlateScheme.PLATE },
            { plateNumber: '34DEF456', schemeId: LicensePlateScheme.TRAILER },
          ],
        },
      }),
    )
    expect(xml.match(/<cac:DriverPerson>/g)).toHaveLength(2)
    expect(xml).toContain('<cbc:LicensePlateID schemeID="DORSE">34DEF456</cbc:LicensePlateID>')
  })

  it('taşıyıcıyı sarmalamadan yazar ve adres istemez', () => {
    // `cac:CarrierParty` bir PartyType'tır; ayrıca adres taşımayabilir.
    const xml = buildDespatchAdviceXml(
      girdi({
        shipment: {
          ...girdi().shipment,
          carrierParty: { taxNumber: '5555555555', name: 'Hızlı Taşımacılık A.Ş.' },
        },
      }),
    )
    expect(xml).toContain('<cac:CarrierParty><cac:PartyIdentification>')
    expect(xml).not.toContain('<cac:CarrierParty><cac:Party>')
    expect(xml).not.toContain(
      '<cac:CarrierParty><cac:PartyIdentification><cbc:ID schemeID="VKN">5555555555</cbc:ID></cac:PartyIdentification><cac:PostalAddress>',
    )
  })

  it('taşıma ekipmanını yazar', () => {
    const xml = buildDespatchAdviceXml(
      girdi({
        shipment: {
          ...girdi().shipment,
          transportEquipment: [{ id: '34DEF456', schemeId: 'DORSEPLAKA' }],
        },
      }),
    )
    expect(xml).toContain(
      '<cac:TransportHandlingUnit><cac:TransportEquipment><cbc:ID schemeID="DORSEPLAKA">34DEF456</cbc:ID></cac:TransportEquipment></cac:TransportHandlingUnit>',
    )
  })

  it('sevk tarih ve saatini Despatch bloğuna yazar', () => {
    const xml = buildDespatchAdviceXml(girdi())
    expect(xml).toContain(
      '<cac:Despatch><cbc:ActualDespatchDate>2026-09-06</cbc:ActualDespatchDate><cbc:ActualDespatchTime>14:00:00</cbc:ActualDespatchTime></cac:Despatch>',
    )
  })

  it('teslim adresinde semt alanını ayrı yazar', () => {
    // `cbc:District` ile `cbc:CitySubdivisionName` UBL adres tipinde ayrı
    // öğelerdir; e-İrsaliye teslim adreslerinde ikisi de yazılır.
    const xml = buildDespatchAdviceXml(
      girdi({
        shipment: {
          ...girdi().shipment,
          deliveryAddress: { district: 'Kadıköy', city: 'İstanbul', subDistrict: 'Fenerbahçe' },
        },
      }),
    )
    expect(xml).toContain('<cbc:CitySubdivisionName>Kadıköy</cbc:CitySubdivisionName>')
    expect(xml).toContain('<cbc:District>Fenerbahçe</cbc:District>')
  })

  it('boş GoodsItem kapatılabilir', () => {
    // UBL'de isteğe bağlıdır; GİB paketine karşı doğrulanan üretimlerde
    // içeriği boş olsa da yer aldığı için varsayılan açıktır.
    expect(buildDespatchAdviceXml(girdi())).toContain('<cac:GoodsItem></cac:GoodsItem>')
    expect(buildDespatchAdviceXml(girdi(), { includeEmptyGoodsItem: false })).not.toContain(
      'GoodsItem',
    )
  })
})

describe('satırlar', () => {
  it('satır numarasını sıradan üretir', () => {
    const xml = buildDespatchAdviceXml(
      girdi({
        lines: [
          { quantity: 1, itemName: 'A' },
          { quantity: 2, itemName: 'B' },
        ],
      }),
    )
    expect(xml).toContain('<cac:DespatchLine><cbc:ID>1</cbc:ID>')
    expect(xml).toContain('<cac:DespatchLine><cbc:ID>2</cbc:ID>')
    expect(xml).toContain('<cbc:LineCountNumeric>2</cbc:LineCountNumeric>')
  })

  it('miktar hassasiyetini korur', () => {
    const xml = buildDespatchAdviceXml(
      girdi({ lines: [{ quantity: '0.125', unitCode: 'KGM', itemName: 'Ceviz' }] }),
    )
    expect(xml).toContain('<cbc:DeliveredQuantity unitCode="KGM">0.125</cbc:DeliveredQuantity>')
  })

  it('kalem ek tanımlayıcılarını yazar', () => {
    const xml = buildDespatchAdviceXml(
      girdi({
        lines: [
          {
            quantity: 100,
            itemName: 'İDİS Ürünü',
            additionalIdentifications: [{ schemeId: 'ETIKETNO', value: 'ET0000001' }],
          },
        ],
      }),
    )
    expect(xml).toContain('<cbc:ID schemeID="ETIKETNO">ET0000001</cbc:ID>')
  })

  it('her öğeyi doğru ad alanına yazar', () => {
    const kok = parseDocument(buildDespatchAdviceXml(girdi())).root
    const cocuklar = kok.kind === 'container' ? kok.children : []
    expect(cocuklar.find((c) => c.name === 'UBLVersionID')?.namespace).toBe(Namespace.COMMON_BASIC)
    expect(cocuklar.find((c) => c.name === 'Shipment')?.namespace).toBe(Namespace.COMMON_AGGREGATE)
  })
})
