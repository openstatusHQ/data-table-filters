import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export async function GET(req: NextRequest) {
  try {
    // Get the log file path from environment variable
    const logFilePath = process.env.LOG_FILE_PATH;

    if (!logFilePath) {
      return NextResponse.json(
        { error: "Log file path not configured" },
        { status: 500 }
      );
    }

    // Check if the file exists
    try {
      await fs.access(logFilePath);
    } catch (error) {
      return NextResponse.json(
        { error: "Log file not found" },
        { status: 404 }
      );
    }

    // Read the file
    const fileContent = await fs.readFile(logFilePath, "utf-8");

    // Get the filename from the path
    const fileName = path.basename(logFilePath);

    // Set headers for file download
    const headers = new Headers();
    headers.set("Content-Disposition", `attachment; filename="${fileName}"`);
    headers.set("Content-Type", "application/json");

    // Return the file content
    return new NextResponse(fileContent, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("Error downloading log file:", error);
    return NextResponse.json(
      { error: "Failed to download log file" },
      { status: 500 }
    );
  }
}
