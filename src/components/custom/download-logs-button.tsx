"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function DownloadLogsButton() {
  const [isLoading, setIsLoading] = useState(false);

  const handleDownload = async () => {
    try {
      setIsLoading(true);

      // Make request to download endpoint
      const response = await fetch("/api/download");

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to download logs");
      }

      // Get the filename from the Content-Disposition header
      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = "access-logs.json";

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1];
        }
      }

      // Convert response to blob
      const blob = await response.blob();

      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();

      // Clean up
      URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("Logs downloaded successfully");
    } catch (error) {
      console.error("Error downloading logs:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to download logs"
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className="w-9 px-0"
      onClick={handleDownload}
      disabled={isLoading}
    >
      {isLoading ? "Downloading..." : <Download className="mr-2 h-4 w-4" />}
    </Button>
  );
}
