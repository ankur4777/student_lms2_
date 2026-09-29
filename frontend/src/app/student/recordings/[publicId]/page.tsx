"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import StudentFeatureRestricted, { isClassFeatureRestricted } from "@/components/student/StudentFeatureRestricted";

export default function StudentRecordingPage() {
  const params = useParams();
  const router = useRouter();

  const publicId = String(params.publicId);

  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const handleShareRecording = async (publicId: string) => {
  const shareUrl = `${window.location.origin}/student/recordings/${publicId}`;

  try {
    await navigator.clipboard.writeText(shareUrl);
    alert("Recording link copied!");
  } catch (error) {
    console.error("Failed to copy recording link:", error);
    alert("Unable to copy recording link.");
  }
};
  const [error, setError] = useState("");
  

  useEffect(() => {
    let objectUrl: string | null = null;

    const loadRecording = async () => {
      const token = localStorage.getItem("student_access_token");

      // Student is not logged in
      if (!token) {
        router.replace(
          `/student/login?next=${encodeURIComponent(
            `/student/recordings/${publicId}`
          )}`
        );
        return;
      }

      try {
        const apiBase =
          process.env.NEXT_PUBLIC_API_BASE_URL ||
          "http://127.0.0.1:8000";

        const response = await fetch(
          `${apiBase}/api/live-classes/student/recordings/${publicId}/play/`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.status === 401) {
          localStorage.removeItem("student_access_token");
          localStorage.removeItem("student_refresh_token");
          localStorage.removeItem("student_user");

          router.replace(
            `/student/login?next=${encodeURIComponent(
              `/student/recordings/${publicId}`
            )}`
          );
          return;
        }

        if (response.status === 403) {
          const result = await response.json().catch(() => ({}));
          setError(
            result?.detail ||
              "Access denied. You are not authorized to view this recording."
          );
          return;
        }

        if (response.status === 404) {
          setError("Recording not found or unavailable.");
          return;
        }

        if (!response.ok) {
          setError("Unable to load this recording.");
          return;
        }

        const blob = await response.blob();

        objectUrl = URL.createObjectURL(blob);

        setVideoUrl(objectUrl);
      } catch (err) {
        console.error(err);
        setError("Unable to connect to the server.");
      } finally {
        setLoading(false);
      }
    };

    loadRecording();

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [publicId, router]);

  if (loading) {
    return (
      <div className="container py-5">
        <h3>Loading recording...</h3>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container py-5">
        {isClassFeatureRestricted(error) ? (
          <StudentFeatureRestricted featureName="Recorded Classes" />
        ) : (
          <>
            <div className="alert alert-danger">{error}</div>

            <button
              className="btn btn-primary"
              onClick={() => router.push("/student/dashboard")}
            >
              Back to Dashboard
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="container py-5">
      <h2 className="mb-4">Recorded Class</h2>

      {videoUrl && (
        <video
          src={videoUrl}
          controls
          autoPlay
          controlsList="nodownload"
          disablePictureInPicture
          style={{
            width: "100%",
            maxHeight: "650px",
            background: "#000",
            borderRadius: "12px",
          }}
        />
      )}

      <button
        type="button"
        className="btn btn-outline-secondary mt-4"
        onClick={() => router.push("/student/dashboard")}
      >
        Back to Dashboard
      </button>
    </div>
  );
}