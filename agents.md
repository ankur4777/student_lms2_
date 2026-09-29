# AGENTS.md — Student LMS

## 1. Primary Instruction

Use the minimum context and tokens required to complete each task correctly.

### Token-Saving Rules

- Never scan the entire repository unless explicitly requested.
- Start with only the files directly related to the task.
- Search for exact class, function, route, model, component, or endpoint names before opening large files.
- Read only relevant sections of large files where possible.
- Do not inspect unrelated apps or folders.
- Prefer small patches over rewriting complete files.
- Do not repeat code already present in the repository.
- Do not provide long explanations unless requested.
- Do not propose alternative architectures unless requested.
- Stop immediately after the requested task is completed and validated.
- Do not proactively fix unrelated issues.
- Do not generate documentation unless requested.

Example:

If the task concerns Parent Assignments, inspect likely files such as:

- `assignments/views.py`
- `assignments/urls.py`
- `frontend/src/app/parent/assignments/page.tsx`

Do not inspect attendance, live classes, results, or unrelated modules unless a real dependency requires it.

---

## 2. Project Stack

Project: Student LMS

Backend:
- Django
- Django REST Framework
- MySQL

Frontend:
- Next.js
- TypeScript
- App Router
- Bootstrap
- Custom CSS

Do NOT add:
- Tailwind
- another frontend framework
- another backend framework
- unnecessary dependencies

Reuse existing project patterns.

---

## 3. Architecture

This is a multi-college / multi-tenant LMS.

Roles:

- `platform_admin`
- `college_admin`
- `teacher`
- `student`
- `parent`

All college-owned data must remain isolated by organization.

Never depend only on frontend filtering for tenant isolation.

Backend APIs must validate:

1. Authentication
2. Role
3. User profile
4. Organization
5. Required relationship/ownership

Never expose records based only on a numeric ID.

---

## 4. Existing Apps and Models

Before creating anything new, check whether the required functionality already exists.

### institutions

- `Organization`

### accounts

- `User`
- `TeacherProfile`
- `StudentProfile`
- `ParentProfile`

Custom user model:

`accounts.User`

Important User fields:

- `organization`
- `role`

### academics

- `AcademicSession`
- `ClassRoom`
- `Section`
- `Subject`
- `TeacherAssignment`
- `StudentEnrollment`
- `ParentStudent`

### liveclasses

- `LiveClass`
- `LiveClassRecording`

### attendance

- `AttendanceSession`
- `StudentAttendance`

### assignments

- `Assignment`
- `AssignmentSubmission`

### studentresults

- `Exam`
- `StudentResult`

IMPORTANT:

The Results Django app is:

`studentresults`

Do NOT create or use another Django app named `results`.

---

## 5. Access Relationships

### Teacher

Teacher access normally follows:

`TeacherProfile -> TeacherAssignment -> Subject -> Section`

Teacher APIs must verify that the requested class/section/subject belongs to an active assignment for that teacher.

### Student

Student access normally follows:

`StudentProfile -> StudentEnrollment -> Section`

Student APIs must verify active enrollment and organization.

### Parent

Parent access normally follows:

`ParentProfile -> ParentStudent -> StudentProfile`

A parent may access a student only when a valid `ParentStudent` relationship exists.

Never trust `student_id` from the URL without verifying the logged-in parent is linked to that student.

---

## 6. API Prefixes

Reuse existing prefixes.

Accounts:

`/api/accounts/`

Attendance:

`/api/attendance/`

Assignments:

`/api/assignments/`

Live Classes:

`/api/live-classes/`

Results:

`/api/results/`

Before adding an endpoint:

1. Inspect the relevant app's `urls.py`.
2. Check whether the endpoint already exists.
3. Reuse the existing prefix.
4. Avoid duplicate/conflicting routes.

---

## 7. Frontend Structure

Frontend root:

`frontend/src/`

App Router:

`frontend/src/app/`

Components:

`frontend/src/components/`

Role areas:

- `app/student/`
- `app/teacher/`
- `app/parent/`

Components:

- `components/student/`
- `components/teacher/`
- `components/parent/`

Reuse existing layouts, components, Bootstrap classes, and dashboard CSS.

Do not create a new design system for new pages.

---

## 8. Authentication Storage

Do not rename these keys unless explicitly requested.

### Student

- `student_access_token`
- `student_refresh_token`
- `student_user`

### Teacher

- `teacher_access_token`
- `teacher_refresh_token`
- `teacher_user`

### Parent

- `parent_access_token`
- `parent_refresh_token`
- `parent_user`

Authenticated frontend requests use:

`Authorization: Bearer <token>`

If an authenticated API returns `401`, follow the existing role-specific login/session handling.

---

## 9. Parent Module

Existing Parent routes include:

- `/parent/login`
- `/parent/dashboard`
- `/parent/results`
- `/parent/attendance`
- `/parent/assignments`

Existing components:

- `components/parent/ParentSidebar.tsx`
- `components/parent/ParentTopbar.tsx`

Existing APIs include:

Parent children:

`GET /api/accounts/parent/children/`

Parent results:

`GET /api/results/parent/student/<student_id>/`

Parent attendance:

`GET /api/attendance/parent/student/<student_id>/`

Parent assignments:

`GET /api/assignments/parent/student/<student_id>/`

Do not create duplicate APIs if these already exist.

Current Parent development priority:

`Parent Assignments -> My Children -> Dynamic Parent Dashboard -> Parent Profile -> Parent testing`

---

## 10. Results Rules

Teacher flow:

`Create Exam -> Load Students -> Enter Marks -> Save Marks -> Publish Result`

