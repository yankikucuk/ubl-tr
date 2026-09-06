/** Bir KDV istisna / muafiyet kodunun tanımı. */
export interface ExemptionDefinition {
  /** GİB muafiyet sebebi kodu — `cbc:TaxExemptionReasonCode`. */
  readonly code: string
  /** Muafiyetin mevzuattaki tam adı — `cbc:TaxExemptionReason`. */
  readonly name: string
  /** Muafiyetin ait olduğu vergi türü. */
  readonly taxType: 'KDV' | 'SGK' | 'OTV'
  /**
   * Bu kodun kullanılabileceği fatura tipi.
   *
   * Kod ile fatura tipi uyuşmazlığı GİB tarafından reddedilir: istisna kodu
   * `ISTISNA`, ihraç kayıtlı kodu `IHRACKAYITLI` tipinde kullanılır.
   */
  readonly documentType: 'ISTISNA' | 'SATIS' | 'IHRACKAYITLI' | 'OZELMATRAH' | 'SGK'
}

/**
 * KDV istisna ve muafiyet kodları.
 *
 * Bir istisna faturasında `cbc:TaxExemptionReasonCode` **zorunludur** ve
 * yanına kodun mevzuattaki tam adı `cbc:TaxExemptionReason` olarak yazılır.
 * Yalnızca kodu yazıp açıklamayı atlamak yaygın bir eksiktir; açıklama
 * belgenin insan tarafından okunan görüntüsünde de yer alır.
 */
