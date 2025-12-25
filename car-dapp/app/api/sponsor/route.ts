import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    // 1. 接收前端資料
    const body = await req.json();
    const { transactionBlockKindBytes, sender } = body;
    const accessKey = process.env.SHINAMI_ACCESS_KEY;

    // 2. 檢查參數
    if (!accessKey) {
        console.error("❌ 缺 SHINAMI_ACCESS_KEY");
        return NextResponse.json({ error: "Server Config Error" }, { status: 500 });
    }
    if (!transactionBlockKindBytes || !sender) {
        console.error("❌ 缺參數:", { hasBytes: !!transactionBlockKindBytes, sender });
        return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    // 3. 建構 Shinami RPC 請求 (不透過 SDK，直接打 API)
    // 這是 Shinami 的標準節點 URL 格式
    const rpcUrl = `https://api.shinami.com/gas/v1/${accessKey}`;
    
    const payload = {
        jsonrpc: "2.0",
        id: Date.now(),
        method: "gas_sponsorTransactionBlock", // 標準 RPC 方法名
        params: [
            transactionBlockKindBytes, // 1. 交易 Bytes (Base64)
            sender,                    // 2. 使用者地址
            10000000                   // 3. Gas 預算 (10M MIST = 0.01 SUI)
        ]
    };

    console.log("🔹 [Backend] 發送 RPC 給 Shinami...");
    // console.log("   Payload:", JSON.stringify(payload)); // 想看詳細可以解開

    const res = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });

    const data = await res.json();

    // 4. 處理 Shinami 回傳錯誤
    if (data.error) {
        console.error("❌ Shinami RPC Error:", data.error);
        return NextResponse.json({ 
            error: `Shinami Error: ${data.error.message} (Code: ${data.error.code})` 
        }, { status: 400 });
    }

    // 5. 成功，回傳結果
    const result = data.result;
    console.log("✅ Shinami 贊助成功! Digest:", result.txDigest);

    return NextResponse.json({
        bytes: result.txBytes,
        digest: result.txDigest,
        signature: result.signature
    });

  } catch (error: any) {
    console.error("❌ Server Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}