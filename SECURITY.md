# Güvenlik Politikası

Bu kütüphane resmî mali belgeleri üretir, okur ve doğrular. Ürettiği XML
Gelir İdaresi Başkanlığı'na gider; okuduğu XML dışarıdan gelir. Her iki yön
de güvenlik açısından hassastır ve iki farklı tehdit modeline sahiptir.

## Desteklenen sürümler

| Sürüm | Güvenlik düzeltmesi alır  |
| ----- | ------------------------- |
| `0.x` | Evet — en son yama sürümü |

`1.0.0` yayımlandığında bu tablo güncellenecektir. Düzeltmeler yalnızca en
son yayımlanan yama sürümü üzerinden gelir; eski bir yama sürümüne geriye
dönük düzeltme yapılmaz.

## Açık bildirme

**Güvenlik açıkları için herkese açık issue AÇMAYIN.** Belge üreten ya da
ayrıştıran bir kütüphanedeki açığın ayrıntısı, yama yayımlanmadan önce
görünür olursa kütüphaneyi üretimde kullanan mükellefler risk altında kalır.

Bildirim için GitHub'ın özel güvenlik danışma kanalını kullanın:

**[Security → Report a vulnerability](https://github.com/yankikucuk/ubl-tr/security/advisories/new)**

Bu kanal yalnızca siz ve depo sahibi tarafından görülebilir; yama hazır
olana kadar tartışma özel kalır.

Bildiriminizde şunlar varsa değerlendirme çok hızlanır:

- Etkilenen sürüm ve Node.js sürümü
- Açığı tetikleyen **en küçük XML parçası** ya da kod
- Beklenen davranış ile gözlenen davranış
- Etkisi: hangi veri, kimin eline geçiyor — ya da hangi yanlış belge
  geçerli sayılıyor

**Gerçek bir mükellefe ait belge göndermeyin.** Anonimleştirilmiş bir örnek
ya da GİB'in kendi yayımladığı örnek belgeler yeterlidir. VKN, TCKN, ünvan
ve tutar alanlarını değiştirin — açığı tetikleyen genellikle **yapı**dır,
değerler değil.

### Ne bekleyebilirsiniz

Bu tek geliştiricili bir proje; süreler buna göre dürüstçe verilmiştir:

| Aşama                                | Hedef süre |
| ------------------------------------ | ---------- |
| İlk yanıt (bildirimin alındığı)      | 7 gün      |
| Geçerli/geçersiz değerlendirmesi     | 14 gün     |
| Düzeltme veya yol haritası bildirimi | 30 gün     |

Açık doğrulanırsa: yama yayımlanır, bir GitHub Security Advisory yayımlanır
ve — aksini istemezseniz — advisory'de adınız anılır. Geçersiz bulunursa
gerekçesini yazarım; katılmıyorsanız aynı kanaldan itiraz edebilirsiniz.

## Tehdit modeli

Bu kütüphanenin iki yönü var ve ikisinin riski aynı değil.

### Gelen yön — güvenilmeyen XML ayrıştırmak

Bir e-belge XML'i **her zaman dış girdidir**. Ticari partnerinizden,
entegratörden, bir e-posta ekinden gelir. Kimin ürettiğini bilmezsiniz.
Klasik XML saldırılarının tamamı burada geçerlidir:

- **XXE (XML External Entity)** — dış varlık çözümlemesi yerel dosyaları
  okuyabilir veya ağ isteği tetikleyebilir
- **Varlık genişletme / billion laughs** — birkaç yüz baytlık bir belge
  gigabaytlarca bellek tüketebilir
- **Karesel şişme (quadratic blowup)** — varlık genişletme sınırlarını
  aşmadan aynı sonucu doğuran varyant
- **DTD işleme ve dış DTD çekme** — hem SSRF hem DoS yüzeyi
- **Aşırı derin iç içelik** — özyinelemeli ayrıştırmada yığın taşması
- **`schemaLocation` üzerinden SSRF** — belgede belirtilen bir adrese
  istek atmak, saldırganın seçtiği bir adrese istek atmaktır
- **ReDoS** — düzenli ifadeyle yapılan ayrıştırmada üstel geri izleme

Bunlar bu projede **açık sayılır**, "yapılandırma hatası" değil. Kütüphane
varsayılan olarak güvenli davranmak zorundadır: DTD ve dış varlık
çözümlemesi kapalı, genişletme ve derinlik sınırları uygulanır, ağ isteği
hiç yapılmaz. Bu davranışlardan birinin ihlal edildiğini gösterebilirseniz
bu bir güvenlik açığıdır.

### Giden yön — yanlış belge üretmek

Burada tehdit farklı: kütüphane **sessizce yanlış ama geçerli görünen** bir
belge üretirse, hata çalışma zamanında değil vergi dairesinde ortaya çıkar.
Bu yüzden aşağıdakiler de kapsam içidir:

- Tutar, vergi matrahı, KDV veya tevkifat hesabında yanlış sonuç
- Kaçış (escaping) hatası nedeniyle bozuk ya da enjekte edilebilir XML —
  bir ünvan alanındaki `<` karakterinin belge yapısını değiştirmesi
- Doğrulayıcının **geçersiz bir belgeyi geçerli sayması** — koruduğunu
  iddia ettiği kuralı fiilen uygulamaması
- Ad alanı veya profil kimliğinin yanlış yazılması sonucu GİB tarafından
  reddedilecek ama yerelde geçerli görünen belge

### Veri sızıntısı

Hata nesneleri ve doğrulama sonuçları belge içeriği taşıyabilir. Bir hata
mesajının içine ham XML parçası koymak, o parçayı log toplayıcınıza
taşımaktır — ve o parça bir mükellefin ünvanını, VKN'sini ve fatura
tutarını içerir.

```ts
try {
  const belge = parseInvoice(xml)
} catch (error) {
  // Bunu YAPMAYIN: hata nesnesi belge içeriği taşıyabilir
  logger.error(error)

  // Bunu yapın: teşhis için gereken alanlar bunlar
  if (error instanceof UblTrParseError) {
    logger.error({
      code: error.code,
      path: error.path, // XPath — değer değil, konum
      line: error.line,
    })
  }
}
```

Kütüphane hiçbir şey log'lamaz. Ne log'landığı çağıran uygulamanın
sorumluluğundadır.

## Kapsam

### Kapsam içi

- Yukarıdaki tehdit modelinde sayılan her şey
- Bağımlılık zincirindeki açıklar — kütüphanenin **çalışma zamanı
  bağımlılığı yoktur**, bu yüzden bu yüzey yalnızca geliştirme araçlarıdır
- Bu depodaki CI ve yayın altyapısının zayıflıkları

### Kapsam dışı

- **GİB'in kendi sistemlerinin açıkları.** Bu kütüphane belge üretir ve
  okur; portalı ya da web servisini işletmez. Portala ait sorunlar GİB'e
  bildirilmelidir.
- **İmza doğrulama.** Bu kütüphane XAdES imzası üretmez ve doğrulamaz;
  belge yapısıyla ilgilenir. İmza katmanı ayrı bir projedir.
- Belgeyi taşıyan katmanın (HTTP, SOAP, e-posta) güvenliği
- Kütüphaneyi çağıran uygulamanın kendi kimlik bilgilerini sızdırması
- Yalnızca varsayılan dışı, açıkça riskli bir yapılandırmada geçerli olan
  senaryolar — ancak o yapılandırmanın var olması gerektiği tartışılabilir;
  bildirin.

## Kütüphaneyi güvenli kullanmak

- **Gelen belgeyi asla güvenilir saymayın.** Ticari partnerinizden gelen
  bir XML, sizin ürettiğiniz bir XML değildir.
- **Boyut sınırını siz koyun.** Kütüphane ayrıştırma sırasında sınır
  uygular, ama belgeyi diskten ya da ağdan okuyan kod sizin kodunuz;
  gigabaytlık bir dosyayı belleğe almadan önce reddedin.
- **Doğrulama sonucunu yok saymayın.** Doğrulayıcının uyarı döndürmesi,
  belgenin GİB tarafından kabul edileceği anlamına gelmez; hata döndürmesi
  ise kesinlikle reddedileceği anlamına gelir.
- **Ürettiğiniz belgeyi arşivleyin.** Mali belgelerin saklama yükümlülüğü
  kütüphanenin değil sizindir.
- Node.js 20 ve üzeri desteklenir. Ömrünü doldurmuş Node sürümlerinde
  çalıştırmayın.

## Bu depodaki güvenlik önlemleri

- **CodeQL** her push ve PR'da statik analiz yapar
- **Dependabot** güvenlik güncellemelerini ve gruplu bağımlılık
  yükseltmelerini açar
- **Dependency review** her PR'da yeni bağımlılıkların açıklarını denetler
  ve çalışma zamanı bağımlılığı eklenmesini engeller
- **Secret scanning** ve **push protection** etkindir
- CI, desteklenen tüm Node sürümlerinde (20, 22, 24) çalışır

## Teşekkür

Sorumlu bildirimde bulunan herkese teşekkür ederiz. Geçerli bulunan her
bildirim, aksini istemediğiniz sürece yayımlanan advisory'de anılır.
