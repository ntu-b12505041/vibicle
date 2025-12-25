import { EnokiClient } from "@mysten/enoki";
import { NextResponse } from "next/server";

const enoki = new EnokiClient({
  apiKey: process.env.ENOKI_SECRET_KEY!,
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { digest, signature } = body;

    console.log("🔹 [Execute] 收到請求");
    console.log("   - Digest:", digest);
    console.log("   - User Signature Length:", signature ? signature.length : "Missing");

    // 呼叫 Enoki 執行
    const result = await enoki.executeSponsoredTransaction({
      digest,
      signature,
    });

    console.log("✅ [Execute] 成功:", result);
    return NextResponse.json(result);

  } catch (error: any) {
    // 🔴 深度錯誤診斷
    console.error("❌ [Execute] 失敗!");
    
    // 嘗試讀取 Enoki SDK 隱藏的錯誤訊息
    if (error.body) {
        console.error("   - Error Body:", JSON.stringify(error.body, null, 2));
    }
    if (error.response) {
        console.error("   - Response Status:", error.response.status);
        try {
            const errorData = await error.response.json();
            console.error("   - Response Data:", JSON.stringify(errorData, null, 2));
        } catch (e) {
            console.error("   - Response Text:", error.response.statusText);
        }
    }
    
    // 印出原始錯誤
    console.error("   - Original Error:", error);

    return NextResponse.json(
      { error: error.message || "Enoki Internal Error", details: error.body || "Check server logs" },
      { status: 500 }
    );
  }
}