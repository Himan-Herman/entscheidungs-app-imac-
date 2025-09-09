import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function Verified() {
  const navigate = useNavigate();
  useEffect(() => {
    localStorage.setItem("email_verified", "true");
    navigate("/intro", { replace: true });  // → Intro → Startseite
  }, [navigate]);
  return null;
}
