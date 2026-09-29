"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface SecureVideoPlayerProps {
  playbackUrl: string;
  title: string;
  onClose: () => void;
}

export default function SecureVideoPlayer({
  playbackUrl,
  title,
  onClose,
}: SecureVideoPlayerProps) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    let objectUrl: string | null = null;

    async function loadVideo() {
      const token = localStorage.getItem("student_access_token");

      if (!token) {
        setError("Authentication required.");
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE_URL}${playbackUrl}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          setError(
            "You are not authorized to watch this recording."
          );
          return;
        }

        const blob = await response.blob();

        objectUrl = URL.createObjectURL(blob);

        setVideoUrl(objectUrl);
      } catch {
        setError("Unable to load recording.");
      } finally {
        setLoading(false);
      }
    }

    loadVideo();

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [playbackUrl]);

  if (!mounted) {
    return null;
  }

  return createPortal(
    <div
      className="video-modal-backdrop"
      onClick={onClose}
    >
      <div
        className="video-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="video-modal-header">
          <h5>{title}</h5>

          <button
            type="button"
            className="video-modal-close"
            onClick={onClose}
            aria-label="Close video"
          >
            ×
          </button>
        </div>

        <div className="video-modal-body">

          {loading && (
            <div className="video-loading">
              <div className="spinner-border text-primary" />
              <span>Loading recording...</span>
            </div>
          )}

          {error && (
            <div className="alert alert-danger mb-0">
              {error}
            </div>
          )}

          {videoUrl && (
            <video
              src={videoUrl}
              controls
              autoPlay
              controlsList="nodownload"
              disablePictureInPicture
              className="secure-video"
            >
              Your browser does not support video playback.
            </video>
          )}

        </div>
      </div>
    </div>,
    document.body
  );
}