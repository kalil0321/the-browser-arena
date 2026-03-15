import { NextResponse } from "next/server";
import { openapiSpec } from "@/lib/api/openapi-spec";

export async function GET() {
    return NextResponse.json(openapiSpec);
}
