// src/app/api/upload/route.ts
import { NextResponse } from "next/server";

// 修正：使用正確的 Testnet Publisher URL
const WALRUS_PUBLISHER = "https://publisher.walrus-testnet.walrus.space";

export async function PUT(request: Request) {
  try {
    const body = request.body;
    
    if (!body) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // 🔴 關鍵修正：
    // 舊版 (Devnet): /v1/store
    // 新版 (Testnet): /v1/blobs
    const response = await fetch(`${WALRUS_PUBLISHER}/v1/blobs?epochs=5`, {
      method: "PUT",
      body: body,
      duplex: "half", // Node.js fetch 需要這個
    } as any);

    if (!response.ok) {
      const errorText = await response.text();
      // 這裡會印出更詳細的錯誤，方便 Debug
      throw new Error(`Walrus HTTP Error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error("Upload Error:", error);
    return NextResponse.json(
      { error: (error as Error).message }, 
      { status: 500 }
    );
  }
}