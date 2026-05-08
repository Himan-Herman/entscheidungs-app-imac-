import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import Header from "./components/Header";
import Footer from "./components/Footer";
import OfflineBanner from "./components/OfflineBanner.jsx";
import PwaInstallHint from "./components/PwaInstallHint.jsx";
import AppBottomNav, { shouldShowMobileAppNav } from "./components/AppBottomNav.jsx";
import "./styles/layout.css";
import "./components/AppBottomNav.css";

export default function Layout() {
  const { pathname, search } = useLocation();
  const params = new URLSearchParams(search);

  const isLoggedIn = !!localStorage.getItem("medscout_user_id");
  const isLegal = pathname === "/impressum" || pathname === "/datenschutz";
  const forcePublic = params.get("public") === "1";

  const hideHeader =
    pathname.startsWith("/check-email") || pathname.startsWith("/verified");

  const hideFooter =
    pathname === "/register" ||
    (isLegal && (!isLoggedIn || forcePublic));

  const showMobileShell = isLoggedIn && shouldShowMobileAppNav(pathname);

  return (
    <div className={showMobileShell ? "layout-app layout-app--mobile-shell" : undefined}>
      {!hideHeader && <Header />}
      {!hideHeader && <OfflineBanner />}
      {!hideHeader && <PwaInstallHint hasBottomNav={showMobileShell} />}
      <main
        id="main"
        className={`layout-main ${
          !hideHeader ? "layout-main--with-header" : ""
        } ${showMobileShell ? "layout-main--with-bottom-nav" : ""}`.trim()}
      >
        <Outlet />
      </main>
      {!hideHeader && !hideFooter && <Footer />}
      {showMobileShell ? <AppBottomNav /> : null}
    </div>
  );
}
