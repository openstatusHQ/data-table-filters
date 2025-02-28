export function register() {
  // Check if LOG_FILE_PATH environment variable is set
  if (!process.env.LOG_FILE_PATH) {
    throw new Error("LOG_FILE_PATH environment variable is not set");
  }

  // Import fs to check file existence
  const fs = require("fs");

  // Check if log file exists
  if (!fs.existsSync(process.env.LOG_FILE_PATH)) {
    throw new Error(`Log file not found at path: ${process.env.LOG_FILE_PATH}`);
  }

  console.log(`Using log file ${process.env.LOG_FILE_PATH}`);
}
