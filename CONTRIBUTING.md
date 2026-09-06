# Katkı Rehberi

Katkıya açığız. Bu dosya, bir pull request'in kabul edilmesi için nelerin
gerektiğini önceden söylüyor ki iş boşa gitmesin.

Katılım [Davranış Kuralları](CODE_OF_CONDUCT.md)'na tabidir. Güvenlik
açıkları buraya değil, [SECURITY.md](SECURITY.md)'deki özel kanala gider.

## Başlamadan önce

- **Önce issue açın.** Küçük düzeltmeler dışında, üzerinde çalışmaya
  başlamadan önce yaklaşımı konuşalım. Reddedilen bir PR ikimiz için de
  kayıptır.
- **Mevzuat iddiası kaynak ister.** "UBL-TR şu alanı zorunlu kılıyor"
  diyorsanız hangi kılavuzun kaçıncı sürümünün hangi bölümü olduğunu yazın.
  Bu alanda kulaktan dolma bilgi çok, ve yanlışı vergi dairesinde ortaya
  çıkıyor.

## Ortam

```bash
git clone https://github.com/yankikucuk/ubl-tr.git
cd ubl-tr
npm ci
```

Node.js 20 veya üzeri gerekir. `npm ci` sonrası pre-commit kancası kurulur;
commit ederken prettier ve eslint değişen dosyalarda otomatik çalışır.

## Yapılması gerekenler

Bir PR açmadan önce bunların hepsi yeşil olmalı — CI zaten hepsini
çalıştırıyor, yerelde çalıştırmak yalnızca döngüyü kısaltır:

```bash
npm run typecheck
npm run lint
npm run format:check
npm run knip
npm run test:coverage
npm run build
npm run check:publish
npm run check:types
```

## Mimari kuralları

Katman sınırları [README](README.md#mimari)'de anlatılıyor ve ESLint
tarafından zorlanıyor. Pratikte üç kural:

1. **Çalışma zamanı bağımlılığı eklenmez.** `package.json` içindeki
   `dependencies` boş kalmalı. CI bunu makine olarak kontrol ediyor ve
   ihlalde PR kırmızıya döner.
2. **builders / parsers / validators birbirini çağırmaz.** Ortak ihtiyaç
   `core` ya da `documents` katmanına iner.
3. **UBL adları yalnızca sınırda görünür.** `Invoice`, `cbc:IssueDate`,
   `AdditionalDocumentReference` gibi standart adlar üretim ve ayrıştırma
   katmanlarında kalır; tip modeli ve public API Türkçe/anlamlı adlar
   kullanır.

## Test

Bu projede bir testin geçmesi tek başına bir şey kanıtlamaz. Yeni bir test
eklediyseniz **koruduğu üretim satırını geçici olarak kaldırıp testin
kırmızı olduğunu doğrulayın** ve çıktıyı PR'a yapıştırın. Adını taşıdığı
davranış koddan silinse bile geçen bir test, koruma değil gürültüdür.

Belge testleri için:

- **Altın dosya (golden file) testleri** tercih edilir: girdi nesnesi →
  beklenen XML, bayt bayt. Çıktı deterministik olduğu için bu test biçimi
  hem okunabilir hem katıdır.
- **Fixture'lar anonim olmalı.** Gerçek bir mükellefe ait belge depoya
  girmez. GİB'in yayımladığı örnekler ya da uydurulmuş VKN/ünvan kullanın.
- Ayrıştırıcı testlerinde **kötü niyetli girdiyi de test edin**: varlık
  bombası, derin iç içelik, kaçış gerektiren karakterler.

Kapsam eşikleri `vitest.config.ts` içinde tanımlı ve düşürülmemeli.

## Commit ve PR

- Commit mesajları [Conventional Commits](https://www.conventionalcommits.org/tr/)
  biçimindedir: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`.
- Mesaj gövdesi **neden**i anlatsın; **ne**yi zaten diff söylüyor.
- Bir PR bir işi çözsün. "Bu arada şunu da düzelttim" ayrı PR'a gider.
- PR şablonundaki kontrol listesini gerçekten doldurun.

## Sürümleme

[Semantic Versioning](https://semver.org/lang/tr/). Public API'yi kıran her
değişiklik major'dur — üretilen XML'in yapısını değiştirmek de public API'yi
kırmak sayılır, çünkü altın dosya testleriniz buna bağlıdır.

Değişiklikler `CHANGELOG.md` içindeki "Yayımlanmamış" bölümüne eklenir.
Yayını depo sahibi bir sürüm etiketi push ederek yapar.
