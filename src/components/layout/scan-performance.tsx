// "use client";

// import { scan } from "react-scan";
// import { useLocalStorage } from "@/hooks/use-local-storage";
// import { useEffect } from "react";

// export function ScanPerformance() {
//   const [scanEnabled] = useLocalStorage("scan-performance", false);

//   useEffect(() => {
//     if (typeof window !== "undefined" && scanEnabled) {
//       scan({
//         enabled: true,
//         animationSpeed: "slow",
//       });
//     }
//   }, [scanEnabled]);

//   return null;
// }

"use client";

import { scan } from "react-scan"; // import this BEFORE react
import { useEffect } from "react";
import { useLocalStorage } from "@/hooks/use-local-storage";

const isDev = process.env.NODE_ENV === "development";

export function ScanPerformance() {
  const [showToolbar] = useLocalStorage("scan-performance", false);

  useEffect(() => {
    if (typeof window !== "undefined" && !isDev) {
      scan({
        enabled: true,
        log: true, // logs render info to console (default: false)
        showToolbar,
      });
    }
  }, [showToolbar]);

  if (!isDev) return null;

  // TODO: for some reasons, npm package doesn't highlight the render components
  // as quick fix for local dev, we use the script tag
  return (
    <head>
      <script src="https://unpkg.com/react-scan/dist/auto.global.js" async />
    </head>
  );
}
