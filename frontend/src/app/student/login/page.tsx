"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function StudentLoginPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/accounts/student/login/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username,
            password,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.detail || "Login failed.");
        return;
      }

      localStorage.setItem("student_access_token", data.access);
      localStorage.setItem("student_refresh_token", data.refresh);

      localStorage.setItem(
        "student_user",
        JSON.stringify(data.user)
      );

      router.push("/student/dashboard");
    } catch {
      setError(
        "Unable to connect to the server. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-vh-100 d-flex align-items-center justify-content-center bg-light">
      <div
        className="card border-0 shadow-sm"
        style={{
          width: "100%",
          maxWidth: "430px",
          borderRadius: "16px",
        }}
      >
        <div className="card-body p-4 p-md-5">

          <div className="text-center mb-4">
            <div
              className="bg-primary text-white fw-bold mx-auto mb-3 d-flex align-items-center justify-content-center"
              style={{
                width: "55px",
                height: "55px",
                borderRadius: "14px",
              }}
            >
              LMS
            </div>

            <h2 className="fw-bold mb-1">
              Student Login
            </h2>

            <p className="text-muted mb-0">
              Sign in to continue to your dashboard
            </p>
          </div>

          {error && (
            <div className="alert alert-danger">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>

            <div className="mb-3">
              <label
                htmlFor="username"
                className="form-label fw-medium"
              >
                Username
              </label>

              <input
                id="username"
                type="text"
                className="form-control"
                value={username}
                onChange={(event) =>
                  setUsername(event.target.value)
                }
                placeholder="Enter your username"
                required
              />
            </div>

            <div className="mb-4">
              <label
                htmlFor="password"
                className="form-label fw-medium"
              >
                Password
              </label>

              <input
                id="password"
                type="password"
                className="form-control"
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                placeholder="Enter your password"
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary w-100 py-2"
              disabled={loading}
            >
              {loading ? "Signing in..." : "Login"}
            </button>

          </form>

        </div>
      </div>
    </main>
  );
}