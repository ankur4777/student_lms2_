"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import CollegeAdminSidebar from "@/components/college-admin/CollegeAdminSidebar";
import CollegeAdminTopbar from "@/components/college-admin/CollegeAdminTopbar";

import "../../../teacher/dashboard/dashboard.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

interface AdminUser {
  username?: string;
  name?: string;
  organization?: string;
}

interface Teacher {
  id: number;
  name: string;
  username: string;
}

interface AcademicSession {
  id: number;
  name: string;
}

interface ClassRoom {
  id: number;
  name: string;
  academic_session_id: number;
}

interface Section {
  id: number;
  name: string;
  class_id: number;
  academic_session_id: number;
}

interface Subject {
  id: number;
  name: string;
  code: string;
  class_id: number;
  academic_session_id: number;
}

function getSavedAdmin() {
  if (typeof window === "undefined") {
    return {};
  }
  const saved = localStorage.getItem("college_admin_user");
  if (!saved) {
    return {};
  }
  try {
    return JSON.parse(saved);
  } catch {
    return {};
  }
}

export default function CreateTeacherAssignmentPage() {
  const router = useRouter();
  const [admin] = useState<AdminUser>(getSavedAdmin);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teacherId, setTeacherId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const clearSession = useCallback(() => {
    localStorage.removeItem("college_admin_access_token");
    localStorage.removeItem("college_admin_refresh_token");
    localStorage.removeItem("college_admin_user");
  }, []);

  const getToken = useCallback(() => {
    const token = localStorage.getItem("college_admin_access_token");
    if (!token) {
      router.replace("/college-admin/login");
      return "";
    }
    return token;
  }, [router]);

  const filteredClasses = useMemo(
    () =>
      classes.filter(
        (item) =>
          !sessionId ||
          item.academic_session_id === Number(sessionId)
      ),
    [classes, sessionId]
  );

  const filteredSubjects = useMemo(
    () =>
      subjects.filter(
        (item) =>
          (!sessionId ||
            item.academic_session_id === Number(sessionId)) &&
          (!classId || item.class_id === Number(classId))
      ),
    [classId, subjects, sessionId]
  );

  const filteredSections = useMemo(
    () =>
      sections.filter(
        (item) =>
          (!sessionId ||
            item.academic_session_id === Number(sessionId)) &&
          (!classId || item.class_id === Number(classId))
      ),
    [classId, sections, sessionId]
  );

  useEffect(() => {
    let isMounted = true;

    const loadSetup = async () => {
      const token = getToken();
      if (!token) {
        return;
      }

      try {
        const response = await fetch(
          `${API_BASE}/api/accounts/college-admin/teacher-assignments/setup/`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.status === 401) {
          clearSession();
          router.replace("/college-admin/login");
          return;
        }

        const result = await response.json();
        if (!response.ok) {
          throw new Error(result?.detail || "Unable to load setup data.");
        }

        if (isMounted) {
          setTeachers(result.teachers || []);
          setSessions(result.academic_sessions || []);
          setClasses(result.classes || []);
          setSections(result.sections || []);
          setSubjects(result.subjects || []);
        }
      } catch (err) {
        if (isMounted && err instanceof Error) {
          setError(err.message);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadSetup();

    return () => {
      isMounted = false;
    };
  }, [clearSession, getToken, router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");

    const token = getToken();
    if (!token) {
      setSaving(false);
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE}/api/accounts/college-admin/teacher-assignments/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            teacher_id: teacherId,
            subject_id: subjectId,
            section_id: sectionId,
          }),
        }
      );

      if (response.status === 401) {
        clearSession();
        router.replace("/college-admin/login");
        return;
      }

      const result = await response.json();
      if (!response.ok) {
        setError(result?.detail || "Unable to save teacher assignment.");
        return;
      }

      router.replace("/college-admin/teacher-assignments");
    } catch {
      setError("Unable to connect to the server.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="teacher-dashboard">
      <CollegeAdminSidebar />
      <main className="teacher-dashboard-main">
        <CollegeAdminTopbar
          name={admin.name || admin.username || "College Admin"}
          organization={admin.organization || ""}
        />
        <div className="teacher-dashboard-content">
          <div className="container-fluid">
            <div className="mb-4">
              <h2 className="fw-bold mb-1">Add Teacher Assignment</h2>
              <p className="text-muted mb-0">
                Assign a teacher to a subject, class and section.
              </p>
            </div>
            {error && <div className="alert alert-danger">{error}</div>}
            {loading ? (
              <div className="card border-0 shadow-sm">
                <div className="card-body py-5 text-center text-muted">
                  Loading assignment setup...
                </div>
              </div>
            ) : (
              <div className="card border-0 shadow-sm">
                <div className="card-body p-4">
                  <form onSubmit={handleSubmit}>
                    <div className="row g-3">
                      <div className="col-md-6">
                        <label className="form-label">Teacher</label>
                        <select
                          className="form-select"
                          value={teacherId}
                          onChange={(event) =>
                            setTeacherId(event.target.value)
                          }
                          required
                        >
                          <option value="">Select teacher</option>
                          {teachers.map((teacher) => (
                            <option key={teacher.id} value={teacher.id}>
                              {teacher.name} ({teacher.username})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Academic Session</label>
                        <select
                          className="form-select"
                          value={sessionId}
                          onChange={(event) => {
                            setSessionId(event.target.value);
                            setClassId("");
                            setSubjectId("");
                            setSectionId("");
                          }}
                          required
                        >
                          <option value="">Select session</option>
                          {sessions.map((session) => (
                            <option key={session.id} value={session.id}>
                              {session.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Class</label>
                        <select
                          className="form-select"
                          value={classId}
                          onChange={(event) => {
                            setClassId(event.target.value);
                            setSubjectId("");
                            setSectionId("");
                          }}
                          required
                        >
                          <option value="">Select class</option>
                          {filteredClasses.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Subject</label>
                        <select
                          className="form-select"
                          value={subjectId}
                          onChange={(event) =>
                            setSubjectId(event.target.value)
                          }
                          required
                        >
                          <option value="">Select subject</option>
                          {filteredSubjects.map((subject) => (
                            <option key={subject.id} value={subject.id}>
                              {subject.name}
                              {subject.code ? ` (${subject.code})` : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Section</label>
                        <select
                          className="form-select"
                          value={sectionId}
                          onChange={(event) =>
                            setSectionId(event.target.value)
                          }
                          required
                        >
                          <option value="">Select section</option>
                          {filteredSections.map((section) => (
                            <option key={section.id} value={section.id}>
                              {section.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-12 d-flex gap-2">
                        <button
                          className="btn btn-primary"
                          type="submit"
                          disabled={saving}
                        >
                          {saving ? "Saving..." : "Save Assignment"}
                        </button>
                        <button
                          className="btn btn-outline-secondary"
                          type="button"
                          onClick={() =>
                            router.push(
                              "/college-admin/teacher-assignments"
                            )
                          }
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
