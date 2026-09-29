"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import ParentSidebar from "@/components/parent/ParentSidebar";
import ParentTopbar from "@/components/parent/ParentTopbar";
import ParentFeatureRestricted, { isParentClassFeatureRestricted } from "@/components/parent/ParentFeatureRestricted";

import "../../student/dashboard/dashboard.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

interface ParentUser {
  username?: string;
  name?: string;
  organization?: string;
}

interface Child {
  student_profile_id: number;
  name: string;
  username: string;
  roll_number: string;
  classroom_name: string;
  section_name: string;
}

interface SubjectResult {
  subject_id: number;
  subject_name: string;
  marks_obtained: string;
  maximum_marks: string;
  percentage: number;
  remarks: string;
  teacher_name: string;
}

interface ExamResult {
  id: number;
  name: string;
  exam_date: string;
  classroom_name: string;
  section_name: string;
  subjects: SubjectResult[];
  total_obtained: number;
  total_maximum: number;
  percentage: number;
}

interface StudentInfo {
  id: number;
  name: string;
  username: string;
  roll_number: string;
  classroom_name: string;
  section_name: string;
}

export default function ParentResultsPage() {
  const router = useRouter();

  const [parent, setParent] = useState<ParentUser>({});

  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState("");

  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [exams, setExams] = useState<ExamResult[]>([]);

  const [loadingChildren, setLoadingChildren] = useState(true);
  const [loadingResults, setLoadingResults] = useState(false);

  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("parent_access_token");
    const savedParent = localStorage.getItem("parent_user");

    if (!token) {
      router.replace("/parent/login");
      return;
    }

    if (savedParent) {
      try {
        setParent(JSON.parse(savedParent));
      } catch {
        // ignore invalid local storage
      }
    }

    loadChildren(token);
  }, [router]);

  const clearParentSession = () => {
    localStorage.removeItem("parent_access_token");
    localStorage.removeItem("parent_refresh_token");
    localStorage.removeItem("parent_user");
  };

  const loadChildren = async (token: string) => {
    try {
      setLoadingChildren(true);
      setError("");

      const response = await fetch(
        `${API_BASE}/api/accounts/parent/children/`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.status === 401) {
        clearParentSession();
        router.replace("/parent/login");
        return;
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result?.detail || "Unable to load children."
        );
      }

      const childList = result.children || [];

      setChildren(childList);

      if (childList.length === 1) {
        const childId = String(
          childList[0].student_profile_id
        );

        setSelectedChildId(childId);

        await loadResults(
          token,
          childId
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load children."
      );
    } finally {
      setLoadingChildren(false);
    }
  };

  const loadResults = async (
    token: string,
    childId: string
  ) => {
    try {
      setLoadingResults(true);
      setError("");

      const response = await fetch(
        `${API_BASE}/api/results/parent/student/${childId}/`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.status === 401) {
        clearParentSession();
        router.replace("/parent/login");
        return;
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result?.detail ||
            "Unable to load student results."
        );
      }

      setStudent(result.student || null);
      setExams(result.exams || []);
    } catch (err) {
      setStudent(null);
      setExams([]);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load student results."
      );
    } finally {
      setLoadingResults(false);
    }
  };

  const handleChildChange = async (
    childId: string
  ) => {
    setSelectedChildId(childId);
    setStudent(null);
    setExams([]);
    setError("");

    if (!childId) {
      return;
    }

    const token = localStorage.getItem(
      "parent_access_token"
    );

    if (!token) {
      router.replace("/parent/login");
      return;
    }

    await loadResults(
      token,
      childId
    );
  };

  const selectedChild = children.find(
    (child) => String(child.student_profile_id) === selectedChildId
  );
  const featureRestricted = isParentClassFeatureRestricted(error);

  return (
    <div className="student-dashboard">
      <ParentSidebar />

      <main className="student-dashboard-main">

        <ParentTopbar
          name={
            parent.name ||
            parent.username ||
            "Parent"
          }
          organization={parent.organization || ""}
        />

        <div className="student-dashboard-content">
          <div className="container-fluid">

            <div className="mb-4">
              <h2 className="fw-bold mb-1">
                Results
              </h2>

              <p className="text-muted mb-0">
                View your child's published examination results.
              </p>
            </div>

            {error && !featureRestricted && (
              <div className="alert alert-danger">
                {error}
              </div>
            )}

            <div className="card border-0 shadow-sm mb-4">
              <div className="card-body p-4">

                <div className="row align-items-end">

                  <div className="col-md-6">
                    <label className="form-label">
                      Select Child
                    </label>

                    <select
                      className="form-select"
                      value={selectedChildId}
                      disabled={loadingChildren}
                      onChange={(e) =>
                        handleChildChange(
                          e.target.value
                        )
                      }
                    >
                      <option value="">
                        {loadingChildren
                          ? "Loading children..."
                          : "Select child"}
                      </option>

                      {children.map((child) => (
                        <option
                          key={child.student_profile_id}
                          value={child.student_profile_id}
                        >
                          {child.name} -{" "}
                          {child.classroom_name}{" "}
                          {child.section_name}
                        </option>
                      ))}
                    </select>
                  </div>

                </div>
              </div>
            </div>

            {featureRestricted && (
              <ParentFeatureRestricted
                featureName="Results"
                childName={selectedChild?.name}
              />
            )}

            {featureRestricted ? null : loadingResults ? (
              <div className="card border-0 shadow-sm">
                <div className="card-body py-5 text-center text-muted">
                  Loading results...
                </div>
              </div>
            ) : selectedChildId && student ? (
              <>
                <div className="card border-0 shadow-sm mb-4">
                  <div className="card-body p-4">

                    <div className="row g-3">

                      <div className="col-md-3">
                        <div className="text-muted small">
                          Student
                        </div>

                        <div className="fw-bold">
                          {student.name}
                        </div>
                      </div>

                      <div className="col-md-3">
                        <div className="text-muted small">
                          Roll Number
                        </div>

                        <div className="fw-bold">
                          {student.roll_number || "-"}
                        </div>
                      </div>

                      <div className="col-md-3">
                        <div className="text-muted small">
                          Class
                        </div>

                        <div className="fw-bold">
                          {student.classroom_name}
                        </div>
                      </div>

                      <div className="col-md-3">
                        <div className="text-muted small">
                          Section
                        </div>

                        <div className="fw-bold">
                          {student.section_name}
                        </div>
                      </div>

                    </div>

                  </div>
                </div>

                {exams.length === 0 ? (
                  <div className="card border-0 shadow-sm">
                    <div className="card-body py-5 text-center">

                      <h5 className="fw-bold">
                        No Published Results
                      </h5>

                      <p className="text-muted mb-0">
                        Published examination results will appear here.
                      </p>

                    </div>
                  </div>
                ) : (
                  exams.map((exam) => (
                    <div
                      key={exam.id}
                      className="card border-0 shadow-sm mb-4"
                    >
                      <div className="card-body p-4">

                        <div className="d-flex justify-content-between align-items-start flex-wrap gap-3 mb-4">

                          <div>
                            <h4 className="fw-bold mb-1">
                              {exam.name}
                            </h4>

                            <div className="text-muted small">
                              Exam Date: {exam.exam_date}
                            </div>
                          </div>

                          <div className="text-end">
                            <div className="fw-bold fs-3">
                              {exam.percentage}%
                            </div>

                            <small className="text-muted">
                              Overall Percentage
                            </small>
                          </div>

                        </div>

                        <div className="table-responsive">
                          <table className="table align-middle">

                            <thead>
                              <tr>
                                <th>Subject</th>
                                <th>Marks</th>
                                <th>Maximum</th>
                                <th>Percentage</th>
                                <th>Teacher</th>
                                <th>Remarks</th>
                              </tr>
                            </thead>

                            <tbody>

                              {exam.subjects.map(
                                (subject) => (
                                  <tr
                                    key={
                                      subject.subject_id
                                    }
                                  >
                                    <td className="fw-semibold">
                                      {
                                        subject.subject_name
                                      }
                                    </td>

                                    <td>
                                      {
                                        subject.marks_obtained
                                      }
                                    </td>

                                    <td>
                                      {
                                        subject.maximum_marks
                                      }
                                    </td>

                                    <td>
                                      {
                                        subject.percentage
                                      }
                                      %
                                    </td>

                                    <td>
                                      {
                                        subject.teacher_name
                                      }
                                    </td>

                                    <td>
                                      {subject.remarks ||
                                        "-"}
                                    </td>
                                  </tr>
                                )
                              )}

                            </tbody>

                          </table>
                        </div>

                        <div className="border-top pt-3 mt-3">

                          <div className="row">

                            <div className="col-md-4">
                              <strong>
                                Total Marks:
                              </strong>{" "}
                              {exam.total_obtained} /{" "}
                              {exam.total_maximum}
                            </div>

                            <div className="col-md-4">
                              <strong>
                                Percentage:
                              </strong>{" "}
                              {exam.percentage}%
                            </div>

                            <div className="col-md-4">
                              <strong>
                                Status:
                              </strong>{" "}

                              <span className="badge bg-success">
                                Published
                              </span>
                            </div>

                          </div>

                        </div>

                      </div>
                    </div>
                  ))
                )}
              </>
            ) : !loadingChildren &&
              children.length === 0 ? (
              <div className="card border-0 shadow-sm">
                <div className="card-body py-5 text-center">

                  <h5 className="fw-bold">
                    No Linked Students
                  </h5>

                  <p className="text-muted mb-0">
                    No student is currently linked to this parent account.
                  </p>

                </div>
              </div>
            ) : (
              <div className="card border-0 shadow-sm">
                <div className="card-body py-5 text-center text-muted">
                  Select a child to view results.
                </div>
              </div>
            )}

          </div>
        </div>

      </main>
    </div>
  );
}