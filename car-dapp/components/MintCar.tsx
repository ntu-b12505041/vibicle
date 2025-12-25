"use client";

import { useState, useEffect } from "react";
import { useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { EnokiClient } from "@mysten/enoki";
import { Transaction } from "@mysten/sui/transactions";
import { fromB64, toB64 } from "@mysten/sui/utils";
import { SuiClient } from "@mysten/sui/client";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { getZkLoginSignature, computeZkLoginAddressFromSeed } from "@mysten/sui/zklogin";
import { PACKAGE_ID, MODULE_NAME, CAR_REGISTRY_ID } from "../constants";
import { useUserAuth } from "../hooks/useUserAuth";

const WALRUS_PUBLISHER = "/api/upload";
const WALRUS_AGGREGATOR = "https://aggregator.walrus-testnet.walrus.space/v1/blobs";
const SUI_RPC_URL = "https://fullnode.testnet.sui.io:443";

function generateRandomVIN(): string {
    const chars = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < 17; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    return result;
}

function getIssFromJwt(jwt: string): string {
    try {
        const payload = JSON.parse(atob(jwt.split('.')[1]));
        return payload.iss;
    } catch (e) { return ""; }
}

export function MintCar() {
  const { user } = useUserAuth();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  
  // 表單狀態
  const [vin, setVin] = useState("");
  const [brand, setBrand] = useState("Toyota");
  const [model, setModel] = useState("Camry");
  const [year, setYear] = useState("2023");
  const [mileage, setMileage] = useState("10000");
  const [file, setFile] = useState<File | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    setVin(generateRandomVIN());
  }, []);

  const uploadToWalrus = async (file: File) => {
    setStatus("正在上傳圖片至 Walrus...");
    const response = await fetch(WALRUS_PUBLISHER, { method: "PUT", body: file });
    if (!response.ok) throw new Error("上傳失敗");
    const data = await response.json();
    return data.newlyCreated?.blobObject.blobId || data.alreadyCertified?.blobId;
  };

  const handleMint = async () => {
    if (!user) return alert("請先登入");
    if (!file) return alert("請選擇一張車輛照片");
    if (vin.length !== 17) return alert("VIN 必須是 17 碼");
    
    setLoading(true);

    try {
      // 1. 上傳圖片
      const blobId = await uploadToWalrus(file);
      const imageUrl = `${WALRUS_AGGREGATOR}/${blobId}`;
      console.log("圖片網址:", imageUrl);

      setStatus("資料上鏈準備中...");

      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE_NAME}::mint_car`,
        arguments: [
          tx.object(CAR_REGISTRY_ID),
          tx.pure.string(vin),
          tx.pure.string(brand),  // 使用輸入值
          tx.pure.string(model),  // 使用輸入值
          tx.pure.u16(Number(year)),     // 轉型
          tx.pure.string(imageUrl),
          tx.pure.u64(Number(mileage)),  // 轉型
        ],
      });

      // === 以下核心邏輯完全保留不變 ===
      if (user.type === "zklogin") {
        console.log("啟動 Shinami 贊助流程 (Google)...");
        
        const session = (user as any).session;
        if (!session || !session.ephemeralKeyPair) throw new Error("Session 資料不完整");

        const keypairBytes = fromB64(session.ephemeralKeyPair);
        const ephemeralKeyPair = Ed25519Keypair.fromSecretKey(keypairBytes);
        const pubKey = ephemeralKeyPair.getPublicKey();

        // ZKP
        setStatus("正在生成 ZK Proof...");
        const zkpResponse = await fetch("/api/zkp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                jwt: session.jwt,
                ephemeralPublicKey: pubKey.toBase64(),
                maxEpoch: session.maxEpoch,
                randomness: session.randomness,
                network: "testnet"
            })
        });

        if (!zkpResponse.ok) {
            const err = await zkpResponse.json();
            throw new Error(`ZK Proof 生成失敗: ${err.details || err.error}`);
        }
        const zkp = await zkpResponse.json();

        // 鎖定真實地址
        const trueAddress = computeZkLoginAddressFromSeed(BigInt(zkp.addressSeed), getIssFromJwt(session.jwt));
        tx.setSender(trueAddress);

        // Shinami Sponsor
        const suiClient = new SuiClient({ url: SUI_RPC_URL });
        const txBytes = await tx.build({ client: suiClient, onlyTransactionKind: true });

        setStatus("正在請求 Shinami 贊助 Gas...");
        const sponsorRes = await fetch("/api/sponsor", {
            method: "POST",
            body: JSON.stringify({
                transactionBlockKindBytes: toB64(txBytes),
                sender: trueAddress
            })
        });

        if (!sponsorRes.ok) throw new Error("Shinami 贊助失敗");
        const sponsoredData = await sponsorRes.json();
        
        // Sign & Execute
        setStatus("正在簽署並上鏈...");
        const sponsoredTx = Transaction.from(fromB64(sponsoredData.bytes));
        const { signature: userSignature } = await sponsoredTx.sign({
            client: suiClient,
            signer: ephemeralKeyPair
        });

        const zkSignature = getZkLoginSignature({
            inputs: { ...zkp, addressSeed: zkp.addressSeed },
            maxEpoch: session.maxEpoch,
            userSignature,
        });

        const res = await suiClient.executeTransactionBlock({
            transactionBlock: sponsoredData.bytes,
            signature: [zkSignature, sponsoredData.signature],
            options: { showEffects: true }
        });

        if (res.effects?.status.status === "failure") {
            const errorMsg = res.effects.status.error || "未知錯誤";
            if (errorMsg.includes("code: 4")) throw new Error("鑄造失敗：VIN 重複");
            throw new Error("鏈上執行失敗: " + errorMsg);
        }

        // 修正地址
        if (trueAddress !== user.address) {
            const newSession = { ...session, address: trueAddress };
            window.localStorage.setItem("demo_zk_session", JSON.stringify(newSession));
        }

        alert(`🎉 Shinami 贊助成功 (免 Gas)!\nDigest: ${res.digest}`);
        window.location.reload();

      } else {
        // === 傳統錢包流程 ===
        console.log("啟動錢包簽名流程...");
        tx.setSender(user.address);
        
        signAndExecute(
            { 
                transaction: tx,
                // 🔴 修正：options 必須放在第一個參數物件內
                options: {
                    showEffects: true,
                    showObjectChanges: true
                }
            }, 
            {
                onSuccess: (res) => { 
                    console.log("錢包回傳:", res);
                    // 🔴 安全讀取 status
                    const status = res.effects?.status?.status;
                    
                    if (status === "success") {
                        alert(`鑄造成功!\nDigest: ${res.digest}`); 
                        window.location.reload();
                    } else if (status === "failure") {
                        const err = res.effects?.status?.error || "Unknown";
                        if (err.includes("code: 4")) alert("鑄造失敗：VIN 重複");
                        else alert("鑄造失敗：" + err);
                    } else {
                        alert(`交易已送出!\nDigest: ${res.digest}`);
                        window.location.reload();
                    }
                },
                onError: (e) => alert("錢包交易失敗: " + e.message)
            }
        );
      }

    } catch (e) {
      console.error(e);
      alert("錯誤: " + (e as Error).message);
    } finally {
      setLoading(false);
      setStatus("");
      setVin(generateRandomVIN()); // 重置 VIN
    }
  };

  if (!user) return null;

  return (
    <div className="bg-white p-6 rounded-xl shadow-md border mt-8">
      <h2 className="text-xl font-bold mb-4 text-gray-800">鑄造新車 NFT</h2>
      
      <div className="flex flex-col gap-4">
        {/* Row 1: VIN & Generate Button */}
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">VIN (車身號碼)</label>
            <div className="flex gap-2">
                <input 
                    type="text" 
                    value={vin} 
                    onChange={(e) => setVin(e.target.value)} 
                    className="flex-1 px-4 py-2 border rounded-lg font-mono text-gray-800 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition" 
                    placeholder="請輸入 17 碼 VIN" 
                />
                <button 
                    onClick={() => setVin(generateRandomVIN())}
                    className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200 transition flex items-center gap-1"
                    title="重新生成隨機 VIN"
                >
                    🎲 隨機
                </button>
            </div>
        </div>

        {/* Row 2: Brand & Model */}
        <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">品牌 (Brand)</label>
                <input 
                    type="text" 
                    value={brand} 
                    onChange={(e) => setBrand(e.target.value)} 
                    className="w-full px-4 py-2 border rounded-lg text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">型號 (Model)</label>
                <input 
                    type="text" 
                    value={model} 
                    onChange={(e) => setModel(e.target.value)} 
                    className="w-full px-4 py-2 border rounded-lg text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition"
                />
            </div>
        </div>

        {/* Row 3: Year & Mileage */}
        <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">年份 (Year)</label>
                <input 
                    type="number" 
                    value={year} 
                    onChange={(e) => setYear(e.target.value)} 
                    className="w-full px-4 py-2 border rounded-lg text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">里程 (Mileage)</label>
                <input 
                    type="number" 
                    value={mileage} 
                    onChange={(e) => setMileage(e.target.value)} 
                    className="w-full px-4 py-2 border rounded-lg text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition"
                />
            </div>
        </div>

        {/* Row 4: File Upload (Revised UI) */}
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">車輛照片</label>
            <div className="flex items-center justify-center w-full">
                <label className={`
                    flex flex-col items-center justify-center w-full h-32 
                    border-2 border-dashed rounded-lg cursor-pointer transition
                    ${file ? "border-green-500 bg-green-50" : "border-gray-300 bg-gray-50 hover:bg-gray-100"}
                `}>
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        {file ? (
                            <>
                                <svg className="w-8 h-8 mb-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                <p className="text-sm text-green-700 font-semibold">{file.name}</p>
                                <p className="text-xs text-green-600">點擊更換照片</p>
                            </>
                        ) : (
                            <>
                                <svg className="w-8 h-8 mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                                <p className="mb-2 text-sm text-gray-500"><span className="font-semibold">點擊上傳</span></p>
                                <p className="text-xs text-gray-500">JPG, PNG (MAX. 2MB)</p>
                            </>
                        )}
                    </div>
                    <input type="file" className="hidden" onChange={(e) => e.target.files && setFile(e.target.files[0])} />
                </label>
            </div>
        </div>

        {/* Status & Submit */}
        {status && <p className="text-sm text-blue-600 animate-pulse text-center">{status}</p>}
        
        <button 
            onClick={handleMint} 
            disabled={loading} 
            className={`
                w-full py-3 px-4 rounded-lg font-bold text-white transition shadow-lg
                ${loading 
                    ? "bg-gray-400 cursor-not-allowed" 
                    : user.type === "zklogin" 
                        ? "bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                        : "bg-blue-600 hover:bg-blue-700"
                }
            `}
        >
          {loading ? "處理中..." : user.type === "zklogin" ? "✨ 免 Gas 鑄造 NFT" : "鑄造 NFT"}
        </button>
      </div>
    </div>
  );
}