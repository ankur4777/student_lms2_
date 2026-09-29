"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import StudentSidebar from "@/components/student/studentsidebar";
import StudentTopbar from "@/components/student/studentTopbar";
import StudentFeatureRestricted, { isClassFeatureRestricted } from "@/components/student/StudentFeatureRestricted";

import "../dashboard/dashboard.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

interface StudentInfo {
  id: number;
  name: string;
  username: string;
  roll_number: string;
  section_name: string;
  classroom_name: string;
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
  section_name: string;
  classroom_name: string;
  subjects: SubjectResult[];
  total_obtained: number;
  total_maximum: number;
  percentage: number;
}

export default function StudentResultsPage() {
  const router = useRouter();

  const [student, setStudent] =
    useState<StudentInfo | null>(null);

  const [exams, setExams] =
    useState<ExamResult[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    const token =
      localStorage.getItem("student_access_token");

    if (!token) {
      router.replace("/student/login");
      return;
    }

    loadResults(token);
  }, [router]);

  const clearStudentSession = () => {
    localStorage.removeItem(
      "student_access_token"
    );

    localStorage.removeItem(
      "student_refresh_token"
    );

    localStorage.removeItem(
      "student_user"
    );
  };

  const loadResults = async (
    token: string
  ) => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `${API_BASE}/api/results/student/`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.status === 401) {
        clearStudentSession();
        router.replace("/student/login");
        return;
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result?.detail ||
            "Unable to load results."
        );
      }

      setStudent(result.student || null);
      setExams(result.exams || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load results."
      );
    } finally {
      setLoading(false);
    }
  };

  const featureRestricted = isClassFeatureRestricted(error);

  return (
    <div className="student-dashboard">
      <StudentSidebar />

      <main className="student-dashboard-main">
        <StudentTopbar
          name={
            student?.name ||
            student?.username ||
            "Student"
          }
        />

        <div className="student-dashboard-content">
          <div className="container-fluid">

            {featureRestricted ? (
              <StudentFeatureRestricted featureName="Results" />
            ) : (
              <>
                <div className="mb-4">
                  <h2 className="fw-bold mb-1">
                    Results
                  </h2>

                  <p className="text-muted mb-0">
                    View your published examination
                    results.
                  </p>
                </div>

                {error && (
                  <div className="alert alert-danger">
                    {error}
                  </div>
                )}

                {loading ? (
              <div className="card border-0 shadow-sm">
                <div className="card-body py-5 text-center text-muted">
                  Loading results...
                </div>
              </div>
            ) : exams.length === 0 ? (
              <div className="card border-0 shadow-sm">
                <div className="card-body py-5 text-center">
                  <h5 className="fw-bold">
                    No Published Results
                  </h5>

                  <p className="text-muted mb-0">
                    Your published exam results
                    will appear here.
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

                        <div className="text-muted">
                          {exam.classroom_name} -{" "}
                          {exam.section_name}
                        </div>

                        <div className="text-muted small">
                          Exam Date:{" "}
                          {exam.exam_date}
                        </div>
                      </div>

                      <div className="text-end">
                        <div className="fw-bold fs-4">
                          {exam.percentage}%
                        </div>

                        <div className="text-muted small">
                          Overall Percentage
                        </div>
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
                          <strong>Status:</strong>{" "}
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
            )}

          </div>
        </div>
      </main>
    </div>
  );
}