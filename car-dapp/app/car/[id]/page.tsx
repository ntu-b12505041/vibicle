"use client";

import { useSuiClient, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { LoginSection } from "../../../components/LoginSection";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { fontBase64 } from "./chineseFont"; // 記得確認你有建立這個檔案
import { Transaction } from "@mysten/sui/transactions";
import { fromB64, toB64 } from "@mysten/sui/utils";
import { EnokiClient } from "@mysten/enoki";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { getZkLoginSignature, computeZkLoginAddressFromSeed } from "@mysten/sui/zklogin";
import { PACKAGE_ID, MODULE_NAME } from "../../../constants";
import { useUserAuth } from "../../../hooks/useUserAuth";
import { SuiClient } from "@mysten/sui/client";

const WALRUS_AGGREGATOR = "https://aggregator.walrus-testnet.walrus.space/v1/blobs";
const SUI_RPC_URL = "https://fullnode.testnet.sui.io:443";

function getImageUrl(rawUrl: any) {
    if (!rawUrl) return null;
    const urlStr = String(rawUrl);
    if (urlStr.startsWith("http")) return urlStr;
    return `${WALRUS_AGGREGATOR}/${urlStr}`;
}

function getIssFromJwt(jwt: string) { try { return JSON.parse(atob(jwt.split('.')[1])).iss; } catch { return ""; } }

type RecordData = {
    id: string;
    type: number;
    provider: string;
    description: string;
    mileage: number;
    timestamp: number;
    attachments: string[];
};

type CommentData = {
    sender: string;
    message: string;
    timestamp: number;
};

export default function CarDetailPage() {
  const params = useParams();
  const carId = params.id as string;
  const suiClient = useSuiClient();
  const { user } = useUserAuth();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();

  const [car, setCar] = useState<any>(null);
  const [records, setRecords] = useState<RecordData[]>([]);
  const [comments, setComments] = useState<CommentData[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [sendingComment, setSendingComment] = useState(false);

  // 1. 讀取資料
  useEffect(() => {
    const fetchData = async () => {
      if (!carId) return;
      try {
        // A. 抓車
        const carObj = await suiClient.getObject({
            id: carId,
            options: { showContent: true, showDisplay: true }
        });

        if (carObj.error || !carObj.data) throw new Error("車輛不存在");

        const fields = (carObj.data?.content as any)?.fields;
        const display = carObj.data?.display?.data;
        let rawImg = display?.image_url || display?.url || fields?.image_url;
        if (typeof rawImg === 'object') rawImg = undefined;

        setCar({
            id: carId,
            vin: fields.vin,
            brand: fields.brand,
            model: fields.model,
            year: fields.year,
            mileage: fields.current_mileage,
            owner: fields.owner,
            imageUrl: getImageUrl(rawImg),
        });

        // B. 抓履歷 (從 Passport)
        const passportId = fields.passport?.fields?.id?.id;
        if (passportId) {
            const dfRes = await suiClient.getDynamicFields({ parentId: passportId });
            const recordIds = dfRes.data.map(df => df.objectId);
            if (recordIds.length > 0) {
                const recordsObjs = await suiClient.multiGetObjects({ ids: recordIds, options: { showContent: true } });
                const parsedRecords = recordsObjs.map((r) => {
                    const rf = (r.data?.content as any)?.fields;
                    if (!rf) return null;
                    return {
                        id: r.data?.objectId,
                        type: Number(rf.record_type),
                        provider: rf.provider,
                        description: rf.description,
                        mileage: Number(rf.mileage),
                        timestamp: Number(rf.timestamp),
                        attachments: (rf.attachments || []).map((a: string) => getImageUrl(a))
                    };
                }).filter(r => r !== null) as RecordData[];
                parsedRecords.sort((a, b) => b.timestamp - a.timestamp);
                setRecords(parsedRecords);
            }
        }

        // C. 抓留言 (從 CarNFT 下的 Dynamic Field)
        // 注意：我們在合約裡是用 df::add(&mut car.id, count, comment)
        // 所以留言是直接掛在 CarNFT 上的
        const carFieldsRes = await suiClient.getDynamicFields({ parentId: carId });
        const commentFieldIds = carFieldsRes.data.map(df => df.objectId);
        
        if (commentFieldIds.length > 0) {
             const fieldObjs = await suiClient.multiGetObjects({ ids: commentFieldIds, options: { showContent: true } });
             const parsedComments = fieldObjs.map(obj => {
                 const content = obj.data?.content as any;
                 // 檢查結構是否為 Comment
                 // 結構通常是 { name: count, value: { sender, message, timestamp } }
                 const value = content?.fields?.value;
                 if (value && value.fields && value.fields.message) {
                     const c = value.fields;
                     return {
                         sender: c.sender,
                         message: c.message,
                         timestamp: Number(c.timestamp)
                     };
                 }
                 return null;
             }).filter(c => c !== null) as CommentData[];
             
             parsedComments.sort((a, b) => b.timestamp - a.timestamp);
             setComments(parsedComments);
        }

      } catch (e) {
        console.error("Fetch details failed:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [carId, suiClient]);

  // 2. 發表留言功能
  const handlePostComment = async () => {
      if (!user) return alert("請先登入");
      if (!newComment.trim()) return;
      
      setSendingComment(true);

      try {
          const tx = new Transaction();
          tx.moveCall({
              target: `${PACKAGE_ID}::${MODULE_NAME}::post_comment`,
              arguments: [
                  tx.object(carId),
                  tx.pure.string(newComment),
                  tx.object("0x6") // Clock
              ]
          });

          // === zkLogin + Shinami 流程 ===
          if (user.type === "zklogin") {
              const session = (user as any).session;
              if (!session) throw new Error("Session Invalid");
              
              const keypairBytes = fromB64(session.ephemeralKeyPair);
              const ephemeralKeyPair = Ed25519Keypair.fromSecretKey(keypairBytes);
              const pubKey = ephemeralKeyPair.getPublicKey();

              // ZKP
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
              const zkp = await zkpResponse.json();
              
              // Address
              const trueAddress = computeZkLoginAddressFromSeed(BigInt(zkp.addressSeed), getIssFromJwt(session.jwt));
              tx.setSender(trueAddress);

              // Sponsor
              const suiClient = new SuiClient({ url: SUI_RPC_URL });
              const txBytes = await tx.build({ client: suiClient, onlyTransactionKind: true });
              const sponsorRes = await fetch("/api/sponsor", {
                  method: "POST",
                  body: JSON.stringify({ transactionBlockKindBytes: toB64(txBytes), sender: trueAddress })
              });
              const sponsoredData = await sponsorRes.json();

              // Sign
              const sponsoredTx = Transaction.from(fromB64(sponsoredData.bytes));
              const { signature: userSignature } = await sponsoredTx.sign({ client: suiClient, signer: ephemeralKeyPair });
              const zkSignature = getZkLoginSignature({
                  inputs: { ...zkp, addressSeed: zkp.addressSeed },
                  maxEpoch: session.maxEpoch,
                  userSignature,
              });

              // Execute
              await suiClient.executeTransactionBlock({
                  transactionBlock: sponsoredData.bytes,
                  signature: [zkSignature, sponsoredData.signature],
                  options: { showEffects: true }
              });
              
              alert("留言成功！");
              setNewComment("");
              window.location.reload();

          } else {
              // Wallet
              tx.setSender(user.address);
              signAndExecute({ transaction: tx }, {
                onSuccess: () => { alert("留言成功！"); setNewComment(""); window.location.reload(); },
                onError: (e) => alert("失敗: " + e.message)
              });
          }

      } catch (e) {
          console.error(e);
          alert("留言失敗: " + (e as Error).message);
      } finally {
          setSendingComment(false);
      }
  };

  // 3. 匯出 PDF
  const handleExportPDF = () => {
      if (!car) return;
      const doc = new jsPDF();
      
      // 註冊中文字體
      const fontFileName = "NotoSansTC-Regular.ttf";
      doc.addFileToVFS(fontFileName, fontBase64);
      doc.addFont(fontFileName, "NotoSansTC", "normal");
      doc.setFont("NotoSansTC");

      doc.setFontSize(20);
      doc.text("Vibicle - 車輛履歷報告", 14, 22);

      doc.setFontSize(12);
      doc.text(`品牌/型號: ${car.brand} ${car.model}`, 14, 40);
      doc.text(`年份: ${car.year}`, 14, 48);
      doc.text(`車身號碼 (VIN): ${car.vin}`, 14, 56);
      doc.text(`當前里程: ${Number(car.mileage).toLocaleString()} km`, 14, 64);
      doc.text(`車主地址: ${car.owner}`, 14, 72);
      doc.text(`報告產出日期: ${new Date().toLocaleDateString()}`, 14, 80);

      const tableData = records.map(rec => [
          new Date(rec.timestamp).toLocaleDateString(),
          rec.type === 1 ? "定期保養" : "事故/理賠",
          rec.provider,
          `${rec.mileage.toLocaleString()} km`,
          rec.description
      ]);

      autoTable(doc, {
          head: [['日期', '類型', '執行機構', '里程', '詳細說明']],
          body: tableData,
          startY: 90,
          styles: { font: "NotoSansTC", fontStyle: "normal" }
      });

      doc.setFontSize(10);
      doc.text(`Powered by Sui Blockchain - Vibicle`, 14, doc.internal.pageSize.height - 10);
      doc.save(`${car.vin}_Report.pdf`);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">載入中...</div>;
  if (!car) return <div className="min-h-screen flex items-center justify-center">找不到車輛</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex justify-between items-center">
            <div className="flex items-center gap-4">
                <Link href="/" className="text-gray-500 hover:text-gray-900 transition flex items-center gap-1">← 返回</Link>
                <h1 className="font-bold text-lg text-gray-800">車輛詳情</h1>
            </div>
            <LoginSection />
        </div>
      </header>

      <div className="max-w-5xl mx-auto p-4 md:p-8">
        
        {/* 車輛卡片 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-8 flex flex-col md:flex-row">
            <div className="w-full md:w-2/5 h-64 md:h-auto bg-gray-100 relative group">
                {car.imageUrl ? (
                    <img src={car.imageUrl} className="w-full h-full object-cover" />
                ) : (
                    <div className="flex items-center justify-center h-full text-gray-400">無圖片</div>
                )}
                {/* 售價標籤 */}
                {car.isListed && car.price && (
                    <div className="absolute bottom-3 right-3 bg-white/90 px-2 py-1 rounded text-xs font-bold text-green-700 shadow-sm">
                        {(Number(car.price) / 1_000_000_000).toLocaleString()} SUI
                    </div>
                )}
            </div>
            <div className="p-6 md:p-8 flex-1">
                <div className="flex justify-between">
                    <h2 className="text-3xl font-bold">{car.brand} {car.model}</h2>
                    <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-sm font-mono">{car.year}</span>
                </div>
                <div className="space-y-2 mt-4">
                    <p className="text-sm text-gray-500">VIN: <span className="font-mono text-gray-800">{car.vin}</span></p>
                    <p className="text-sm text-gray-500">Owner: <span className="font-mono text-gray-800">{car.owner.slice(0,6)}...{car.owner.slice(-4)}</span></p>
                    <p className="text-2xl font-bold text-blue-600 mt-2">{Number(car.mileage).toLocaleString()} km</p>
                </div>
            </div>
        </div>

        {/* 履歷區 */}
        <div className="mb-6 flex justify-between items-center">
            <h3 className="text-xl font-bold text-gray-800">📋 履歷紀錄</h3>
            <button onClick={handleExportPDF} className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm">匯出 PDF</button>
        </div>
        
        <div className="space-y-6 mb-12">
            {records.length === 0 ? <p className="text-center text-gray-400">無紀錄</p> : records.map(rec => (
                <div key={rec.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <div className="flex justify-between mb-2">
                        <span className="font-bold flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${rec.type === 1 ? "bg-blue-500" : "bg-red-500"}`}></span>
                            {rec.provider}
                        </span>
                        <span className="text-gray-500 text-sm">{new Date(rec.timestamp).toLocaleDateString()}</span>
                    </div>
                    <p className="text-gray-700 mb-3">{rec.description}</p>
                    <div className="flex gap-2 overflow-x-auto">
                        {rec.attachments.map((url, i) => (
                            <a key={i} href={url} target="_blank" className="block w-16 h-16 rounded border overflow-hidden"><img src={url} className="w-full h-full object-cover"/></a>
                        ))}
                    </div>
                </div>
            ))}
        </div>

        {/* 💬 公共留言板 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 md:p-8">
            <h3 className="text-xl font-bold text-gray-800 mb-6">💬 留言板</h3>
            
            <div className="space-y-6 mb-8 max-h-96 overflow-y-auto pr-2">
                {comments.length === 0 ? (
                    <p className="text-center text-gray-400 italic">尚無留言</p>
                ) : (
                    comments.map((comment, index) => (
                        <div key={index} className="flex gap-4">
                            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold shrink-0">
                                {comment.sender.slice(2, 4)}
                            </div>
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-sm font-bold text-gray-900">
                                        {comment.sender.slice(0, 6)}...{comment.sender.slice(-4)}
                                    </span>
                                    <span className="text-xs text-gray-400">
                                        {new Date(comment.timestamp).toLocaleString()}
                                    </span>
                                </div>
                                <p className="text-gray-700 bg-gray-50 p-3 rounded-lg rounded-tl-none text-sm">
                                    {comment.message}
                                </p>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {user ? (
                <div className="flex gap-3">
                    <input 
                        type="text" 
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="輸入留言..."
                        className="flex-1 border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <button 
                        onClick={handlePostComment}
                        disabled={sendingComment || !newComment.trim()}
                        className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 disabled:bg-gray-300 transition"
                    >
                        {sendingComment ? "..." : "送出"}
                    </button>
                </div>
            ) : (
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <p className="text-gray-500 text-sm">請先登入以發表留言</p>
                </div>
            )}
        </div>

      </div>
    </div>
  );
}