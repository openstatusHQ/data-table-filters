// TODO: use nuqs to get data

const VERCEL_EDGE_PING_URL = "https://light.openstatus.dev";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const pageSize = searchParams.get("pageSize") ?? "100";
  const pageIndex = searchParams.get("pageIndex") ?? "0";
  const res = await fetch(
    `${VERCEL_EDGE_PING_URL}/api/get?pageSize=${pageSize}&pageIndex=${pageIndex}`,
  );
  const data = await res.json();
  console.log(data.length);
  return Response.json(data);
}