export const EXEMPTION_DEFINITIONS: readonly ExemptionDefinition[] = [
  {
    code: '201',
    name: '17/1 Kültür ve Eğitim Amacı Taşıyan İşlemler',
    taxType: 'KDV',
    documentType: 'ISTISNA',
  },
  {
    code: '202',
    name: '17/2-a Sağlık, Çevre ve Sosyal Yardım Amaçlı İşlemler',
    taxType: 'KDV',
    documentType: 'ISTISNA',
  },
  {
    code: '204',
    name: '17/2-c Yabancı Diplomatik Organ ve Hayır Kurumlarının Bağışlarla İlgili Mal ve Hizmet Alışları',
    taxType: 'KDV',
    documentType: 'ISTISNA',
  },
  {
    code: '205',
    name: '17/2-d Taşınmaz Kültür Varlıklarına İlişkin Teslimler ve Mimarlık Hizmetleri',
    taxType: 'KDV',
    documentType: 'ISTISNA',
  },
  {
    code: '206',
    name: '17/2-e Mesleki Kuruluşların İşlemleri',
    taxType: 'KDV',
    documentType: 'ISTISNA',
  },
  {
    code: '207',
    name: '17/3 Askeri Fabrika, Tersane ve Atölyelerin İşlemleri',
    taxType: 'KDV',
    documentType: 'ISTISNA',
  },
  {
    code: '208',
    name: '17/4-c Birleşme, Devir, Dönüşüm ve Bölünme İşlemleri',
    taxType: 'KDV',
    documentType: 'ISTISNA',
  },
  {
    code: '209',
    name: '17/4-e Banka ve Sigorta Muameleleri Vergisi Kapsamına Giren İşlemler',
    taxType: 'KDV',
    documentType: 'ISTISNA',
  },
  {
    code: '211',
    name: '17/4-h Zirai Amaçlı Su Teslimleri ile Köy Tüzel Kişiliklerince Yapılan İçme Suyu Teslimleri',
    taxType: 'KDV',
    documentType: 'ISTISNA',
  },
  {
    code: '212',
    name: '17/4-ı Serbest Bölgelerde Verilen Hizmetler',
    taxType: 'KDV',
    documentType: 'ISTISNA',
  },
  {
    code: '213',
    name: '17/4-j Boru Hattı ile Yapılan Petrol ve Gaz Taşımacılığı',
    taxType: 'KDV',
    documentType: 'ISTISNA',
  },
  {
    code: '214',
    name: '17/4-k Organize Sanayi Bölgelerindeki Arsa ve İşyeri Teslimleri ile Konut Yapı Kooperatiflerinin Üyelerine Konut Teslimleri',
    taxType: 'KDV',
    documentType: 'ISTISNA',
  },
  {
    code: '215',
    name: '17/4-l Varlık Yönetim Şirketlerinin İşlemleri',
    taxType: 'KDV',
    documentType: 'ISTISNA',
  },
  {
    code: '216',
    name: '17/4-m Tasarruf Mevduatı Sigorta Fonunun İşlemleri',
    taxType: 'KDV',
    documentType: 'ISTISNA',
  },
  {
    code: '217',
    name: '17/4-n Basın-Yayın ve Enformasyon Genel Müdürlüğüne Verilen Haber Hizmetleri',
    taxType: 'KDV',
    documentType: 'ISTISNA',
  },
  {
    code: '218',
    name: 'KDV 17/4-o — Gümrük Antrepoları, Geçici Depolama Yerleri ile Gümrüklü Sahalarda Vergisiz Satış Yapılan İşyeri/Depo/Ardiye Kiralanması',
    taxType: 'KDV',
    documentType: 'ISTISNA',
  },
  {
    code: '219',
    name: '17/4-p Hazine ve Arsa Ofisi Genel Müdürlüğünün İşlemleri',
    taxType: 'KDV',
    documentType: 'ISTISNA',
  },
  {
    code: '220',
    name: '17/4-r İki Tam Yıl Süreyle Sahip Olunan Taşınmaz ve İştirak Hisseleri Satışları',
    taxType: 'KDV',
    documentType: 'ISTISNA',
  },
  {
    code: '221',
    name: 'Geçici 15 Konut Yapı Kooperatifleri, Belediyeler ve Sosyal Güvenlik Kuruluşlarına Verilen İnşaat Taahhüt Hizmeti',
    taxType: 'KDV',
    documentType: 'ISTISNA',
  },
  {
    code: '223',
    name: 'Geçici 20/1 Teknoloji Geliştirme Bölgelerinde Yapılan İşlemler',
    taxType: 'KDV',
    documentType: 'ISTISNA',
  },
  {
    code: '225',
    name: 'Geçici 23 Milli Eğitim Bakanlığına Yapılan Bilgisayar Bağışları ile İlgili Teslimler',
    taxType: 'KDV',
    documentType: 'ISTISNA',
  },
  {
    code: '226',
    name: '17/2-b Özel Okullar, Üniversite ve Yüksekokullar Tarafından Verilen Bedelsiz Eğitim ve Öğretim Hizmetleri',
    taxType: 'KDV',
    documentType: 'ISTISNA',
  },
  {
    code: '227',
    name: '17/2-b Kanunların Gösterdiği Gerek Üzerine Bedelsiz Olarak Yapılan Teslim ve Hizmetler',
    taxType: 'KDV',
    documentType: 'ISTISNA',
  },
  {
    code: '228',
    name: '17/2-b Kanunun (17/1) Maddesinde Sayılan Kurum ve Kuruluşlara Bedelsiz Olarak Yapılan Teslimler',
    taxType: 'KDV',
    documentType: 'ISTISNA',
  },
  {
    code: '229',
    name: 'Gıda Bankacılığı Faaliyetinde Bulunan Darülacezeye, Dernek ve Vakıflara Bağışlanan, Gıda, Temizlik, Giyecek ve Yakacak Maddeleri',
    taxType: 'KDV',
    documentType: 'ISTISNA',
  },
  {
    code: '230',
    name: '17/4-g Külçe Altın, Külçe Gümüş ve Kıymetli Taşların Teslimi',
    taxType: 'KDV',
    documentType: 'ISTISNA',
  },
  {
    code: '231',
    name: '17/4-g Metal, Plastik, Lastik, Kauçuk, Kağıt, Cam Hurda ve Atıkların Teslimi',
    taxType: 'KDV',
    documentType: 'ISTISNA',
  },
  {
    code: '232',
    name: '17/4-g Döviz, Para, Damga Pulu, Değerli Kağıtlar, Hisse Senedi ve Tahvil Teslimleri',
    taxType: 'KDV',
    documentType: 'ISTISNA',
  },
  {
    code: '233',
    name: '2942 Sayılı Kamulaştırma Kanunu Kapsamında Taşınmazların Kamulaştırmayı Yapan Devlet ve Kamu Tüzel Kişilerine Devri',
    taxType: 'KDV',
    documentType: 'ISTISNA',
  },
  {
    code: '234',
    name: '17/4-ş Konut Finansmanı Amacıyla Teminat Gösterilen ve İpotek Konulan Konutların Teslimi',
    taxType: 'KDV',
    documentType: 'ISTISNA',
  },
  {
    code: '235',
    name: '16/1-c Transit ve Gümrük Antrepo Rejimleri ile Geçici Depolama ve Serbest Bölge Hükümlerinin Uygulandığı Malların Teslimi',
    taxType: 'KDV',
    documentType: 'ISTISNA',
  },
  {
    code: '236',
    name: '19/2 Uluslararası Anlaşmalar Kapsamındaki İstisnalar (İade Hakkı Tanınmayan)',
    taxType: 'KDV',
    documentType: 'ISTISNA',
  },
  {
    code: '237',
    name: '17/4-t 5300 Sayılı Kanuna Göre Düzenlenen Ürün Senetlerinin İhtisas/Ticaret Borsaları Aracılığıyla İlk Teslimi',
    taxType: 'KDV',
    documentType: 'ISTISNA',
  },
  {
    code: '238',
    name: '17/4-u Varlık ve Hakların TMSF ye Teslimi ile Bunların TMSF Tarafından Teslimi, Müzayede Suretiyle Satışı',
    taxType: 'KDV',
    documentType: 'ISTISNA',
  },
  {
    code: '239',
    name: '17/4-y Taşınmazların Sosyal Güvenlik Kurumuna Devir ve Teslimleri',
    taxType: 'KDV',
    documentType: 'ISTISNA',
  },
  {
    code: '240',
    name: '17/4-z Gıda, Tarım ve Hayvancılık Bakanlığı Tarafından Tescil Edilen Gübreler ve Gübre Üreticilerine Aktarılan Ham Madde Teslimleri',
    taxType: 'KDV',
    documentType: 'ISTISNA',
  },
  {
    code: '241',
    name: 'TürkAkım Gaz Boru Hattı Projesine İlişkin Anlaşmanın 9/b Maddesinde Yer Alan Hizmetler',
    taxType: 'KDV',
    documentType: 'ISTISNA',
  },
  {
    code: '242',
    name: 'KDV 17/4-ö — Gümrük Antrepoları, Geçici Depolama Yerleri, Gümrüklü Sahalarda verilen ardiye, depolama ve terminal hizmetleri',
    taxType: 'KDV',
    documentType: 'ISTISNA',
  },
  { code: '250', name: 'Diğerleri', taxType: 'KDV', documentType: 'ISTISNA' },
  { code: '301', name: '11/1-a Mal İhracatı', taxType: 'KDV', documentType: 'ISTISNA' },
  { code: '302', name: '11/1-a Hizmet İhracatı', taxType: 'KDV', documentType: 'ISTISNA' },
  { code: '303', name: '11/1-a Roaming Hizmetleri', taxType: 'KDV', documentType: 'ISTISNA' },
  {
    code: '304',
    name: '13/a Deniz, Hava ve Demiryolu Taşıma Araçlarının Teslimi ile İnşa, Tadil, Bakım ve Onarımları',
    taxType: 'KDV',
    documentType: 'ISTISNA',
  },
  {
    code: '305',
    name: '13/b Deniz ve Hava Taşıma Araçları İçin Liman ve Hava Meydanlarında Yapılan Hizmetler',
    taxType: 'KDV',
    documentType: 'ISTISNA',
  },
  {
    code: '306',
    name: '13/c Altın, Gümüş, Platin ile İlgili Arama, İşletme ve Zenginleştirme Faaliyetlerine İlişkin Teslim ve Hizmetler',
    taxType: 'KDV',
    documentType: 'ISTISNA',
  },
  {
    code: '307',
    name: '13/d Yatırım Teşvik Belgesi Kapsamındaki Makine ve Teçhizat Teslimleri',
    taxType: 'KDV',
    documentType: 'ISTISNA',
  },
  {
    code: '308',
    name: '13/e Limanlara Bağlantı Sağlayan Demiryolu Hatları, Limanlar ve Hava Meydanlarının İnşası, Yenilenmesi ve Genişletilmesine İlişkin Teslim ve Hizmetler',
    taxType: 'KDV',
    documentType: 'ISTISNA',
  },
  { code: '309', name: '14/1 Taşımacılık İstisnası', taxType: 'KDV', documentType: 'ISTISNA' },
  { code: '310', name: '15/1-a Diplomatik İstisna', taxType: 'KDV', documentType: 'ISTISNA' },
  {
    code: '311',
    name: '15/1-b Uluslararası Kuruluşlara İstisna',
    taxType: 'KDV',
    documentType: 'ISTISNA',
  },
  {
    code: '312',
    name: 'Geçici 26 BM, NATO, OECD Temsilcilikleri İstisnaları',
    taxType: 'KDV',
    documentType: 'ISTISNA',
  },
  {
    code: '313',
    name: '11/1-b Yolcu Beraberi (Bavul Ticareti)',
    taxType: 'KDV',
    documentType: 'ISTISNA',
  },
  {
    code: '314',
    name: '11/1-c Mal ve Hizmetlerin Serbest Bölgedeki Müşterilere Teslimi',
    taxType: 'KDV',
    documentType: 'ISTISNA',
  },
  {
    code: '315',
    name: '13/f Ulusal Güvenlik Amaçlı Teslim ve Hizmetler',
    taxType: 'KDV',
    documentType: 'ISTISNA',
  },
  {
    code: '316',
    name: '17/4-o Gümrük Antrepoları, Geçici Depolama Yerleri, Gümrüklü Sahalar ve Vergisiz Satış Yapılan Mağazalar',
    taxType: 'KDV',
    documentType: 'ISTISNA',
  },
  {
    code: '317',
    name: 'Geçici 20/3 Teknoloji Geliştirme Bölgelerinde Yapılan Teslimler (KDV Kanunu Geçici 20/3)',
    taxType: 'KDV',
    documentType: 'ISTISNA',
  },
  {
    code: '318',
    name: '19/2 Uluslararası Anlaşmalar Kapsamındaki İstisnalar (İade Hakkı Tanınan)',
    taxType: 'KDV',
    documentType: 'ISTISNA',
  },
  {
    code: '319',
    name: '17/4-r Bankalara, Finansal Kiralama ve Finansman Şirketlerine Borçlu Olanların Taşınmaz ve İştirak Hisselerinin Devir Teslimleri',
    taxType: 'KDV',
    documentType: 'ISTISNA',
  },
  {
    code: '320',
    name: 'Geçici 29 3996 Sayılı Kanuna Göre Yap-İşlet-Devret veya 3359 ve 6428 Sayılı Kanunlara Göre Kiralama Karşılığı Yaptırılan Projelerde KDV İstisnası',
    taxType: 'KDV',
    documentType: 'ISTISNA',
  },
  {
    code: '321',
    name: 'Geçici 26 BM, NATO, OECD Temsilcilikleri ve Bağlı Kuruluşları İstisnaları',
    taxType: 'KDV',
    documentType: 'ISTISNA',
  },
  {
    code: '322',
    name: "11/1-a Türkiye'de İkamet Etmeyenlere Özel Fatura ile Yapılan Teslimler (Bavul Ticareti)",
    taxType: 'KDV',
    documentType: 'ISTISNA',
  },
  {
    code: '323',
    name: '13/ğ 5300 Sayılı Kanuna Göre Düzenlenen Ürün Senetlerinin İhtisas/Ticaret Borsaları Aracılığıyla İlk Teslimi',
    taxType: 'KDV',
    documentType: 'ISTISNA',
  },
  {
    code: '324',
    name: '13/h Türkiye Kızılay Derneğine Yapılan Teslim ve Hizmetler',
    taxType: 'KDV',
    documentType: 'ISTISNA',
  },
  { code: '325', name: '13/ı Yem Teslimleri', taxType: 'KDV', documentType: 'ISTISNA' },
  {
    code: '326',
    name: '13/ı Gıda, Tarım ve Hayvancılık Bakanlığı Tarafından Tescil Edilmiş Gübrelerin Teslimi',
    taxType: 'KDV',
    documentType: 'ISTISNA',
  },
  {
    code: '327',
    name: '13/ı Gıda, Tarım ve Hayvancılık Bakanlığı Tarafından Tescil Edilmiş Gübrelerin İçeriğinde Bulunan Hammaddelerin Gübre Üreticilerine Teslimi',
    taxType: 'KDV',
    documentType: 'ISTISNA',
  },
  {
    code: '328',
    name: '13/i Konut veya İşyeri Teslimleri',
    taxType: 'KDV',
    documentType: 'ISTISNA',
  },
  {
    code: '329',
    name: "FATİH Projesi Kapsamında MEB'e Yapılacak Mal Teslimi ve Hizmet İfası",
    taxType: 'KDV',
    documentType: 'ISTISNA',
  },
  {
    code: '330',
    name: 'KDV 13/j — Organize Sanayi Bölgeleri ile Küçük Sanayi Sitelerinin İnşasına İlişkin Teslim ve Hizmetler',
    taxType: 'KDV',
    documentType: 'ISTISNA',
  },
  {
    code: '331',
    name: 'KDV 13/m — Ar-Ge, Yenilik ve Tasarım Faaliyetlerinde Kullanılmak Üzere Yapılan Yeni Makina ve Teçhizat Teslimlerinde İstisna',
    taxType: 'KDV',
    documentType: 'ISTISNA',
  },
  {
    code: '332',
    name: 'KDV Geçici 39 — İmalat Sanayiinde Kullanılmak Üzere Yapılan Yeni Makina ve Teçhizat Teslimlerinde İstisna',
    taxType: 'KDV',
    documentType: 'ISTISNA',
  },
  {
    code: '333',
    name: 'KDV 13/k — Genel ve Özel Bütçeli Kamu İdareleri, İl Özel İdareleri, Belediyeler ve Köylere Bağışlanan Tesislerin İnşasına İlişkin İstisna',
    taxType: 'KDV',
    documentType: 'ISTISNA',
  },
  {
    code: '334',
    name: 'KDV 13/l — Yabancılara Verilen Sağlık Hizmetlerinde İstisna',
    taxType: 'KDV',
    documentType: 'ISTISNA',
  },
  {
    code: '335',
    name: 'KDV 13/n — Basılı Kitap ve Süreli Yayınların Teslimleri',
    taxType: 'KDV',
    documentType: 'ISTISNA',
  },
  {
    code: '336',
    name: 'Geçici 46 — UEFA Müsabakaları Kapsamında Yapılacak Teslim ve Hizmetler',
    taxType: 'KDV',
    documentType: 'ISTISNA',
  },
  {
    code: '337',
    name: 'Türk Akım Gaz Boru Hattı Projesine İlişkin Anlaşmanın 9/h Maddesi Kapsamındaki Gaz Taşıma Hizmetleri',
    taxType: 'KDV',
    documentType: 'ISTISNA',
  },
  { code: '338', name: 'İmalatçıların Mal İhracatları', taxType: 'KDV', documentType: 'ISTISNA' },
  {
    code: '339',
    name: 'İmalat Sanayii ile Turizme Yönelik Yatırım Teşvik Belgesi Kapsamındaki İnşaat İşlerine İlişkin Teslim ve Hizmetler',
    taxType: 'KDV',
    documentType: 'ISTISNA',
  },
  {
    code: '340',
    name: 'Elektrik Motorlu Taşıt Araçlarının Geliştirilmesine Yönelik Mühendislik Hizmetleri',
    taxType: 'KDV',
    documentType: 'ISTISNA',
  },
  {
    code: '341',
    name: 'Afetzedelere Bağışlanacak Konutların İnşasına İlişkin İstisna',
    taxType: 'KDV',
    documentType: 'ISTISNA',
  },
  {
    code: '342',
    name: 'Genel Bütçeli Kamu İdarelerine Bağışlanacak Taşınmazların İnşasına İlişkin İstisna',
    taxType: 'KDV',
    documentType: 'ISTISNA',
  },
  {
    code: '343',
    name: 'Genel Bütçeli Kamu İdarelerine Bağışlanacak Konutların Yabancı Devlet Kurum ve Kuruluşlarına Teslimine İlişkin İstisna',
    taxType: 'KDV',
    documentType: 'ISTISNA',
  },
  {
    code: '344',
    name: '13/o Milli Savunma ve İç Güvenlik İhtiyaçlarında Kullanılmak Üzere Taşıt Teslimi',
    taxType: 'KDV',
    documentType: 'ISTISNA',
  },
  { code: '350', name: 'KDV İstisna Diğer', taxType: 'KDV', documentType: 'ISTISNA' },
  { code: '351', name: 'KDV İstisna Olmayan Diğer', taxType: 'KDV', documentType: 'SATIS' },
  {
    code: '555',
    name: 'KDV Oran Kontrolüne Tabi Olmayan Satışlar',
    taxType: 'KDV',
    documentType: 'SATIS',
  },
  { code: '151', name: 'ÖTV — İstisna Olmayan Diğer', taxType: 'OTV', documentType: 'SATIS' },
  {
    code: '701',
    name: '3065 s. KDV Kanununun 11/1-c md. Kapsamındaki İhraç Kayıtlı Satış',
    taxType: 'KDV',
    documentType: 'IHRACKAYITLI',
  },
  {
    code: '702',
    name: 'DİİB ve Geçici Kabul Rejimi Kapsamındaki Satışlar',
    taxType: 'KDV',
    documentType: 'IHRACKAYITLI',
  },
  {
    code: '703',
    name: '4760 s. ÖTV Kanununun 8/2 Md. Kapsamındaki İhraç Kayıtlı Satış',
    taxType: 'KDV',
    documentType: 'IHRACKAYITLI',
  },
  {
    code: '704',
    name: '3065 sayılı KDV Kanununun 11/1-c maddesi ve 4760 sayılı ÖTV Kanununun 8/2 md. Kapsamındaki İhraç Kayıtlı Satış',
    taxType: 'KDV',
    documentType: 'IHRACKAYITLI',
  },
  {
    code: '801',
    name: 'Milli Piyango, Spor Toto vb. Devletçe Organize Edilen Organizasyonlar',
    taxType: 'KDV',
    documentType: 'OZELMATRAH',
  },
  {
    code: '802',
    name: 'At Yarışları ve Diğer Müşterek Bahis ve Talih Oyunları',
    taxType: 'KDV',
    documentType: 'OZELMATRAH',
  },
  {
    code: '803',
    name: 'Profesyonel Sanatçıların Yer Aldığı Gösteriler, Konserler, Sportif Faaliyetler',
    taxType: 'KDV',
    documentType: 'OZELMATRAH',
  },
  {
    code: '804',
    name: 'Gümrük Depolarında ve Müzayede Salonlarında Yapılan Satışlar',
    taxType: 'KDV',
    documentType: 'OZELMATRAH',
  },
  {
    code: '805',
    name: 'Altından Mamül veya Altın İçeren Ziynet Eşyaları ile Sikke Altınların Teslim ve İthali',
    taxType: 'KDV',
    documentType: 'OZELMATRAH',
  },
  {
    code: '806',
    name: 'Tütün Mamülleri ve Bazı Alkollü İçkiler',
    taxType: 'KDV',
    documentType: 'OZELMATRAH',
  },
  {
    code: '807',
    name: 'Gazete, Dergi vb. Periyodik Yayınlar',
    taxType: 'KDV',
    documentType: 'OZELMATRAH',
  },
  {
    code: '808',
    name: 'Külçe Gümüş ve Gümüşten Mamül Eşya Teslimleri',
    taxType: 'KDV',
    documentType: 'OZELMATRAH',
  },
  {
    code: '809',
    name: 'Belediyeler Tarafından Yapılan Şehiriçi Yolcu Taşımacılığında Kullanılan Biletlerin ve Kartların Bayiler Tarafından Satışı',
    taxType: 'KDV',
    documentType: 'OZELMATRAH',
  },
  {
    code: '810',
    name: 'Telefon Kartı ve Jeton Satışları',
    taxType: 'KDV',
    documentType: 'OZELMATRAH',
  },
  {
    code: '811',
    name: 'ŞOF Tarafından Araç Plakaları ile Sürücü Kurslarında Kullanılan Bir Kısım Evrakın Basımı',
    taxType: 'KDV',
    documentType: 'OZELMATRAH',
  },
  {
    code: '812',
    name: 'KDV Uygulanmadan Alınan 2. El Motorlu Kara Taşıtı veya Taşınmaz Teslimi',
    taxType: 'KDV',
    documentType: 'OZELMATRAH',
  },
]

const EXEMPTION_MAP = new Map(EXEMPTION_DEFINITIONS.map((e) => [e.code, e]))

/**
 * Bir muafiyet kodunun tanımını döndürür.
 *
 * @param code - GİB muafiyet sebebi kodu
 * @returns Tanım; kod listede yoksa `undefined`
 *
 * @example
 * ```ts
 * exemptionDefinition('351')?.name
 * // '11/1-a Mal İhracatı' gibi mevzuattaki tam ad
 * exemptionDefinition('702')?.documentType // 'IHRACKAYITLI'
 * ```
 */
export const exemptionDefinition = (code: string): ExemptionDefinition | undefined =>
  EXEMPTION_MAP.get(code)

/**
 * Bir muafiyet kodunun geçerli olup olmadığını söyler.
 *
 * @param code - Denetlenecek kod
 * @returns Kod listede varsa `true`
 *
 * @example
 * ```ts
 * isValidExemptionCode('351') // true
 * isValidExemptionCode('999') // false
 * ```
 */
export const isValidExemptionCode = (code: string): boolean => EXEMPTION_MAP.has(code)
