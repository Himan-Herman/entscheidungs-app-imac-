/** Bölümler 1–7 */
export default [
  {
    id: "ds-1-verantwortlich",
    heading: "1. Veri sorumlusu",
    blocks: [
      {
        type: "p",
        text:
          "Bu gizlilik bildirimi MedScoutX uygulamasının kişisel verileri nasıl işlediğini açıklar.",
      },
      {
        type: "address",
        lineStrong: "GDPR kapsamında veri sorumlusu",
        lines: [
          "Himan Khorshidi",
          "Eisenstraße 64",
          "40227 Düsseldorf, Almanya",
        ],
      },
      {
        type: "dl",
        items: [
          { dt: "E-posta", dd: "himankhorshidy@gmail.com", href: "mailto:contact@medscoutx.com" },
          { dt: "Telefon", dd: "+49 211 15895272", href: "tel:+4921115895272" },
        ],
      },
    ],
  },
  {
    id: "ds-2-worum",
    heading: "2. Konu nedir?",
    blocks: [
      {
        type: "p",
        text:
          "Bu bildirim, MedScoutX’un kişisel verilerinizi şu durumlarda nasıl işlediğini açıklar:",
      },
      {
        type: "ul",
        items: [
          "uygulamayı kurduğunuzda ve hesap oluşturduğunuzda,",
          "tıbbi randevu için bilgileri yapılandırılmış şekilde toplayıp isteğe bağlı olarak PDF olarak hazırladığınızda,",
          "metin sohbeti üzerinden semptom girdiğinizde,",
          "vücut haritasından bölgeler seçtiğinizde,",
          "görüntü yüklediğinizde (ör. cilt fotoğrafları veya tıbbi görüntüler).",
        ],
      },
      {
        type: "p",
        text:
          "MedScoutX tanı veya tedavi aracı değildir ve tıbbi muayene veya önerinin yerini tutmaz. Uygulama, tıbbi randevulardan önce kendi bilgilerinizin yapılandırılmış hazırlığına ve belgelenmesine yardımcı olur. Aktarım olmadan yalnızca yerelde PDF oluşturursanız orada açıklanan özel notlar geçerlidir.",
      },
    ],
  },
  {
    id: "ds-3-kategorien",
    heading: "3. Kişisel veri kategorileri",
    blocks: [
      {
        type: "p",
        text:
          "Uygulamayı nasıl kullandığınıza bağlı olarak aşağıdaki kişisel veri kategorileri işlenebilir:",
      },
      {
        type: "ul",
        items: [
          "Hesap verileri: e-posta adresi, isteğe bağlı ad veya kullanıcı adı, parola özeti (düz metin parola yok), dil ayarı.",
          "Sağlıkla ilgili veriler: semptomlar hakkında metin girişleri, semptom sohbetindeki yanıtlar, vücut haritasında seçilen bölgeler, serbest metin alanlarındaki sağlıkla ilgili bilgiler.",
          "Görüntü verileri: yüklediğiniz görüntüler (ör. cilt değişiklikleri, vücut bölgelerinin fotoğrafları veya diğer sağlıkla ilgili alanlar). MedScoutX bu görüntüleri dikkate değer bulguları tanımlamak için kullanır; tek başına tıbbi tanı için değildir.",
          "Kullanım ve günlük verileri: istek zaman damgaları, teknik hata günlükleri, isteğe bağlı kısaltılmış IP adresi, tarayıcı/cihaz bilgisi, işletim sistemi, kullanılan uygulama sürümü.",
          "Abonelik ve sözleşme verileri (ücretli abonelik kullanıyorsanız): plan, süre, abonelik durumu, teknik satın alma bilgisi (App Store / Play Store üzerinden). Tam ödeme verileri (ör. kredi kartı numaraları) MedScoutX tarafından saklanmaz; ilgili platform ödeme hizmeti tarafından işlenir.",
          "Cihazınızdaki yerel veriler: örn. yerel olarak saklanan sohbet geçmişi veya ayarlar (dil, erişilebilirlik) LocalStorage veya benzeri depolamada.",
        ],
      },
    ],
  },
  {
    id: "ds-4-zwecke",
    heading: "4. İşleme amaçları",
    blocks: [
      {
        type: "ul",
        items: [
          "Uygulama işlevleri: giriş, kayıt, hesap yönetimi ve temel MedScoutX özellikleri.",
          "Semptom sohbeti ve yapay zekâ destekli takip soruları: metin girdinizi netleştirme soruları ve ipuçları için işleme.",
          "Vücut haritası: seçtiğiniz bölgeleri uygun yapay zekâ takip sorularına ve ipuçlarına bağlama.",
          "Görüntü analizi: yüklenen görüntüleri dikkate değer bulguları tanımlamak ve olası sonraki adımları önermek için işleme (ör. klinisyen netliği). Tıbbi-hukuki anlamda otomatik tanı yapılmaz.",
          "Kararlılık ve güvenlik: hata analizi, kötüye kullanım tespiti, sistem ve verilerin korunması.",
          "Yasal gereklilikler: yasal yükümlülüklerin yerine getirilmesi (ör. BT güvenliği önlemlerinin belgelenmesi, saklama süreleri).",
        ],
      },
    ],
  },
  {
    id: "ds-5-rechtsgrundlagen",
    heading: "5. Hukuki dayanaklar (GDPR)",
    blocks: [
      {
        type: "p",
        text:
          "Duruma bağlı olarak işlemeye şu hukuki dayanakları kullanıyoruz:",
      },
      {
        type: "ul",
        items: [
          "Madde 6 (1)(b) GDPR – sözleşmenin ifası: kayıt, giriş ve hesap yönetimi gibi teknik uygulama işlevleri için.",
          "Madde 6 (1)(f) GDPR – meşru menfaat: BT güvenliği, hata analizi ve kötüye kullanım tespiti.",
          "Madde 6 (1)(c) GDPR – yasal yükümlülük: yasal saklama yükümlülüklerinin bulunduğu hallerde (ör. aboneliklerle bağlantılı vergi yükümlülükleri).",
          "Madde 9 (2)(a) GDPR – açık rıza: sağlık verileriniz için birincil hukuki dayanaktır. Gönüllü olarak girdiğiniz semptomlar, vücut haritası seçimleri ve görüntü yükleme/analizi buna dahildir. İlk kullanımda açıkça rıza istenir (ör. onay kutusu ve onay düğmesi). Rızayı gelecek için geçerli olmak üzere istediğiniz zaman geri çekebilirsiniz.",
        ],
      },
    ],
  },
  {
    id: "ds-6-auftragsverarbeiter",
    heading: "6. İşleyenler ve üçüncü taraflara aktarım",
    blocks: [
      {
        type: "p",
        text:
          "Belirli işlevler için MedScoutX, GDPR Madde 28 kapsamında işleyen olarak hizmet sağlayıcılar kullanır. Ana kategoriler:",
      },
      {
        type: "ul",
        items: [
          "Barındırma sağlayıcıları (AB): sunucu ve veritabanı altyapısı (ör. AB konumlu Render.com).",
          "Yapay zekâ sağlayıcısı – OpenAI (ABD): metin, görüntü ve vücut haritası verilerinin yapay zekâ işlemesi için içerik şifreli olarak OpenAI LLC’ye (San Francisco, ABD) iletilir, işlenir ve işlemden sonra silinir.",
          "E-posta sağlayıcıları: sistem e-postalarının gönderimi (ör. doğrulama e-postaları).",
        ],
      },
      {
        type: "p",
        text:
          "Tüm işleyenler GDPR Madde 28 uyarınca sözleşmeyle bağlıdır ve verileri yalnızca talimatımızla işler. Reklam veya pazarlama için veri aktarımı yoktur.",
      },
    ],
  },
  {
    id: "ds-7-drittland",
    heading: "7. Üçüncü ülkeye aktarımlar",
    blocks: [
      {
        type: "p",
        text:
          "MedScoutX yapay zekâ işlevleri kullanıldığında içerik (metin, semptomlar, görüntü verileri) ABD’deki OpenAI LLC’ye aktarılabilir. Bu, GDPR anlamında üçüncü ülkeye aktarımdır.",
      },
      {
        type: "p",
        text:
          "Uygun koruma düzeyini sağlamak için aktarım AB standart sözleşme maddelerine (Madde 46 GDPR) ve ek teknik ve örgütsel önlemlere (aktarımda şifreleme, kısa işlem süresi, yapay zekâ yanıtından sonra silme) dayanır.",
      },
      {
        type: "p_link",
        before: "Ek bilgi OpenAI gizlilik belgelerinde: ",
        href: "https://openai.com/policies/privacy-policy",
        linkText: "https://openai.com/policies/privacy-policy",
        after: "",
      },
    ],
  },
];
