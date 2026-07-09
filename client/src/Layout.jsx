import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import Header from "./components/Header";
import Footer from "./components/Footer";
import OfflineBanner from "./components/OfflineBanner.jsx";
import PwaInstallHint from "./components/PwaInstallHint.jsx";
import AppBottomNav, { shouldShowMobileAppNav } from "./components/AppBottomNav.jsx";
import MedaWidget, { shouldShowMedaWidget } from "./features/meda/components/MedaWidget.jsx";
import "./styles/layout.css";
import "./components/AppBottomNav.css";

export default function Layout() {
  const { pathname, search } = useLocation();
  const params = new URLSearchParams(search);

  const isLoggedIn = !!localStorage.getItem("medscout_user_id");
  const isLegal = pathname === "/impressum" || pathname === "/datenschutz";
  const forcePublic = params.get("public") === "1";

  const isPublicAnamnesisPage = pathname.startsWith("/anamnesis/qr");

  const hideHeader =
    pathname === "/" ||
    pathname.startsWith("/check-email") ||
    pathname.startsWith("/verified") ||
    isPublicAnamnesisPage;

  const hideFooter =
    pathname === "/" ||
    pathname === "/register" ||
    isPublicAnamnesisPage ||
    (isLegal && (!isLoggedIn || forcePublic));

  const showMobileShell = isLoggedIn && shouldShowMobileAppNav(pathname);
  const showMeda = shouldShowMedaWidget(pathname, isLoggedIn);

  return (
    <div
      className={
        showMobileShell ? "layout-app layout-app--mobile-shell" : "layout-app"
      }
    >
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
      {showMeda ? <MedaWidget /> : null}
    </div>
  );
}
