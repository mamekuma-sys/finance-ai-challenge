import { readFileSync } from "node:fs";
import path from "node:path";

import { Rule0Desk } from "@/components/rule0-desk";

interface VerificationArtifact {
  verified_combinations: number;
}

const TEMPLATE_REFERENCE_DATE = "2026-07-25";

function verificationArtifact(): VerificationArtifact {
  const artifactPath = path.join(
    process.cwd(),
    "public",
    "generated",
    "decision-verification.json",
  );
  return JSON.parse(
    readFileSync(artifactPath, "utf8"),
  ) as VerificationArtifact;
}

export default function Home() {
  const artifact = verificationArtifact();
  return (
    <Rule0Desk
      verifiedCombinations={artifact.verified_combinations}
      templateReferenceDate={TEMPLATE_REFERENCE_DATE}
    />
  );
}
