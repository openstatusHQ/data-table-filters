import { Suspense } from "react";
import { BuilderClient } from "./builder-client";

export default function BuilderPage() {
  return (
    <Suspense>
      <BuilderClient />
    </Suspense>
  );
}
