"use client";

import { useEffect, useMemo, useState } from "react";
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

interface Submission {
  id: number;
  status: string;
  submitted_at: string | null;
  marks_obtained: string | null;
  feedback: string;
  graded_at: string | null;
}

interface Assignment {
  id: number;
  title: string;
  instructions: string;
  due_date: string;
  due_time: string | null;
  subject_name: string;
  teacher_name: string;
  classroom_name: string;
  section_name: string;
  submission: Submission | null;
  status: string;
}

interface StudentInfo {
  id: number;
  name: string;
  username: string;
  roll_number: string;
  classroom_name: string;
  section_name: string;
}

type FilterType =
  | "all"
  | "pending"
  | "submitted"
  | "late"
  | "graded";

export default function ParentAssignmentsPage() {
  const router = useRouter();

  const [parent, setParent] = useState<ParentUser>({});
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState("");

  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  const [filter, setFilter] = useState<FilterType>("all");

  const [loadingChildren, setLoadingChildren] = useState(true);
  const [loadingAssignments, setLoadingAssignments] = useState(false);

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
        // ignore invalid storage
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

        await loadAssignments(
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

  const loadAssignments = async (
    token: string,
    childId: string
  ) => {
    try {
      setLoadingAssignments(true);
      setError("");

      const response = await fetch(
        `${API_BASE}/api/assignments/parent/student/${childId}/`,
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
            "Unable to load assignments."
        );
      }

      setStudent(result.student || null);
      setAssignments(result.assignments || []);
    } catch (err) {
      setStudent(null);
      setAssignments([]);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load assignments."
      );
    } finally {
      setLoadingAssignments(false);
    }
  };

  const handleChildChange = async (
    childId: string
  ) => {
    setSelectedChildId(childId);
    setStudent(null);
    setAssignments([]);
    setFilter("all");
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

    await loadAssignments(
      token,
      childId
    );
  };

  const filteredAssignments = useMemo(() => {
    if (filter === "all") {
      return assignments;
    }

    return assignments.filter(
      (assignment) =>
        assignment.status.toLowerCase() === filter
    );
  }, [assignments, filter]);

  const countStatus = (status: FilterType) => {
    if (status === "all") {
      return assignments.length;
    }

    return assignments.filter(
      (assignment) =>
        assignment.status.toLowerCase() === status
    ).length;
  };

  const getStatusClass = (statusValue: string) => {
    const status = statusValue.toLowerCase();

    if (status === "graded") {
      return "bg-success";
    }

    if (status === "submitted") {
      return "bg-primary";
    }

    if (status === "late") {
      return "bg-warning text-dark";
    }

    if (status === "pending") {
      return "bg-secondary";
    }

    return "bg-secondary";
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
                Assignments
              </h2>

              <p className="text-muted mb-0">
                View your child's assignments and submission progress.
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
                        handleChildChange(e.target.value)
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
                featureName="Assignments"
                childName={selectedChild?.name}
              />
            )}

            {featureRestricted ? null : loadingAssignments ? (
              <div className="card border-0 shadow-sm">
                <div className="card-body py-5 text-center text-muted">
                  Loading assignments...
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

                <div className="card border-0 shadow-sm mb-4">
                  <div className="card-body p-4">

                    <div className="d-flex flex-wrap gap-2">

                      {(
                        [
                          "all",
                          "pending",
                          "submitted",
                          "late",
                          "graded",
                        ] as FilterType[]
                      ).map((item) => (
                        <button
                          key={item}
                          type="button"
                          className={
                            filter === item
                              ? "btn btn-primary"
                              : "btn btn-outline-secondary"
                          }
                          onClick={() =>
                            setFilter(item)
                          }
                        >
                          {item.charAt(0).toUpperCase() +
                            item.slice(1)}{" "}
                          ({countStatus(item)})
                        </button>
                      ))}

                    </div>

                  </div>
                </div>

                {filteredAssignments.length === 0 ? (
                  <div className="card border-0 shadow-sm">
                    <div className="card-body py-5 text-center">

                      <h5 className="fw-bold">
                        No Assignments
                      </h5>

                      <p className="text-muted mb-0">
                        No assignments found for this filter.
                      </p>

                    </div>
                  </div>
                ) : (
                  <div className="row g-4">

                    {filteredAssignments.map(
                      (assignment) => (
                        <div
                          key={assignment.id}
                          className="col-12"
                        >
                          <div className="card border-0 shadow-sm">
                            <div className="card-body p-4">

                              <div className="d-flex justify-content-between align-items-start gap-3 flex-wrap mb-3">

                                <div>
                                  <h4 className="fw-bold mb-1">
                                    {assignment.title}
                                  </h4>

                                  <div className="text-muted">
                                    {assignment.classroom_name} -{" "}
                                    {assignment.section_name} •{" "}
                                    {assignment.subject_name}
                                  </div>
                                </div>

                                <span
                                  className={`badge ${getStatusClass(
                                    assignment.status
                                  )}`}
                                >
                                  {assignment.status
                                    .charAt(0)
                                    .toUpperCase() +
                                    assignment.status.slice(1)}
                                </span>

                              </div>

                              <div className="row g-3 mb-3">

                                <div className="col-md-4">
                                  <strong>
                                    Teacher:
                                  </strong>{" "}
                                  {assignment.teacher_name}
                                </div>

                                <div className="col-md-4">
                                  <strong>
                                    Due Date:
                                  </strong>{" "}
                                  {assignment.due_date}
                                </div>

                                <div className="col-md-4">
                                  <strong>
                                    Due Time:
                                  </strong>{" "}
                                  {assignment.due_time || "-"}
                                </div>

                              </div>

                              {assignment.instructions && (
                                <div className="bg-light rounded p-3 mb-3">

                                  <div className="fw-semibold mb-1">
                                    Instructions
                                  </div>

                                  <div className="text-muted">
                                    {assignment.instructions}
                                  </div>

                                </div>
                              )}

                              {assignment.submission ? (
                                <div className="border rounded p-3">

                                  <h6 className="fw-bold mb-3">
                                    Submission Details
                                  </h6>

                                  <div className="row g-3">

                                    <div className="col-md-4">
                                      <div className="text-muted small">
                                        Status
                                      </div>

                                      <div className="fw-semibold">
                                        {
                                          assignment
                                            .submission
                                            .status
                                        }
                                      </div>
                                    </div>

                                    <div className="col-md-4">
                                      <div className="text-muted small">
                                        Submitted At
                                      </div>

                                      <div className="fw-semibold">
                                        {assignment.submission
                                          .submitted_at || "-"}
                                      </div>
                                    </div>

                                    <div className="col-md-4">
                                      <div className="text-muted small">
                                        Marks
                                      </div>

                                      <div className="fw-semibold">
                                        {assignment.submission
                                          .marks_obtained ?? "-"}
                                      </div>
                                    </div>

                                  </div>

                                  {assignment.submission
                                    .feedback && (
                                    <div className="mt-3">

                                      <div className="text-muted small">
                                        Teacher Feedback
                                      </div>

                                      <div className="fw-semibold">
                                        {
                                          assignment
                                            .submission
                                            .feedback
                                        }
                                      </div>

                                    </div>
                                  )}

                                </div>
                              ) : (
                                <div className="text-muted">
                                  This assignment has not been submitted yet.
                                </div>
                              )}

                            </div>
                          </div>
                        </div>
                      )
                    )}

                  </div>
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
                  Select a child to view assignments.
                </div>
              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  );
}