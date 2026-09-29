"use client";

import ParentIcon from "@/components/parent/ParentIcon";

export const PARENT_CLASS_FEATURE_RESTRICTED_MESSAGE =
  "This feature has been restricted for parents of this class.";

export function isParentClassFeatureRestricted(message: string) {
  return message === PARENT_CLASS_FEATURE_RESTRICTED_MESSAGE;
}

type Props = {
  featureName: string;
  childName?: string;
};

export default function ParentFeatureRestricted({
  featureName,
  childName,
}: Props) {
  return (
    <div className="card border-0 shadow-sm">
      <div className="card-body py-5 px-4 text-center">
        <div
          className="d-inline-flex align-items-center justify-content-center rounded-circle bg-danger-subtle text-danger mb-3"
          style={{ width: 64, height: 64 }}
          aria-hidden="true"
        >
          <ParentIcon name="children" size={28} />
        </div>

        <div className="text-uppercase text-danger fw-semibold small mb-2">
          Parent Access Restricted
        </div>

        <h3 className="fw-bold mb-2">
          {featureName} is not available
        </h3>

        <p className="text-muted mb-1">
          The college administrator has restricted parent access to{" "}
          {featureName.toLowerCase()}
          {childName ? ` for ${childName}` : " for this class"}.
        </p>

        <p className="text-muted small mb-0">
          You can select another linked child above, or contact the college
          administrator if you believe you should have access.
        </p>
      </div>
    </div>
  );
}
