import { useMemo } from "react";
import { useLanguage } from "../i18n/LanguageContext";
import { getMessages } from "../i18n/translations";
import { useOnlineStatus } from "../hooks/useOnlineStatus.js";
import "./OfflineBanner.css";

export default function OfflineBanner() {
  const online = useOnlineStatus();
  const { language } = useLanguage();
  const t = useMemo(() => {
    const m = getMessages(language);
    return m.appShell ?? getMessages("en").appShell;
  }, [language]);

  if (online) return null;

  return (
    <div className="offline-banner" role="status">
      <p className="offline-banner__title">{t.offlineTitle}</p>
      <p className="offline-banner__detail">{t.offlineDetail}</p>
    </div>
  );
}
