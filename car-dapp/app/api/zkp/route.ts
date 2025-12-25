import { EnokiClient } from "@mysten/enoki";
import { NextResponse } from "next/server";
import { Ed25519PublicKey } from "@mysten/sui/keypairs/ed25519";
import { fromB64 } from "@mysten/sui/utils";

const enoki = new EnokiClient({
  apiKey: process.env.NEXT_PUBLIC_ENOKI_PUBLIC_KEY!,
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { jwt, ephemeralPublicKey, maxEpoch, randomness, network } = body;

    console.log("🔹 [Backend] 收到 ZK Proof 請求");
    console.log("   - Randomness:", randomness); // 確認收到的是長字串

    const publicKeyBytes = fromB64(ephemeralPublicKey);
    const publicKeyObj = new Ed25519PublicKey(publicKeyBytes);

    const zkp = await enoki.createZkLoginZkp({
      jwt,
      ephemeralPublicKey: publicKeyObj,
      maxEpoch: Number(maxEpoch),
      randomness: String(randomness), // 確保傳遞字串
      network: network || "testnet",
    });

    console.log("✅ [Backend] ZK Proof 取得成功");
    return NextResponse.json(zkp);

  } catch (error: any) {
    console.error("❌ [Backend] ZKP Error:", error);
    
    let errorDetails = error.message;
    if (error.response) {
        try {
            const data = await error.response.json();
            errorDetails = JSON.stringify(data);
            console.error("   - Enoki Response:", errorDetails);
        } catch (e) {}
    }

    return NextResponse.json(
      { error: "ZKP Generation Failed", details: errorDetails },
      { status: error.response?.status || 500 }
    );
  }
}