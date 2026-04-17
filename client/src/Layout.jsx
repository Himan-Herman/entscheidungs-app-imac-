import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import Header from "./components/Header";
import Footer from "./components/Footer";
import "./styles/layout.css";

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

  return (
    <>
      {!hideHeader && <Header />}
      <main
        className={`layout-main ${
          !hideHeader ? "layout-main--with-header" : ""
        }`.trim()}
      >
        <Outlet />
      </main>
      {!hideHeader && !hideFooter && <Footer />}
    </>
  );
}
