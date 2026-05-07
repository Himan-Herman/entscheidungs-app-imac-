/** Bölümler 8–15 */
export default [
  {
    id: "ds-8-speicherfristen",
    heading: "8. Saklama süreleri",
    blocks: [
      {
        type: "p",
        text:
          "Kural olarak MedScoutX sohbet geçmişlerini, semptomları veya görüntüleri sunucuda kalıcı olarak saklamaz. Sağlıkla ilgili içerik yalnızca cihazınızda yerel olarak (ör. LocalStorage) tutulur ve istediğiniz zaman silinebilir.",
      },
      {
        type: "ul",
        items: [
          "Hesap verileri: e-posta, parola özeti ve dil ayarı hesabınız süresince saklanır; hesap silindikten sonra yasal saklama yükümlülükleri olmadıkça silinir veya anonimleştirilir.",
          "Sohbet ve semptom verileri: sunucuda saklanmaz; yalnızca cihazınızda kalır ve «Yeni görüşme» veya «Geçmişi sil» ile tamamen silinir.",
          "Görüntü yüklemeleri: yapay zekâ hizmetine iletmek için kısa süre işlenir, ardından silinir; kalıcı saklama yoktur.",
          "Teknik günlükler / sunucu günlükleri: işletim, güvenlik ve hata analizi için barındırma hizmetleri teknik günlükler tutar (ör. zaman, kısaltılmış IP, hata ayrıntıları), genelde 14–30 gün; profilinize veya içeriğinize bağlanmaz ve reklam için kullanılmaz.",
          "Yerel veriler (LocalStorage, uygulama depolaması): sohbet geçmişi, ayarlar ve geçmiş girişleri yalnızca cihazınızdadır; «Geçmişi sil» veya cihaz ayarlarıyla kaldırılabilir.",
        ],
      },
    ],
  },
  {
    id: "ds-9-sicherheit",
    heading: "9. Güvenlik",
    blocks: [
      {
        type: "p",
        text:
          "Verilerinizi kayıp, değişiklik, yetkisiz erişim veya kötüye kullanımeye karşı korumak için uygun teknik ve örgütsel önlemler uygularız; özellikle:",
      },
      {
        type: "p",
        text:
          "Sağlık verilerinizin işlenmesi yalnızca ilgili işlevleri ilk kullanımda (semptom sohbeti, vücut haritası, görüntü analizi) açık rızanızdan sonra yapılır (onay kutusu + onay). Bu rızayı uygulama ayarlarından istediğiniz zaman geri çekebilirsiniz.",
      },
      {
        type: "ul",
        items: [
          "Taşıma şifrelemesi (TLS/HTTPS),",
          "erişim kısıtları ve rol/izin sistemleri,",
          "mümkün olduğunda veri minimizasyonu ve anonimleştirme,",
          "düzenli sistem güncellemeleri.",
        ],
      },
    ],
  },
  {
    id: "ds-10-kinder",
    heading: "10. Çocuklar ve gençler",
    blocks: [
      {
        type: "p",
        text:
          "MedScoutX 16 yaşın altındaki çocuklara yönelik değildir. Reşit olmayanlar uygulamayı yalnızca veli veya vasi onayıyla kullanmalıdır. 16 yaşın altındaki bir çocuğa ait verilerin veli rızası olmadan işlendiğini öğrenirsek bu verileri sileriz.",
      },
    ],
  },
  {
    id: "ds-11-rechte",
    heading: "11. Haklarınız (ilgili kişi hakları)",
    blocks: [
      {
        type: "p",
        text: "GDPR kapsamında özellikle şu haklara sahipsiniz:",
      },
      {
        type: "ul",
        items: [
          "Erişim (Madde 15 GDPR): hakkınızda hangi kişisel verileri işlediğimize ilişkin bilgi talep edebilirsiniz.",
          "Düzeltme (Madde 16 GDPR): yanlış verilerin düzeltilmesini veya eksik verilerin tamamlanmasını isteyebilirsiniz.",
          "Silme (Madde 17 GDPR): yasal saklama yükümlülükleri engel olmadıkça kişisel verilerin silinmesini isteyebilirsiniz.",
          "Kısıtlama (Madde 18 GDPR): işlemenin kısıtlanmasını talep edebilirsiniz.",
          "Veri taşınabilirliği (Madde 20 GDPR): yapılandırılmış, yaygın ve makine tarafından okunabilir formatta verilerinizi talep edebilirsiniz.",
          "İtiraz (Madde 21 GDPR): meşru menfaate dayalı işlemeye özel durumunuza ilişkin gerekçelerle itiraz edebilirsiniz.",
          "Rızanın geri çekilmesi (Madde 7(3) GDPR): özellikle sağlık verileri için verilen rızayı gelecek için geçerli olmak üzere istediğiniz zaman geri çekebilirsiniz.",
          "Şikâyet (Madde 77 GDPR): ikamet yerinizdeki veya bizim yerleşim yerimizdeki bir denetim otoritesine şikâyet hakkı.",
        ],
      },
      {
        type: "p",
        text:
          "Haklarınızı kullanmak için yukarıdaki iletişim bilgilerinden bize ulaşabilirsiniz.",
      },
    ],
  },
  {
    id: "ds-12-cookies",
    heading: "12. Çerezler ve LocalStorage",
    blocks: [
      {
        type: "p",
        text:
          "MedScoutX reklam için izleme çerezleri kullanmaz. Kolaylık için cihazınızda yerel depolama kullanılabilir, örneğin:",
      },
      {
        type: "ul",
        items: [
          "dil tercihinizin saklanması,",
          "isteğe bağlı sohbet geçmişi saklama,",
          "erişilebilirlik seçenekleri (ör. yazı tipi boyutu).",
        ],
      },
      {
        type: "p",
        text:
          "Bu bilgileri uygulama içindeki işlevler veya cihaz/tarayıcı ayarları aracılığıyla istediğiniz zaman silebilirsiniz.",
      },
    ],
  },
  {
    id: "ds-13-berechtigungen",
    heading: "13. Uygulama izinleri",
    blocks: [
      {
        type: "p",
        text:
          "Kullanıma bağlı olarak MedScoutX cihazınızda şu izinleri isteyebilir:",
      },
      {
        type: "ul",
        items: [
          "Kamera/dosya erişimi: görüntü analizi için fotoğraf çekmek veya seçmek. İsteğe bağlıdır; cihaz ayarlarından geri alınabilir.",
          "Depolama erişimi: görüntü dosyalarını veya geçici verileri işlemek için.",
        ],
      },
      {
        type: "p",
        text:
          "MedScoutX sizin işleminiz olmadan içeriğe erişmez ve uygulamanın çalışması için gerekli olmayan verileri arka planda üçüncü taraflara göndermez.",
      },
    ],
  },
  {
    id: "ds-14-ki",
    heading: "14. Yapay zekâ işlemesi hakkında notlar",
    blocks: [
      {
        type: "ul",
        items: [
          "Metinleriniz ve uygunsa görüntüleriniz öneriler ve ipuçları üretmek için otomatik işlenir.",
          "Yapay zekâ hata yapabilir veya durumları yanlış değerlendirebilir; çıktıları eleştirel inceleyin ve yalnızca yönlendirme için kullanın.",
          "Üçüncü kişilerin adlarını veya tanımlayıcı bilgilerini göndermeyin ve gereksiz kişisel veriden kaçının.",
          "Uygulamanın kullanımı kişisel tıbbi öneri, tanı veya tedavinin yerini tutmaz.",
        ],
      },
    ],
  },
  {
    id: "ds-15-entscheid",
    heading: "15. GDPR Madde 22 anlamında otomatik karar verme yoktur",
    blocks: [
      {
        type: "p",
        text:
          "MedScoutX tanı koymaz veya hukuki veya benzer şekilde önemli etkiler doğuran otomatik kararlar vermez. Yapay zekâ tarafından üretilen içerik yalnızca yönlendirme içindir ve tıbbi önerinin yerini tutmaz. Tıbben önemli durumlarda bir sağlık profesyoneline başvurmanız istenir.",
      },
    ],
  },
];