Student flow:

`Published Results Only`

Parent flow:

`Select Linked Child -> Published Results Only`

Students and parents must NEVER see unpublished exams/results.

`Exam.is_published` controls visibility.

---

## 11. Attendance Rules

Attendance statuses:

- `present`
- `absent`
- `late`
- `excused`

Existing percentage rule:

`attended = present + late`

`counted = present + late + absent`

`percentage = attended / counted * 100`

Excused attendance is excluded from the denominator.

Do not change this calculation unless explicitly requested.

---

## 12. Assignment Rules

Submission statuses include:

- `submitted`
- `late`
- `graded`

For UI purposes, an assignment without a submission can be represented as:

- `pending`

Teacher:
- creates assignments
- views submissions
- grades submissions
- adds feedback

Student:
- views assignments
- submits own assignment
- views marks and feedback

Parent:
- views linked child's assignment progress
- views submission status
- views marks and feedback

Parent must NOT submit or modify assignments on behalf of a student.

---

## 13. Recording Security

Recordings are private.

Students must access recordings through authenticated LMS APIs.

Do not expose private recording files through public media URLs.

Do not replace private storage with public storage unless explicitly requested.

Authorization must verify the student is allowed to access the class recording.

---

## 14. Coding Rules

Make the smallest safe change.

Do not:

- rewrite working files unnecessarily
- rename existing models
- rename routes without instruction
- rename database fields without instruction
- refactor unrelated modules
- add unnecessary abstractions
- add dependencies without need
- change working architecture
- duplicate existing functionality

When editing a file:

1. Find the exact relevant code.
2. Understand the local pattern.
3. Patch only what is necessary.
4. Preserve surrounding style.
5. Validate.
6. Stop.

If duplicate imports are directly encountered while editing the same file, they may be cleaned up.

Do not perform repository-wide cleanup.

---

## 15. Debugging Rules

When an error or traceback is provided, fix that exact error first.

Use the traceback instead of speculating.

Example:

If the traceback says:

`NameError: ParentProfile is not defined`

Check the imports and add/fix `ParentProfile`.

Do not inspect the entire module tree.

If frontend reports:

`Unexpected token '<', "<!DOCTYPE "... is not valid JSON`

first inspect the actual API/network response.

This commonly means Django returned HTML because of:

- 404 route error
- 500 server error
- incorrect endpoint

Do not assume the frontend JSON parser is the root problem.

For `401`:

Check authentication/token handling.

For `403`:

Check role, organization, enrollment, assignment, or parent-child authorization.

For `500`:

Read the Django traceback and fix the exact backend exception.

---

## 16. Database Safety

Never perform destructive database operations without explicit approval.

Do NOT run:

- `flush`
- `reset_db`
- `DROP DATABASE`
- destructive SQL
- migration deletion
- mass data deletion

Do not delete migrations to solve migration problems.

Preserve existing student, teacher, parent, organization, assignment, attendance, and result data.

---

## 17. Validation Rules

For Django view, URL, serializer, or normal backend changes, run:

`python manage.py check`

Do NOT automatically run:

- `makemigrations`
- `migrate`

unless models/schema actually changed.

If models changed, then migrations may be required.

For frontend work:

- use the existing Next.js setup
- do not reinstall packages unnecessarily
- do not change build tooling unless required

Use the smallest useful validation for the task.

---

## 18. File Inspection Strategy

Before opening large files, search for the relevant symbol.

Examples:

- `ParentStudentAssignmentsAPIView`
- `ParentStudentAttendanceAPIView`
- `TeacherSaveExamMarksAPIView`
- `StudentResultsAPIView`
- `ParentProfile`
- specific API route
- specific React component

Prefer:

`search -> inspect relevant section -> patch`

Avoid:

`scan repository -> read many files -> analyze everything -> patch`

If the implementation already exists, modify it instead of creating another implementation.

---

## 19. Multi-Tenant Security Checklist

For APIs involving tenant-owned data, verify as applicable:

- user is authenticated
- user has correct role
- role profile exists
- user has an organization
- requested object belongs to the same organization
- teacher has required assignment
- student has required enrollment
- parent is linked through `ParentStudent`
- unpublished/private data is not exposed

Backend authorization is mandatory even when frontend controls already exist.

---

## 20. Response Style

Keep Codex responses short.

After completing a task, prefer:

Done.

Changed:
- `path/to/file1`
- `path/to/file2`

What changed:
- Short point
- Short point

Validation:
- `python manage.py check` — PASS

Do not paste entire modified files into the response when the changes were already applied directly.

Do not explain basic Django, DRF, Next.js, React, TypeScript, Bootstrap, or MySQL concepts unless requested.

If a task cannot be completed safely because required information is genuinely missing, state exactly what is missing in one short message.

---

## 21. Scope Control

Complete only the requested task.

Do not automatically continue to the next LMS feature.

Do not implement "nice to have" improvements unless explicitly requested.

Do not redesign working UI while fixing backend functionality.

Do not modify backend while fixing a purely visual issue unless required.

Do not modify unrelated files merely for consistency.

If you notice an unrelated issue, leave it unchanged unless it blocks the requested task.

---

## 22. Final Operating Rule

For every task:

1. Identify the smallest relevant scope.
2. Search only relevant symbols/files.
3. Reuse existing architecture.
4. Make the smallest safe patch.
5. Preserve multi-tenant security.
6. Run the smallest relevant validation.
7. Report briefly.
8. Stop.

Optimize for correctness with minimum repository reads, minimum generated text, and minimum unnecessary changes.

