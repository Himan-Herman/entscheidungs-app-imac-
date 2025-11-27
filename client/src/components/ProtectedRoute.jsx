// src/components/ProtectedRoute.jsx
import { Navigate, useLocation } from "react-router-dom";

export default function ProtectedRoute({ children }) {
  const hasUser = !!localStorage.getItem("medscout_user_id"); // aktuell dein Key
  const location = useLocation();

  if (!hasUser) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  return children;
}
