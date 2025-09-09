import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import Header from "./components/Header";
import Footer from "./components/Footer";

export default function Layout() {
  const { pathname, search } = useLocation();
  const params = new URLSearchParams(search);

  const isLoggedIn = !!localStorage.getItem("medscout_user_id");
  const isLegal = pathname === "/impressum" || pathname === "/datenschutz";
  const forcePublic = params.get("public") === "1";

  // bestimmte Seiten ohne Navigation
  const hideNav =
    pathname.startsWith("/check-email") || pathname.startsWith("/verified");

  // Legal-Seiten ohne Header/Footer, wenn öffentlich oder ?public=1
  const hideHeaderFooter =
    pathname === "/register" || (isLegal && (!isLoggedIn || forcePublic));

  return (
    <>
      {!hideNav && !hideHeaderFooter && <Header />}
      <main>
        <Outlet />
      </main>
      {!hideNav && !hideHeaderFooter && <Footer />}
    </>
  );
}
