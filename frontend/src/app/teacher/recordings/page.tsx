"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import TeacherSidebar from "@/components/teacher/TeacherSidebar";
import TeacherTopbar from "@/components/teacher/TeacherTopbar";
import "../dashboard/dashboard.css";

interface EligibleClass {
  id: number;
  title: string;
  class_date: string;
  subject_name: string;
  section_name: string;
}

interface Recording {
  id: number;
  public_id: string;
  title: string;
  live_class: string;
  subject: string;
  section: string;
  class_date: string;
  is_available: boolean;
  uploaded_at: string;
}

interface TeacherUser {
  username?: string;
  name?: string;
  organization?: string;
}

export default function TeacherRecordingsPage() {
  const router = useRouter();

  const [teacher, setTeacher] = useState<TeacherUser>({});
  const [eligibleClasses, setEligibleClasses] = useState<EligibleClass[]>([]);
  const [recordings, setRecordings] = useState<Recording[]>([]);

  const [selectedClass, setSelectedClass] = useState("");
  const [title, setTitle] = useState("");
  const [video, setVideo] = useState<File | null>(null);

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [replaceVideo, setReplaceVideo] = useState<File | null>(null);

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

  useEffect(() => {
    const token = localStorage.getItem("teacher_access_token");
    const savedTeacher = localStorage.getItem("teacher_user");

    if (!token) {
      router.replace("/teacher/login");
      return;
    }

    if (savedTeacher) {
      try {
        setTeacher(JSON.parse(savedTeacher));
      } catch {
        // Ignore invalid stored data
      }
    }

    loadData(token);
  }, [router]);

  const loadData = async (token: string) => {
    try {
      setLoading(true);
      setError("");

      const [eligibleResponse, recordingsResponse] = await Promise.all([
        fetch(
          `${API_BASE}/api/live-classes/teacher/recordings/eligible-classes/`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        ),

        fetch(
          `${API_BASE}/api/live-classes/teacher/recordings/`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        ),
      ]);

      if (
        eligibleResponse.status === 401 ||
        recordingsResponse.status === 401
      ) {
        localStorage.removeItem("teacher_access_token");
        localStorage.removeItem("teacher_refresh_token");
        localStorage.removeItem("teacher_user");

        router.replace("/teacher/login");
        return;
      }

      const eligibleData = await eligibleResponse.json();
      const recordingsData = await recordingsResponse.json();

      if (!eligibleResponse.ok) {
        throw new Error(
          eligibleData.detail || "Unable to load eligible classes."
        );
      }

      if (!recordingsResponse.ok) {
        throw new Error(
          recordingsData.detail || "Unable to load recordings."
        );
      }

      setEligibleClasses(eligibleData);
      setRecordings(recordingsData);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load recording data."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();

    const token = localStorage.getItem("teacher_access_token");

    if (!token) {
      router.replace("/teacher/login");
      return;
    }

    if (!selectedClass || !title.trim() || !video) {
      setError(
        "Please select a class, enter a title, and choose a video."
      );
      return;
    }

    try {
      setUploading(true);
      setError("");
      setMessage("");

      const formData = new FormData();

      formData.append("live_class", selectedClass);
      formData.append("title", title.trim());
      formData.append("video", video);

      const response = await fetch(
        `${API_BASE}/api/live-classes/teacher/recordings/upload/`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.detail ||
            result.video?.[0] ||
            result.live_class?.[0] ||
            "Recording upload failed."
        );
      }

      setMessage("Recording uploaded successfully.");

      setSelectedClass("");
      setTitle("");
      setVideo(null);

      const input = document.getElementById(
        "recording-video"
      ) as HTMLInputElement | null;

      if (input) {
        input.value = "";
      }

      await loadData(token);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Recording upload failed."
      );
    } finally {
      setUploading(false);
    }
  };

  const startEditing = (recording: Recording) => {
    setEditingId(recording.public_id);
    setEditTitle(recording.title);
    setMessage("");
    setError("");
  };

  const cancelEditing = () => {
  setEditingId(null);
  setEditTitle("");
  setReplaceVideo(null);
};

  const updateRecording = async (
    publicId: string,
    payload: {
      title?: string;
      is_available?: boolean;
    }
  ) => {
    const token = localStorage.getItem("teacher_access_token");

    if (!token) {
      router.replace("/teacher/login");
      return;
    }

    try {
      setSavingId(publicId);
      setMessage("");
      setError("");

      const response = await fetch(
        `${API_BASE}/api/live-classes/teacher/recordings/${publicId}/`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      if (response.status === 401) {
        localStorage.removeItem("teacher_access_token");
        localStorage.removeItem("teacher_refresh_token");
        localStorage.removeItem("teacher_user");

        router.replace("/teacher/login");
        return;
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.detail ||
            result.title?.[0] ||
            "Unable to update recording."
        );
      }

      setMessage("Recording updated successfully.");

      setEditingId(null);
      setEditTitle("");

      await loadData(token);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update recording."
      );
    } finally {
      setSavingId(null);
    }
  };

  const saveRecordingChanges = async (publicId: string) => {
  const token = localStorage.getItem("teacher_access_token");

  if (!token) {
    router.replace("/teacher/login");
    return;
  }

  if (!editTitle.trim()) {
    setError("Recording title is required.");
    return;
  }

  try {
    setSavingId(publicId);
    setMessage("");
    setError("");

    const formData = new FormData();

    formData.append("title", editTitle.trim());

    if (replaceVideo) {
      formData.append("video", replaceVideo);
    }

    const response = await fetch(
      `${API_BASE}/api/live-classes/teacher/recordings/${publicId}/`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      }
    );

    if (response.status === 401) {
      localStorage.removeItem("teacher_access_token");
      localStorage.removeItem("teacher_refresh_token");
      localStorage.removeItem("teacher_user");

      router.replace("/teacher/login");
      return;
    }

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.detail ||
          result.title?.[0] ||
          result.video?.[0] ||
          "Unable to update recording."
      );
    }

    setMessage(
      replaceVideo
        ? "Recording and video updated successfully."
        : "Recording updated successfully."
    );

    setEditingId(null);
    setEditTitle("");
    setReplaceVideo(null);

    await loadData(token);
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : "Unable to update recording."
    );
  } finally {
    setSavingId(null);
  }
};

  return (
    <div className="teacher-dashboard">
      <TeacherSidebar />

      <main className="teacher-dashboard-main">
        <TeacherTopbar
          name={teacher.name || teacher.username || "Teacher"}
          organization={teacher.organization || ""}
        />

        <div className="teacher-dashboard-content">
          <div className="container-fluid">

            <div className="mb-4">
              <h2 className="fw-bold mb-1">
                Recordings
              </h2>

              <p className="text-muted mb-0">
                Upload and manage completed class recordings.
              </p>
            </div>

            {message && (
              <div className="alert alert-success">
                {message}
              </div>
            )}

            {error && (
              <div className="alert alert-danger">
                {error}
              </div>
            )}

            {/* UPLOAD RECORDING */}
            <div className="card border-0 shadow-sm mb-4">
              <div className="card-body p-4">

                <h5 className="fw-bold mb-4">
                  Upload Recording
                </h5>

                <form onSubmit={handleUpload}>
                  <div className="row g-3">

                    <div className="col-lg-4">
                      <label className="form-label">
                        Completed Class
                      </label>

                      <select
                        className="form-select"
                        value={selectedClass}
                        onChange={(e) =>
                          setSelectedClass(e.target.value)
                        }
                      >
                        <option value="">
                          Select class
                        </option>

                        {eligibleClasses.map((liveClass) => (
                          <option
                            key={liveClass.id}
                            value={liveClass.id}
                          >
                            {liveClass.title} -{" "}
                            {liveClass.class_date}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-lg-4">
                      <label className="form-label">
                        Recording Title
                      </label>

                      <input
                        type="text"
                        className="form-control"
                        value={title}
                        placeholder="Enter recording title"
                        onChange={(e) =>
                          setTitle(e.target.value)
                        }
                      />
                    </div>

                    <div className="col-lg-4">
                      <label className="form-label">
                        Video File
                      </label>

                      <input
                        id="recording-video"
                        type="file"
                        className="form-control"
                        accept="video/*"
                        onChange={(e) =>
                          setVideo(
                            e.target.files?.[0] || null
                          )
                        }
                      />
                    </div>

                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary mt-4"
                    disabled={uploading}
                  >
                    {uploading
                      ? "Uploading..."
                      : "Upload Recording"}
                  </button>
                </form>

                {!loading &&
                  eligibleClasses.length === 0 && (
                    <p className="text-muted small mt-3 mb-0">
                      No completed classes are eligible for upload.
                    </p>
                  )}

              </div>
            </div>

            {/* MY RECORDINGS */}
            <div className="card border-0 shadow-sm">
              <div className="card-body p-4">

                <div className="d-flex justify-content-between align-items-center mb-4">
                  <h5 className="fw-bold mb-0">
                    My Recordings
                  </h5>

                  <span className="badge bg-primary">
                    {recordings.length}
                  </span>
                </div>

                {loading && (
                  <p className="mb-0">
                    Loading recordings...
                  </p>
                )}

                {!loading &&
                  recordings.length === 0 && (
                    <div className="text-center py-4">
                      <h6>
                        No recordings uploaded yet
                      </h6>

                      <p className="text-muted mb-0">
                        Uploaded recordings will appear here.
                      </p>
                    </div>
                  )}

                {!loading &&
                  recordings.map((recording) => (
                    <div
                      key={recording.public_id}
                      className="border rounded p-3 mb-3"
                    >

                      <div className="d-flex justify-content-between flex-wrap gap-3">

                        <div>
                          <h6 className="fw-bold mb-1">
                            {recording.title}
                          </h6>

                          <div className="small text-muted">
                            {recording.live_class}
                          </div>

                          <div className="small mt-2">
                            {recording.subject}
                            {" • "}
                            {recording.section}
                          </div>

                          <div className="small mt-1">
                            Class Date:{" "}
                            {recording.class_date}
                          </div>
                        </div>

                        <div className="d-flex flex-column align-items-end gap-2">

                          <button
                            type="button"
                            className="btn btn-outline-primary btn-sm"
                            onClick={() =>
                              startEditing(recording)
                            }
                          >
                            Edit
                          </button>

                         

                        </div>

                      </div>

                      {/* EDIT TITLE */}
                      {editingId === recording.public_id && (
  <div className="border-top mt-3 pt-3">

    <div className="row g-3">

      <div className="col-lg-6">
        <label className="form-label">
          Recording Title
        </label>

        <input
          type="text"
          className="form-control"
          value={editTitle}
          onChange={(e) =>
            setEditTitle(e.target.value)
          }
        />
      </div>

      <div className="col-lg-6">
        <label className="form-label">
          Replace Video
        </label>

        <input
          type="file"
          className="form-control"
          accept="video/*"
          onChange={(e) =>
            setReplaceVideo(
              e.target.files?.[0] || null
            )
          }
        />

        <small className="text-muted">
          Leave empty if you only want to change the title.
        </small>
      </div>

    </div>

    <div className="d-flex gap-2 mt-3">

      <button
        type="button"
        className="btn btn-primary btn-sm"
        disabled={
          savingId === recording.public_id ||
          !editTitle.trim()
        }
        onClick={() =>
          saveRecordingChanges(recording.public_id)
        }
      >
        {savingId === recording.public_id
          ? "Saving..."
          : "Save Changes"}
      </button>

      <button
        type="button"
        className="btn btn-outline-secondary btn-sm"
        onClick={cancelEditing}
        disabled={
          savingId === recording.public_id
        }
      >
        Cancel
      </button>

    </div>

  </div>
)}
                      {}

                    </div>
                  ))}

              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}