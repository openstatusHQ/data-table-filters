import { data } from "@/app/default/data";
import { NextResponse } from "next/server";

export async function GET() {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 100));

  return NextResponse.json({
    data,
    total: data.length,
  });
}
