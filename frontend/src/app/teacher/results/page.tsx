"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import TeacherSidebar from "@/components/teacher/TeacherSidebar";
import TeacherTopbar from "@/components/teacher/TeacherTopbar";

import "../dashboard/dashboard.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

interface TeacherUser {
  username?: string;
  name?: string;
  organization?: string;
}

interface SetupAssignment {
  teacher_assignment_id: number;
  subject_id: number;
  subject_name: string;
  section_id: number;
  section_name: string;
  classroom_name: string;
  students: {
    student_profile_id: number;
    username: string;
    name: string;
    roll_number: string;
  }[];
}

interface Exam {
  id: number;
  name: string;
  exam_date: string;
  is_published: boolean;
  section_id: number;
  section_name: string;
  classroom_name: string;
}

interface ResultStudent {
  student_profile_id: number;
  name: string;
  username: string;
  roll_number: string;
  marks_obtained: string | null;
  maximum_marks: string;
  remarks: string;
}

export default function TeacherResultsPage() {
  const router = useRouter();

  const [teacher, setTeacher] = useState<TeacherUser>({});
  const [assignments, setAssignments] = useState<SetupAssignment[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);

  const [selectedAssignmentId, setSelectedAssignmentId] = useState("");
  const [selectedExamId, setSelectedExamId] = useState("");

  const [students, setStudents] = useState<ResultStudent[]>([]);

  const [examName, setExamName] = useState("");
  const [examDate, setExamDate] = useState("");

  const [loading, setLoading] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [creatingExam, setCreatingExam] = useState(false);
  const [savingMarks, setSavingMarks] = useState(false);
  const [publishingExam, setPublishingExam] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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
        // ignore invalid local storage data
      }
    }

    loadInitialData(token);
  }, [router]);

  const clearTeacherSession = () => {
    localStorage.removeItem("teacher_access_token");
    localStorage.removeItem("teacher_refresh_token");
    localStorage.removeItem("teacher_user");
  };

  const loadInitialData = async (token: string) => {
    try {
      setLoading(true);
      setError("");

      const [setupResponse, examsResponse] = await Promise.all([
        fetch(`${API_BASE}/api/results/teacher/setup/`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
        fetch(`${API_BASE}/api/results/teacher/exams/`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
      ]);

      if (
        setupResponse.status === 401 ||
        examsResponse.status === 401
      ) {
        clearTeacherSession();
        router.replace("/teacher/login");
        return;
      }

      const setupResult = await setupResponse.json();
      const examsResult = await examsResponse.json();

      if (!setupResponse.ok) {
        throw new Error(
          setupResult?.detail || "Unable to load classes."
        );
      }

      if (!examsResponse.ok) {
        throw new Error(
          examsResult?.detail || "Unable to load exams."
        );
      }

      setAssignments(setupResult.assignments || []);
      setExams(examsResult.exams || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load results data."
      );
    } finally {
      setLoading(false);
    }
  };

  const selectedAssignment = useMemo(() => {
    return assignments.find(
      (item) =>
        String(item.teacher_assignment_id) ===
        selectedAssignmentId
    );
  }, [assignments, selectedAssignmentId]);

  const availableExams = useMemo(() => {
    if (!selectedAssignment) {
      return [];
    }
    

    return exams.filter(
      (exam) =>
        exam.section_id === selectedAssignment.section_id
    );
  }, [exams, selectedAssignment]);
  const selectedExam = useMemo(() => {
      return exams.find(
        (exam) => String(exam.id) === selectedExamId
      );
    }, [exams, selectedExamId]);

  const handleAssignmentChange = (value: string) => {
    setSelectedAssignmentId(value);
    setSelectedExamId("");
    setStudents([]);
    setMessage("");
    setError("");
  };

  const loadStudents = async () => {
    if (!selectedAssignmentId || !selectedExamId) {
      setError("Please select class/subject and exam.");
      return;
    }

    const token = localStorage.getItem("teacher_access_token");

    if (!token) {
      router.replace("/teacher/login");
      return;
    }

    try {
      setLoadingStudents(true);
      setError("");
      setMessage("");

      const response = await fetch(
        `${API_BASE}/api/results/teacher/exams/${selectedExamId}/students/?teacher_assignment_id=${selectedAssignmentId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.status === 401) {
        clearTeacherSession();
        router.replace("/teacher/login");
        return;
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result?.detail || "Unable to load students."
        );
      }

      setStudents(result.students || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load students."
      );
    } finally {
      setLoadingStudents(false);
    }
  };

  const createExam = async () => {
    if (!selectedAssignmentId) {
      setError("Please select class and subject first.");
      return;
    }

    if (!examName.trim()) {
      setError("Exam name is required.");
      return;
    }

    if (!examDate) {
      setError("Exam date is required.");
      return;
    }

    const token = localStorage.getItem("teacher_access_token");

    if (!token) {
      router.replace("/teacher/login");
      return;
    }

    try {
      setCreatingExam(true);
      setError("");
      setMessage("");

      const response = await fetch(
        `${API_BASE}/api/results/teacher/exams/create/`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            teacher_assignment_id: Number(selectedAssignmentId),
            name: examName.trim(),
            exam_date: examDate,
          }),
        }
      );

      if (response.status === 401) {
        clearTeacherSession();
        router.replace("/teacher/login");
        return;
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result?.detail || "Unable to create exam."
        );
      }

      setMessage("Exam created successfully.");
      setExamName("");
      setExamDate("");

      await loadInitialData(token);

      if (result.exam?.id) {
        setSelectedExamId(String(result.exam.id));
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to create exam."
      );
    } finally {
      setCreatingExam(false);
    }
  };

  const updateStudentField = (
    studentProfileId: number,
    field: "marks_obtained" | "maximum_marks" | "remarks",
    value: string
  ) => {
    setStudents((current) =>
      current.map((student) =>
        student.student_profile_id === studentProfileId
          ? {
            ...student,
            [field]: value,
          }
          : student
      )
    );
  };

  const saveMarks = async () => {
    if (!selectedAssignmentId || !selectedExamId) {
      setError("Please select class/subject and exam.");
      return;
    }

    if (students.length === 0) {
      setError("No students loaded.");
      return;
    }

    for (const student of students) {
      if (
        student.marks_obtained === null ||
        student.marks_obtained === ""
      ) {
        setError(
          `Enter marks for ${student.name}.`
        );
        return;
      }

      const marks = Number(student.marks_obtained);
      const maximumMarks = Number(student.maximum_marks);

      if (
        Number.isNaN(marks) ||
        Number.isNaN(maximumMarks) ||
        marks < 0 ||
        maximumMarks <= 0 ||
        marks > maximumMarks
      ) {
        setError(
          `Invalid marks for ${student.name}.`
        );
        return;
      }
    }

    const token = localStorage.getItem("teacher_access_token");

    if (!token) {
      router.replace("/teacher/login");
      return;
    }

    try {
      setSavingMarks(true);
      setError("");
      setMessage("");

      const response = await fetch(
        `${API_BASE}/api/results/teacher/exams/${selectedExamId}/marks/`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            teacher_assignment_id: Number(selectedAssignmentId),
            results: students.map((student) => ({
              student_profile_id: student.student_profile_id,
              marks_obtained: Number(student.marks_obtained),
              maximum_marks: Number(student.maximum_marks),
              remarks: student.remarks.trim(),
            })),
          }),
        }
      );

      if (response.status === 401) {
        clearTeacherSession();
        router.replace("/teacher/login");
        return;
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result?.detail || "Unable to save marks."
        );
      }

      setMessage("Exam marks saved successfully.");

      await loadStudents();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save marks."
      );
    } finally {
      setSavingMarks(false);
    }
  };
  const updatePublishStatus = async (isPublished: boolean) => {
    if (!selectedExamId) {
      setError("Please select an exam.");
      return;
    }

    const token = localStorage.getItem("teacher_access_token");

    if (!token) {
      router.replace("/teacher/login");
      return;
    }

    try {
      setPublishingExam(true);
      setError("");
      setMessage("");

      const response = await fetch(
        `${API_BASE}/api/results/teacher/exams/${selectedExamId}/publish/`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            is_published: isPublished,
          }),
        }
      );

      if (response.status === 401) {
        clearTeacherSession();
        router.replace("/teacher/login");
        return;
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result?.detail ||
          "Unable to update result status."
        );
      }

      setExams((current) =>
        current.map((exam) =>
          exam.id === Number(selectedExamId)
            ? {
              ...exam,
              is_published: isPublished,
            }
            : exam
        )
      );

      setMessage(
        isPublished
          ? "Result published successfully."
          : "Result unpublished successfully."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update result status."
      );
    } finally {
      setPublishingExam(false);
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
                Results
              </h2>

              <p className="text-muted mb-0">
                Create exams and manage student marks.
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

            {loading ? (
              <div className="card border-0 shadow-sm">
                <div className="card-body py-5 text-center text-muted">
                  Loading results...
                </div>
              </div>
            ) : (
              <>
                <div className="card border-0 shadow-sm mb-4">
                  <div className="card-body p-4">
                    <h5 className="fw-bold mb-4">
                      Select Class & Exam
                    </h5>

                    <div className="row g-3">

                      <div className="col-lg-6">
                        <label className="form-label">
                          Class / Subject
                        </label>

                        <select
                          className="form-select"
                          value={selectedAssignmentId}
                          onChange={(e) =>
                            handleAssignmentChange(
                              e.target.value
                            )
                          }
                        >
                          <option value="">
                            Select class and subject
                          </option>

                          {assignments.map((item) => (
                            <option
                              key={item.teacher_assignment_id}
                              value={item.teacher_assignment_id}
                            >
                              {item.classroom_name} -{" "}
                              {item.section_name} -{" "}
                              {item.subject_name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="col-lg-6">
                        <label className="form-label">
                          Exam
                        </label>

                        <select
                          className="form-select"
                          value={selectedExamId}
                          disabled={!selectedAssignment}
                          onChange={(e) => {
                            setSelectedExamId(e.target.value);
                            setStudents([]);
                          }}
                        >
                          <option value="">
                            Select exam
                          </option>

                          {availableExams.map((exam) => (
                            <option
                              key={exam.id}
                              value={exam.id}
                            >
                              {exam.name} - {exam.exam_date} -{" "}
                              {exam.is_published ? "Published" : "Draft"}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="col-12">
                        <div className="d-flex align-items-center gap-2 flex-wrap">

                          <button
                            type="button"
                            className="btn btn-primary"
                            disabled={
                              !selectedAssignmentId ||
                              !selectedExamId ||
                              loadingStudents
                            }
                            onClick={loadStudents}
                          >
                            {loadingStudents
                              ? "Loading..."
                              : "Load Students"}
                          </button>

                          {selectedExam && (
                            <>
                              <span
                                className={`badge ${selectedExam.is_published
                                    ? "bg-success"
                                    : "bg-secondary"
                                  }`}
                              >
                                {selectedExam.is_published
                                  ? "Published"
                                  : "Draft"}
                              </span>

                              <button
                                type="button"
                                className={
                                  selectedExam.is_published
                                    ? "btn btn-outline-warning"
                                    : "btn btn-success"
                                }
                                disabled={publishingExam}
                                onClick={() =>
                                  updatePublishStatus(
                                    !selectedExam.is_published
                                  )
                                }
                              >
                                {publishingExam
                                  ? "Updating..."
                                  : selectedExam.is_published
                                    ? "Unpublish Result"
                                    : "Publish Result"}
                              </button>
                            </>
                          )}

                        </div>
                      </div>

                    </div>
                  </div>
                </div>

                <div className="card border-0 shadow-sm mb-4">
                  <div className="card-body p-4">
                    <h5 className="fw-bold mb-4">
                      Create Exam
                    </h5>

                    <div className="row g-3">
                      <div className="col-md-5">
                        <label className="form-label">
                          Exam Name
                        </label>

                        <input
                          type="text"
                          className="form-control"
                          value={examName}
                          onChange={(e) =>
                            setExamName(e.target.value)
                          }
                          placeholder="Mid Term Examination"
                        />
                      </div>

                      <div className="col-md-4">
                        <label className="form-label">
                          Exam Date
                        </label>

                        <input
                          type="date"
                          className="form-control"
                          value={examDate}
                          onChange={(e) =>
                            setExamDate(e.target.value)
                          }
                        />
                      </div>

                      <div className="col-md-3 d-flex align-items-end">
                        <button
                          type="button"
                          className="btn btn-outline-primary w-100"
                          disabled={
                            creatingExam ||
                            !selectedAssignmentId
                          }
                          onClick={createExam}
                        >
                          {creatingExam
                            ? "Creating..."
                            : "Create Exam"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {students.length > 0 && (
                  <div className="card border-0 shadow-sm">
                    <div className="card-body p-4">

                      <div className="d-flex justify-content-between align-items-center mb-4">
                        <h5 className="fw-bold mb-0">
                          Enter Marks
                        </h5>

                        <span className="text-muted small">
                          {students.length} students
                        </span>
                      </div>

                      <div className="table-responsive">
                        <table className="table align-middle">
                          <thead>
                            <tr>
                              <th>Roll No.</th>
                              <th>Student</th>
                              <th>Marks</th>
                              <th>Maximum Marks</th>
                              <th>Remarks</th>
                            </tr>
                          </thead>

                          <tbody>
                            {students.map((student) => (
                              <tr key={student.student_profile_id}>
                                <td>
                                  {student.roll_number || "-"}
                                </td>

                                <td>
                                  <div className="fw-semibold">
                                    {student.name}
                                  </div>

                                  <div className="small text-muted">
                                    {student.username}
                                  </div>
                                </td>

                                <td style={{ minWidth: "130px" }}>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    className="form-control"
                                    value={
                                      student.marks_obtained ?? ""
                                    }
                                    onChange={(e) =>
                                      updateStudentField(
                                        student.student_profile_id,
                                        "marks_obtained",
                                        e.target.value
                                      )
                                    }
                                  />
                                </td>

                                <td style={{ minWidth: "150px" }}>
                                  <input
                                    type="number"
                                    min="1"
                                    step="0.01"
                                    className="form-control"
                                    value={student.maximum_marks}
                                    onChange={(e) =>
                                      updateStudentField(
                                        student.student_profile_id,
                                        "maximum_marks",
                                        e.target.value
                                      )
                                    }
                                  />
                                </td>

                                <td style={{ minWidth: "220px" }}>
                                  <input
                                    type="text"
                                    className="form-control"
                                    value={student.remarks}
                                    onChange={(e) =>
                                      updateStudentField(
                                        student.student_profile_id,
                                        "remarks",
                                        e.target.value
                                      )
                                    }
                                    placeholder="Optional remarks"
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={savingMarks}
                        onClick={saveMarks}
                      >
                        {savingMarks
                          ? "Saving..."
                          : "Save Marks"}
                      </button>

                    </div>
                  </div>
                )}

              </>
            )}

          </div>
        </div>
      </main>
    </div>
  );
}