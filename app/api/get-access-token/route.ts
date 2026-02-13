import { NextResponse } from "next/server";

const HEYGEN_API_KEY = "sk_V2_hgu_kEIOxcwcCja_CsIEBH3mKtwuOxn0t8GlfZ2KNGvqC1iu"; 

export async function POST() {
  try {
    if (!HEYGEN_API_KEY) {
      throw new Error("API key is missing from server");
    }

    const res = await fetch(
      "https://api.heygen.com/v1/streaming.create_token",
      {
        method: "POST",
        headers: {
          "x-api-key": HEYGEN_API_KEY,
        },
      }
    );

    const data = await res.json();

    if (!res.ok) {
      console.error("HeyGen API Error:", data);
      return NextResponse.json(
        { error: data.message || "Failed to get token" }, 
        { status: res.status }
      );
    }

    return new NextResponse(data.data.token, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  } catch (error) {
    console.error("Error generating token:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
