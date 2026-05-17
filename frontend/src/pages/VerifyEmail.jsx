import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../api/api";

function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    const token = searchParams.get("token");

    if (!token) {
      setStatus("error");
      return;
    }

    api.get(`/auth/verify-email?token=${token}`)
      .then(() => setStatus("success"))
      .catch(() => setStatus("error"));
  }, []);

  if (status === "loading") return <h2>Verifying...</h2>;
  if (status === "success") return <h2>Email verified ✅</h2>;
  if (status === "error") return <h2>Invalid or expired token ❌</h2>;
}

export default VerifyEmail;