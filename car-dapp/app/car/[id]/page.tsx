"use client";

import { useSuiClient, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { LoginSection } from "../../../components/LoginSection";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { fontBase64 } from "./chineseFont";
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
            price: fields.price,
            isListed: fields.is_listed
        });

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

        const carFieldsRes = await suiClient.getDynamicFields({ parentId: carId });
        const commentFieldIds = carFieldsRes.data.map(df => df.objectId);
        if (commentFieldIds.length > 0) {
             const fieldObjs = await suiClient.multiGetObjects({ ids: commentFieldIds, options: { showContent: true } });
             const parsedComments = fieldObjs.map(obj => {
                 const content = obj.data?.content as any;
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

  const handlePostComment = async () => {
      if (!user) return alert("請先登入");
      if (!newComment.trim()) return;
      setSendingComment(true);

      try {
          const tx = new Transaction();
          tx.moveCall({
              target: `${PACKAGE_ID}::${MODULE_NAME}::post_comment`,
              arguments: [ tx.object(carId), tx.pure.string(newComment), tx.object("0x6") ]
          });

          if (user.type === "zklogin") {
              const session = (user as any).session;
              if (!session) throw new Error("Session Invalid");
              const keypairBytes = fromB64(session.ephemeralKeyPair);
              const ephemeralKeyPair = Ed25519Keypair.fromSecretKey(keypairBytes);
              const pubKey = ephemeralKeyPair.getPublicKey();

              const zkpResponse = await fetch("/api/zkp", {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ jwt: session.jwt, ephemeralPublicKey: pubKey.toBase64(), maxEpoch: session.maxEpoch, randomness: session.randomness, network: "testnet" })
              });
              const zkp = await zkpResponse.json();
              const trueAddress = computeZkLoginAddressFromSeed(BigInt(zkp.addressSeed), getIssFromJwt(session.jwt));
              tx.setSender(trueAddress);

              const suiClient = new SuiClient({ url: SUI_RPC_URL });
              const txBytes = await tx.build({ client: suiClient, onlyTransactionKind: true });
              const sponsorRes = await fetch("/api/sponsor", {
                  method: "POST", body: JSON.stringify({ transactionBlockKindBytes: toB64(txBytes), sender: trueAddress })
              });
              const sponsoredData = await sponsorRes.json();
              const sponsoredTx = Transaction.from(fromB64(sponsoredData.bytes));
              const { signature: userSignature } = await sponsoredTx.sign({ client: suiClient, signer: ephemeralKeyPair });
              const zkSignature = getZkLoginSignature({ inputs: { ...zkp, addressSeed: zkp.addressSeed }, maxEpoch: session.maxEpoch, userSignature });

              await suiClient.executeTransactionBlock({ transactionBlock: sponsoredData.bytes, signature: [zkSignature, sponsoredData.signature], options: { showEffects: true } });
              alert("留言成功！"); setNewComment(""); window.location.reload();
          } else {
              tx.setSender(user.address);
              signAndExecute({ transaction: tx }, {
                  onSuccess: () => { alert("留言成功！"); setNewComment(""); window.location.reload(); },
                  onError: (e) => alert("失敗: " + e.message)
              });
          }
      } catch (e) {
          console.error(e); alert("留言失敗: " + (e as Error).message);
      } finally {
          setSendingComment(false);
      }
  };

  const handleExportPDF = () => {
      if (!car) return;
      const doc = new jsPDF();
      const fontFileName = "NotoSansTC-Regular.ttf";
      doc.addFileToVFS(fontFileName, fontBase64);
      doc.addFont(fontFileName, "NotoSansTC", "normal");
      doc.setFont("NotoSansTC");
      doc.setFontSize(20); doc.text("Vibicle - 車輛履歷報告", 14, 22);
      doc.setFontSize(12);
      doc.text(`Brand/Model: ${car.brand} ${car.model}`, 14, 40);
      doc.text(`VIN: ${car.vin}`, 14, 48);
      doc.text(`Mileage: ${Number(car.mileage).toLocaleString()} km`, 14, 56);
      doc.text(`Report Date: ${new Date().toLocaleDateString()}`, 14, 80);

      const tableData = records.map(rec => [
          new Date(rec.timestamp).toLocaleDateString(),
          rec.type === 1 ? "定期保養" : "事故/理賠",
          rec.provider,
          `${rec.mileage.toLocaleString()} km`,
          rec.description
      ]);

      autoTable(doc, {
          head: [['日期', '類型', '執行機構', '里程', '詳細說明']],
          body: tableData, startY: 90, styles: { font: "NotoSansTC", fontStyle: "normal" }
      });
      doc.save(`${car.vin}_Report.pdf`);
  };

  if (loading) return (
    <div className="min-h-screen bg-[#050b14] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#00E5FF]"></div>
    </div>
  );

  if (!car) return <div className="min-h-screen bg-[#050b14] flex items-center justify-center text-white">Car Not Found</div>;

  return (
    <div className="min-h-screen bg-[#050b14] text-white font-sans selection:bg-[#00E5FF] selection:text-[#050b14]">
      {/* Background Grid */}
      <div className="fixed inset-0 pointer-events-none z-0" style={{
          backgroundImage: 'linear-gradient(to right, #29B6F61a 1px, transparent 1px), linear-gradient(to bottom, #29B6F61a 1px, transparent 1px)',
          backgroundSize: '40px 40px'
      }} />

      <nav className="sticky top-0 z-40 w-full border-b border-[#21464a] bg-[#050b14]/90 backdrop-blur-md">
        <div className="px-6 lg:px-12 py-4 flex items-center justify-between">
            <div className="flex items-center gap-8">
                <Link href="/" className="flex items-center gap-3 group">
                    <div className="text-[#00E5FF] group-hover:animate-pulse text-3xl">🚗</div>
                    <h2 className="text-white text-lg font-bold tracking-widest font-['Press_Start_2P',_cursive] group-hover:text-[#00E5FF] transition-colors">VIBICLE</h2>
                </Link>
            </div>
            <LoginSection />
        </div>
      </nav>

      <main className="relative z-10 container mx-auto px-6 lg:px-12 py-8 min-h-screen">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm mb-8 text-gray-400">
            <Link href="/" className="hover:text-[#00E5FF] transition-colors">Home</Link>
            <span>›</span>
            <Link href="/market" className="hover:text-[#00E5FF] transition-colors">Marketplace</Link>
            <span>›</span>
            <span className="text-[#00E5FF] font-bold">{car.brand} {car.model}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 xl:gap-12">
            
            {/* 左側：大圖與圖庫 */}
            <div className="lg:col-span-7 flex flex-col gap-6">
                <div className="relative group w-full aspect-[16/10] bg-[#0a1625] border border-[#00E5FF]/30 rounded-lg overflow-hidden">
                    {/* 裝飾角 */}
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-[#00E5FF] z-20"></div>
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-[#00E5FF] z-20"></div>
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-[#00E5FF] z-20"></div>
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-[#00E5FF] z-20"></div>
                    
                    {car.imageUrl ? (
                        <img src={car.imageUrl} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                    ) : (
                        <div className="flex items-center justify-center h-full text-gray-600">NO IMAGE</div>
                    )}
                    
                    {car.isListed && (
                        <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-sm border border-[#00E5FF] text-[#00E5FF] px-3 py-1 text-xs font-bold uppercase tracking-widest rounded shadow-[0_0_10px_#00E5FF]">
                            FOR SALE
                        </div>
                    )}
                </div>

                {/* 歷史紀錄時間軸 (移植到左側) */}
                <div className="mt-8 p-6 bg-[#0a1625] border border-[#21464a] rounded-lg">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-['Press_Start_2P',_cursive] text-[#29B6F6] text-sm flex items-center gap-2">
                             VEHICLE HISTORY
                        </h3>
                        <button onClick={handleExportPDF} className="text-xs bg-[#21464a] hover:bg-[#00E5FF] hover:text-black px-3 py-1 rounded transition-colors">
                            EXPORT PDF
                        </button>
                    </div>

                    <div className="relative pl-4 border-l-2 border-[#21464a] space-y-8">
                        {/* 顯示鑄造時間 (最早) */}
                        <div className="relative pl-6">
                            <div className="absolute -left-[25px] top-1 w-4 h-4 rounded-full bg-[#050b14] border-2 border-gray-600"></div>
                            <h4 className="text-white font-bold text-lg">Minted on Chain</h4>
                            <p className="text-gray-400 text-sm mt-1">Vehicle digital identity created.</p>
                        </div>

                        {/* 顯示 Records */}
                        {records.map((rec) => (
                            <div key={rec.id} className="relative pl-6">
                                <div className={`absolute -left-[25px] top-1 w-4 h-4 rounded-full bg-[#050b14] border-2 ${rec.type===1 ? 'border-[#29B6F6]' : 'border-[#FF5252]'}`}></div>
                                <div className={`text-xs font-mono mb-1 ${rec.type===1 ? 'text-[#29B6F6]' : 'text-[#FF5252]'}`}>
                                    {new Date(rec.timestamp).toLocaleDateString()} // {rec.mileage.toLocaleString()} KM
                                </div>
                                <h4 className="text-white font-bold text-lg">{rec.provider}</h4>
                                <p className="text-gray-400 text-sm mt-1">{rec.description}</p>
                                {/* 附件縮圖 */}
                                {rec.attachments.length > 0 && (
                                    <div className="flex gap-2 mt-2">
                                        {rec.attachments.map((url, i) => (
                                            <a key={i} href={url} target="_blank" className="w-12 h-12 border border-[#21464a] rounded overflow-hidden hover:border-[#00E5FF]">
                                                <img src={url} className="w-full h-full object-cover" />
                                            </a>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* 右側：車輛資訊 */}
            <div className="lg:col-span-5 flex flex-col h-full">
                <div className="mb-8 border-b border-[#21464a] pb-8">
                    <h1 className="font-['Press_Start_2P',_cursive] text-2xl md:text-3xl leading-snug mb-4 text-white uppercase" style={{textShadow: "2px 2px 0px #21464a"}}>
                        {car.brand} {car.model}
                    </h1>
                    <div className="flex items-end gap-3">
                        <span className="text-4xl md:text-5xl font-bold text-[#00E5FF] drop-shadow-[0_0_8px_rgba(0,229,255,0.6)]">
                            {car.price ? (Number(car.price)/1_000_000_000).toLocaleString() : "N/A"}
                        </span>
                        <span className="text-xl text-gray-400 mb-2 font-['Press_Start_2P',_cursive]">SUI</span>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-8">
                    <div className="bg-[#0a1625] border border-[#21464a] p-4 rounded hover:border-[#29B6F6]/50 transition-colors group">
                        <div className="text-gray-500 text-xs uppercase tracking-widest mb-1">VIN</div>
                        <div className="text-white font-mono text-sm truncate group-hover:text-[#29B6F6]">{car.vin}</div>
                    </div>
                    <div className="bg-[#0a1625] border border-[#21464a] p-4 rounded hover:border-[#29B6F6]/50 transition-colors group">
                        <div className="text-gray-500 text-xs uppercase tracking-widest mb-1">MILEAGE</div>
                        <div className="text-white font-mono text-sm group-hover:text-[#29B6F6]">{Number(car.mileage).toLocaleString()} KM</div>
                    </div>
                    <div className="bg-[#0a1625] border border-[#21464a] p-4 rounded hover:border-[#29B6F6]/50 transition-colors group col-span-2">
                        <div className="text-gray-500 text-xs uppercase tracking-widest mb-1">OWNER</div>
                        <div className="text-white font-mono text-sm truncate group-hover:text-[#29B6F6]">{car.owner}</div>
                    </div>
                </div>
            </div>
        </div>

        {/* 留言板區塊 */}
        <div className="mt-16 pt-8 border-t border-[#21464a]">
            <div className="flex items-center justify-between mb-8">
                <h3 className="font-['Press_Start_2P',_cursive] text-[#29B6F6] text-lg flex items-center gap-3">
                    COMMENTS CHANNEL
                </h3>
                <span className="text-xs font-mono text-gray-500 border border-[#21464a] px-2 py-1 rounded bg-[#0a1625]">PUBLIC::ON</span>
            </div>

            <div className="space-y-6 max-w-4xl mx-auto lg:mx-0 lg:max-w-none mb-10">
                {comments.length === 0 ? (
                    <p className="text-gray-500 italic">No transmissions yet...</p>
                ) : (
                    comments.map((comment, index) => (
                        <div key={index} className="flex gap-4 group">
                            <div className="flex-shrink-0 hidden sm:block">
                                <div className="w-12 h-12 rounded bg-[#0a1625] border border-[#21464a] flex items-center justify-center">
                                    <span className="text-gray-400 font-bold">{comment.sender.slice(2,4)}</span>
                                </div>
                            </div>
                            <div className="flex-grow bg-[#0a1625]/50 border border-[#21464a] p-5 rounded relative hover:bg-[#0a1625] hover:border-[#00E5FF]/50 transition-all">
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-3 border-b border-[#21464a]/50 pb-2">
                                    <span className="text-[#00E5FF] font-mono text-xs font-bold tracking-wide">
                                        {comment.sender.slice(0, 6)}...{comment.sender.slice(-4)}
                                    </span>
                                    <span className="text-xs text-gray-500 font-mono">
                                        {new Date(comment.timestamp).toLocaleString()}
                                    </span>
                                </div>
                                <p className="text-gray-300 text-sm leading-relaxed">{comment.message}</p>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* 發送留言 */}
            {user ? (
                <div className="mt-10 bg-[#0a1625] border border-[#21464a] p-6 rounded relative overflow-hidden group focus-within:border-[#00E5FF]/50 transition-colors">
                    {/* 裝飾角 */}
                    <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[#00E5FF] opacity-50"></div>
                    <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[#00E5FF] opacity-50"></div>
                    <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[#00E5FF] opacity-50"></div>
                    <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[#00E5FF] opacity-50"></div>
                    
                    <h4 className="text-white font-bold text-sm uppercase tracking-widest mb-4 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#00E5FF] animate-pulse"></span>
                        New Transmission
                    </h4>
                    <div className="space-y-4">
                        <textarea 
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            className="w-full bg-[#050b14] border border-[#21464a] text-white p-4 rounded focus:outline-none focus:border-[#00E5FF] focus:shadow-[0_0_15px_rgba(0,229,255,0.3)] transition-all font-mono text-sm placeholder-gray-600 resize-y min-h-[100px]" 
                            placeholder="Type your message here..."
                        ></textarea>
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="text-xs text-gray-500 font-mono flex items-center gap-2">
                                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                NetLink: Active
                            </div>
                            <button 
                                onClick={handlePostComment}
                                disabled={sendingComment || !newComment.trim()}
                                className="w-full sm:w-auto bg-[#00E5FF] hover:bg-white text-[#050b14] font-bold text-xs uppercase px-8 py-3 rounded tracking-widest transition-all hover:shadow-[0_0_10px_#00E5FF] flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {sendingComment ? "SENDING..." : "SEND >"}
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="text-center p-4 bg-[#0a1625] rounded border border-[#21464a] text-gray-500">
                    Login to join the channel.
                </div>
            )}
        </div>
      </main>
    </div>
  );
}