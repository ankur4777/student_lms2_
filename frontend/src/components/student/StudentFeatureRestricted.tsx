"use client";

import Link from "next/link";

export const CLASS_FEATURE_RESTRICTED_MESSAGE =
  "This feature has been restricted for your class.";

export function isClassFeatureRestricted(message: string) {
  return message === CLASS_FEATURE_RESTRICTED_MESSAGE;
}

type Props = {
  featureName?: string;
};

export default function StudentFeatureRestricted({
  featureName = "This feature",
}: Props) {
  return (
    <div className="card border-0 shadow-sm">
      <div className="card-body py-5 px-4 text-center">
        <div
          className="d-inline-flex align-items-center justify-content-center rounded-circle bg-danger-subtle text-danger mb-3"
          style={{ width: 56, height: 56, fontSize: 26 }}
          aria-hidden="true"
        >
          !
        </div>

        <h3 className="fw-bold mb-2">Access Restricted</h3>

        <p className="text-muted mb-2">
          {featureName} has been restricted for your class.
        </p>

        <p className="text-muted small mb-4">
          Please contact your college administrator if you think you should
          have access.
        </p>

        <Link href="/student/dashboard" className="btn btn-primary">
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
