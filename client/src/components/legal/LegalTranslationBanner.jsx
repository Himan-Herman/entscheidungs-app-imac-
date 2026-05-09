import { useMemo } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { getMessages } from "../../i18n/translations/index.js";
import "./LegalTranslationBanner.css";

export default function LegalTranslationBanner() {
  const { language } = useLanguage();
  const { text, deBindingUi } = useMemo(() => {
    const msgs = getMessages(language);
    const locale = typeof language === "string" ? language.toLowerCase() : "";
    const deCommon = getMessages("de").common;
    let deSecond = null;
    if (locale === "fa") deSecond = deCommon?.legalPersianVersionDe;
    else if (locale === "ku") deSecond = deCommon?.legalKurdishVersionDe;
    else if (locale === "ckb") deSecond = deCommon?.legalSoraniVersionDe;
    else if (locale === "tr") deSecond = deCommon?.legalTurkishVersionDe;
    else if (locale === "ru") deSecond = deCommon?.legalRussianVersionDe;
    else if (locale === "el") deSecond = deCommon?.legalGreekVersionDe;
    else if (locale === "pl") deSecond = deCommon?.legalPolishVersionDe;
    else if (locale === "hr") deSecond = deCommon?.legalCroatianVersionDe;
    else if (locale === "bs") deSecond = deCommon?.legalBosnianVersionDe;
    else if (locale === "sr") deSecond = deCommon?.legalSerbianVersionDe;
    return {
      text: msgs.common?.legalTranslationNotice,
      deBindingUi: deSecond,
    };
  }, [language]);

  if (!text && !deBindingUi) return null;

  return (
    <div className="ms-legal-ui-notice" role="note">
      {text ? <p className="ms-legal-ui-notice__para">{text}</p> : null}
      {deBindingUi ? (
        <p className="ms-legal-ui-notice__para ms-legal-ui-notice__de" lang="de" dir="ltr">
          {deBindingUi}
        </p>
      ) : null}
    </div>
  );
}
