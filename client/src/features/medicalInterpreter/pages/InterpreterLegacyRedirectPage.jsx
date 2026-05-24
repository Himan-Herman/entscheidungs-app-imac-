import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

function targetSearch(pathname, search) {
  const params = new URLSearchParams(search);
  if (pathname.startsWith("/practice/interpreter")) {
    params.set("entry", "practice");
  } else {
    params.set("entry", "patient");
  }
  const next = params.toString();
  return next ? `/interpreter?${next}` : "/interpreter";
}

export default function InterpreterLegacyRedirectPage() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    navigate(targetSearch(location.pathname, location.search), { replace: true });
  }, [location.pathname, location.search, navigate]);

  return null;
}
