/** Turkish — semptom, görüntü, vücut haritası, gizlilik, klinik iletişimler */
export default {
  settingsPrivacy: {
    heading: "Verileri dışa aktarma ve silme",
    intro:
      "Hesabınızdaki Pre-Visit ile ilişkili MedScoutX verilerini dışa aktarın veya silin.",
    exportTitle: "Dışa aktarma",
    exportHelp:
      "Yapılandırılmış bir JSON dosyası indirin: profil, iletişimler, kurum profilleri (gizli olmayan), hazırlıklar, akışlar, takipler ve denetim için ara veriler.",
    exportButton: "Verilerimi dışa aktar",
    exporting: "Dışa aktarım hazırlanıyor…",
    exportDone: "İndirme başladı.",
    exportError: "Dışa aktarım tamamlanamadı. Daha sonra tekrar deneyin.",
    dangerTitle: "Kayıtlı MedScoutX verilerini silme",
    dangerHelp:
      "Pre-Visit hazırlıkları, akışlar, iletişimler, kurum profilleriniz (QR dahil), üyelikler ve ilgili takipleri kaldırır. Oturum açma kalır.",
    dangerPhraseLabel: "Onay ifadesini aynen yazın:",
    dangerPhraseHint: "Onay ifadesi:",
    dangerPlaceholder: "DELETE_MY_MEDSCOUTX_DATA",
    deleteButton: "Kayıtlı verilerimi sil",
    deleting: "Siliniyor…",
    deleteConfirmError: "Onay ifadesi eşleşmiyor.",
    deleteSuccess:
      "MedScoutX içindeki Pre-Visit verileri silindi. Hesabınız etkindir.",
    deleteError: "Silme tamamlanamadı. Daha sonra tekrar deneyin.",
    backStart: "Başa dön",
    legalLinksTitle: "Yasal belgeler ve hesap araçları",
    legalLinksIntro:
      "MedScoutX içinde gizlilik, şartlar ve veri dışa aktarma/silme bağlantıları.",
    linkPrivacy: "Gizlilik politikası",
    linkImprint: "Yasal künye",
    linkTerms: "Şartlar ve koşullar",
    linkAccountPrivacyHub: "Hesapta gizlilik ve Pre-Visit silme",
  },
  settingsDoctorContacts: {
    pageTitle: "MedScoutX — klinik iletişimler",
    heading: "Klinik iletişimler",
    intro:
      "Muayene öncesi hazırlığı paylaşmak için iletişimleri yönetin. Bu kayıtları yalnızca siz görürsünüz.",
    backHome: "Başa dön",
    addContact: "İletişim ekle",
    save: "Kaydet",
    cancel: "İptal",
    edit: "Düzenle",
    delete: "Sil",
    deleteConfirm:
      "Bu iletişimi kalıcı olarak silmek istiyor musunuz? Açık hazırlıktaki yerel seçimleriniz değiştirene kadar kalır.",
    empty: "İletişim yok. Örneğin muayene veya hekim ekleyin.",
    loadingContacts: "Yükleniyor…",
    loadError: "İletişimler yüklenemedi.",
    saveError: "İletişim kaydedilemedi.",
    deleteError: "İletişim silinemedi.",
    fieldDoctorName: "Sağlık sunucusu adı",
    fieldPracticeName: "Muayene / kurum",
    fieldSpecialty: "Uzmanlık",
    fieldEmail: "E-posta",
    fieldPhone: "Telefon (isteğe bağlı)",
    fieldAddress: "Adres (isteğe bağlı)",
    fieldNote: "Not (isteğe bağlı)",
    requiredHint: "Zorunlu alanlar işaretlidir.",
    cardAria: "Klinik iletişim",
  },
  symptomCheck: {
    pageTitle: "Yapılandırılmış semptom kaydı — MedScoutX",
    heading: "Yapılandırılmış semptom kaydı",
    subtitle:
      "Muayeneden önce semptomları ve bağlamı düzenleyin. Teşhis sağlamaz; tedavi önerisi sunmaz.",
    chipPrimary: "Yapılandırılmış kayıt",
    chipSecondary: "Doktor görüşmesine hazırlık",
    storeSafetyNotice:
      "MedScoutX tıbbi teşhis sunmaz, klinik danışmanlığın yerini tutmaz ve acil servis değildir. Şiddetli veya çok rahatsız edici belirtilerde acil veya sağlık sunucusuna başvurun.",
    consentTitle: "Devam etmeden önce",
    consentCheckbox:
      "Bu özelliğin acil durum için olmadığını; teşhis sağlamadığını, tedavi önerisi sunmadığını ve aciliyet değerlendirmesi yapmadığını anlıyorum. Sohbet metni silene kadar bu cihazda saklanabilir; mesaj gönderdiğimde metin gizlilik politikasına uygun olarak MedScoutX sunucularında ve yapay zekâ sağlayıcılarında işlenir. Ses yalnızca kaydı başlattığımda gönderilir.",
    consentContinue: "Devam",
    consentPrivacyLink: "Gizlilik politikası",
    hintsTitle: "Belirtileri anlatmak için ipuçları",
    hintsIntro:
      "Kısalık ve netlik muayene özeti için yardımcı olur.",
    hintDuration: "Ne zamandan beri fark ediyorsunuz?",
    hintLocation: "Vücudun hangi bölgesinde?",
    hintSeverity: "Şiddet örneğin 1–10 arasında nasıl?",
    hintAssociated:
      "Uyku, aktivite, ateş vb. bahsetmek ister misiniz?",
    newChat: "Yeni sohbet",
    newChatAria: "Yeni sohbet başlat",
    clearHistory: "Geçmişi temizle",
    clearHistoryAria: "Bu cihazda saklanan geçmişi temizle",
    chatTitle: "Sohbet",
    chatIntro:
      "Tarafsız sorular ve belki notlarınız için bir özet — klinik değerlendirme değildir.",
    placeholderEmpty: "Henüz mesaj yok. Örneğin şöyle başlayabilirsiniz:",
    placeholderExample:
      "«Dünden beri eğildiğimde bel altında keskin ağrı var.»",
    thinking: "Yanıt hazırlanıyor…",
    analyzingAvoided: "Yanıt hazırlanıyor…",
    inputLabel: "Kendi sözlerinizle açıklama",
    inputPlaceholder:
      "Belirtiyi tarif edin — yer, süre, şiddet, tetikleyiciler vb.",
    maxCharsLabel: "En fazla {{max}} karakter",
    sendAria: "Mesaj gönder",
    offlineError: "Bağlantı yok. Kayıt için ağ gerekir.",
    offlineBadge: "Çevrimdışı",
    serverError: "Hata oluştu. Daha sonra tekrar deneyin.",
    copyConversation: "Sohbeti kopyala",
    downloadTxt: "Metin olarak indir",
    copyDone: "Panoya kopyalandı.",
    copyFail: "Kopyalanamadı — metni elle seçin.",
    speakAria: "Yanıtı sesli oku",
    micNotice:
      "Mikrofon: kayıt yalnızca dokunarak başlar ve durdurularak biter.",
    voiceStart: "Ses girişini başlat",
    voiceStop: "Ses girişini durdur",
    voiceMicError: "Mikrofon kullanılamıyor.",
    voiceTxError: "Ses metne dönüştürülemedi.",
    statusReady: "Hazır",
    assistantLabel: "Asistan",
    userLabel: "Siz",
    accountDataHint: "Kayıtlı verileri dışa aktarma ve silme (varsa):",
    accountDataLink: "Gizlilik ve veriler",
  },
  imageAnalysis: {
    pageTitle: "Yapılandırılmış görsel açıklama — MedScoutX",
    heading: "Yapılandırılmış görsel açıklama",
    subtitle:
      "Muayene hazırlığı için görüntüde görünenleri düzenleyin. Ne teşhis ne klinik değerlendirmedir.",
    chipPrimary: "Kullanıcı görüntü gönderir",
    chipSecondary: "Doktor görüşmesine hazırlık",
    storeDisclaimer:
      "MedScoutX görüntüden teşhis sunmaz ve klinik incelemenin yerini tutmaz; yalnızca muayene için yüklediğiniz görüntüleri düzenlemenize yardımcı olur.",
    emergencyNote:
      "Şiddetli veya ciddi olabilecek durumlarda acil veya sağlık sunucusuna başvurun.",
    storageNote:
      "Önizleme oturum boyunca bu cihazda kalır. Sohbet silene kadar yerelde saklanabilir. Görüntü yalnızca açıkça seçerseniz kalıcı saklanır.",
    consentTitle: "Görüntü yüklemeden önce",
    consentCheckbox:
      "Yapılandırılmış açıklama oluşturmak için görüntünün işlenmesine (MedScoutX sunucularına ve gizlilik politikasına uygun olarak yapay zekâ sağlayıcılarına gönderim dahil) izin verdiğimi onaylıyorum.",
    consentContinue: "Devam",
    consentPrivacyLink: "Gizlilik politikası",
    panelUploadTitle: "Görüntü seç",
    panelUploadIntro:
      "Galeri, kamera veya web kamerası yalnızca sizin komutunuzla. Mesaj gönderilene kadar hiçbir şey gönderilmez.",
    uploadGallery: "Galeriden seç",
    uploadCamera: "Fotoğraf çek veya seç",
    uploadWebcam: "Web kamerası kullan",
    webcamExplainer:
      "Kamera yalnızca dokunuşla açılır; arka planda kayıt yoktur.",
    removeImage: "Görüntüyü kaldır",
    removeImageAria: "Seçilen görüntüyü önizlemeden kaldır",
    previewAlt: "Yapılandırılmış açıklama için seçilen görüntü",
    previewCaption: "Önizleme — klinik karar değildir",
    previewEmpty: "Henüz görüntü seçilmedi",
    processingNote:
      "Açıklamalar görüntüye ve söylediklerinize dayanır — teşhis değildir.",
    newChat: "Tümünü sıfırla",
    newChatAria: "Bu cihazda görüntüyü, sohbeti ve yerel zinciri sil",
    clearHistory: "Yalnızca sohbeti temizle",
    clearHistoryAria:
      "Yalnızca bu sohbet için yerel metni sil",
    chatTitle: "Sohbet",
    chatIntro:
      "Tarafsız bağlam ekleyin. Yanıtlar muayene için nottur — otomatik klinik yorum değildir.",
    placeholderEmpty: "Mesaj yok. Görüntü seçtikten sonra yazabilirsiniz:",
    placeholderExample: "«Kısaca neyin değiştiğini veya ne gördüğünüzü yazın.»",
    loadingText: "Yapılandırılmış açıklama oluşturuluyor…",
    questionLabel: "Soru veya bağlam",
    questionPlaceholder:
      "Bağlam ekleyin veya tarafsız düzenli bir açıklama isteyin…",
    maxCharsLabel: "En fazla {{max}} karakter",
    sendAria: "Yapılandırılmış açıklama için gönder",
    inputDisabledHint: "Göndermeden önce görüntü seçin ve onayı işaretleyin.",
    needImageWarning: "Göndermeden önce görüntü seçin.",
    webcamTitle: "Web kamerasıyla görüntü",
    webcamIntro:
      "Önemli olanı kadrajlayıp yakalayın. Yakalama veya iptalden sonra akış durur.",
    webcamCapture: "Yakala",
    webcamCancel: "İptal",
    cameraDenied: "Kamera erişimi reddedildi veya kullanılamıyor.",
    offlineError: "Bağlantı yok. Bu işlem ağ gerektirir.",
    serverError: "Hata oluştu. Daha sonra tekrar deneyin.",
    speakAria: "Yanıtı sesli oku",
    statusReady: "Hazır",
    offlineBadge: "Çevrimdışı",
    micNotice:
      "Ses yalnızca istemli kayıtta gönderilir; otomatik saklanmaz.",
    voiceStart: "Ses girişini başlat",
    voiceStop: "Ses girişini durdur",
    voiceMicError: "Mikrofon kullanılamıyor.",
    voiceTxError: "Ses metne dönüştürülemedi.",
    accountDataHint: "Hesap verilerini dışa aktarma ve silme (varsa):",
    accountDataLink: "Gizlilik ve veriler",
    userLabel: "Siz",
    assistantLabel: "Yapılandırılmış not",
  },
  bodyMap: {
    start: {
      pageTitle: "Vücut haritası — MedScoutX",
      title: "Vücut haritası",
      subtitle:
        "Bölgeleri işaretleyip muayene için not yazın. Ne teşhis ne klinik muayenedir.",
      chip1: "Konum",
      chip2: "Doktor görüşmesine hazırlık",
      storeDisclaimer:
        "Vücut haritası yalnızca bölgeleri görsel olarak göstermek ve muayene için bilgi toplamaktır — işaretlerden otomatik klinik değerlendirme çıkmaz.",
      emergencyNote:
        "Çok şiddetli belirtilerde acil veya uzmana başvurun.",
      consentTitle: "Vücut haritasını kullanmadan önce",
      consentCheckbox:
        "Haritanın teşhis sunmadığını ve aciliyet değerlendirmesi yapmadığını; sohbetin silene kadar bu cihazda saklanabileceğini; mesaj gönderildiğinde metnin gizlilik politikasına uygun olarak MedScoutX ve yapay zekâ üzerinden işleneceğini anlıyorum.",
      consentContinue: "Devam",
      consentPrivacyLink: "Gizlilik politikası",
      panelTitle: "Görünüm seç",
      hint:
        "Ön ve arka görünüm arasında geçiş yapın. Klavye ve ekran okuyucu ile kullanılabilir.",
      open: "Görünüm seçimini aç",
      close: "Görünüm seçimini kapat",
      frontAria: "Haritayı aç — ön",
      frontTitle: "Ön",
      frontText: "Göğüs, karın, yüz, kolların ve bacakların ön yüzü.",
      backAria: "Haritayı aç — arka",
      backTitle: "Arka",
      backText:
        "Sırt, boyun, omuzlar, kolların ve bacakların arka yüzü.",
      footer:
        "Görünümü sonra değiştirebilirsiniz. Bölge sohbeti silene kadar bu cihazda kalır.",
    },
    mapFront: {
      pageTitle: "Vücut haritası — ön — MedScoutX",
      heading: "Vücut haritası — ön",
      inlineDisclaimer:
        "Tarafsız notlar için bölgeye dokunun — bu klinik muayene değildir.",
      backToHub: "Harita girişine dön",
      backToHubAria: "Vücut haritası girişine dön",
      diagramAria: "Ön vücut çizimi; bölge seçin.",
    },
    mapBack: {
      pageTitle: "Vücut haritası — arka — MedScoutX",
      heading: "Vücut haritası — arka",
      inlineDisclaimer:
        "Tarafsız notlar için bölgeyi işaretleyin — bu klinik muayene değildir.",
      backToHub: "Harita girişine dön",
      backToHubAria: "Vücut haritası girişine dön",
      diagramAria: "Arka vücut çizimi; bölge seçin.",
    },
    chat: {
      pageTitle: "Vücut bölgesi notları — MedScoutX",
      title: "Seçilen bölgedeki notlar",
      subtitle:
        "Kendi sözlerinizle açıklayın; düzen için tarafsız sorular gelir — otomatik klinik karar yoktur.",
      chip1: "Vücut haritası",
      chip2: "Konum",
      sectionChat: "Sohbet",
      chatHeading: "Bu bölgedeki açıklama",
      chatIntro:
        "İstediğiniz duygu ve notları paylaşabilirsiniz. Sağlık sunucusu değerlendirmesinin yerini tutmaz.",
      placeholderEmpty:
        "Önce haritada bölge seçin, sonra örneğin şöyle yazın:",
      placeholderExample:
        "«Birkaç gündür kolu yukarı kaldırırken sağ omuzda baskı hissediyorum.»",
      loadingLine: "Yanıt hazırlanıyor…",
      serverError: "Hata oluştu. Daha sonra tekrar deneyin.",
      httpError: "İstek başarısız. Daha sonra tekrar deneyin.",
      inputLabel: "Bu bölgedeki açıklamanız",
      inputPlaceholder:
        "Hissedilen tip, süre, tetikleyiciler, kendi dilinizle…",
      maxCharsLabel: "En fazla {{max}} karakter",
      sendAria: "Mesaj gönder",
      organHintIntro: "Özetin işaretlenen bölgeyle ilişkili kalmasına dikkat edin.",
      organHintExample: "Örn. «{{region}} bölgesinde…»",
      organHintOutro:
        "Bu bölge dışı konular için daha geniş semptom modülünü kullanın.",
      btnNewChat: "Harita akışını sıfırla",
      btnNewChatTitle: "Sohbeti temizle ve harita girişine dön",
      btnClearHistory: "Yalnızca sohbeti temizle",
      btnClearHistoryTitle: "Yalnızca bu sohbetin yerel mesajlarını sil",
      speakAria: "Sesli oku",
      micNotice:
        "Ses kaydı yalnızca isteğinizle başlar; sürekli dinleme yoktur.",
      voiceStart: "Ses girişini başlat",
      voiceStop: "Ses girişini durdur",
      voiceMicError: "Mikrofon kullanılamıyor.",
      voiceTxError: "Ses metne dönüştürülemedi.",
      introAssistant:
        'Haritada "{{region}}" seçtiniz. Orada neler hissettiğinizi kendi sözlerinizle yazın.',
      userLabel: "Siz",
      assistantLabel: "Asistan",
      offlineError: "Bağlantı yok. Bu işlem ağ gerektirir.",
      accountDataHint: "Gizlilik, dışa aktarma ve silme:",
      accountDataLink: "Gizlilik ve veriler",
    },
  },
};
