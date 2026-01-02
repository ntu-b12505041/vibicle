"use client";

import { useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Transaction } from "@mysten/sui/transactions";
import { useCars } from "../hooks/useCars";
import { PACKAGE_ID, MODULE_NAME } from "../constants";
import { useUserAuth } from "../hooks/useUserAuth";
import { EnokiClient } from "@mysten/enoki";
import { fromB64, toB64 } from "@mysten/sui/utils";
import { SuiClient } from "@mysten/sui/client";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { getZkLoginSignature } from "@mysten/sui/zklogin";

const SUI_RPC_URL = "https://fullnode.testnet.sui.io:443";

export function MyCars() {
  const { user } = useUserAuth();
  const { cars, isLoading } = useCars(user?.address);
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const [isProcessing, setIsProcessing] = useState(false);

  const executeZkTransaction = async (tx: Transaction, msg: string) => {
      setIsProcessing(true);
      try {
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
        tx.setSender(user!.address);

        const suiClient = new SuiClient({ url: SUI_RPC_URL });
        const txBytes = await tx.build({ client: suiClient, onlyTransactionKind: true });
        const sponsorRes = await fetch("/api/sponsor", {
            method: "POST", body: JSON.stringify({ transactionBlockKindBytes: toB64(txBytes), sender: user!.address })
        });
        const sponsoredData = await sponsorRes.json();
        const sponsoredTx = Transaction.from(fromB64(sponsoredData.bytes));
        const { signature: userSignature } = await sponsoredTx.sign({ client: suiClient, signer: ephemeralKeyPair });
        const zkSignature = getZkLoginSignature({ inputs: { ...zkp, addressSeed: zkp.addressSeed }, maxEpoch: session.maxEpoch, userSignature });

        await suiClient.executeTransactionBlock({ transactionBlock: sponsoredData.bytes, signature: [zkSignature, sponsoredData.signature], options: { showEffects: true } });
        alert(msg); window.location.reload();
      } catch (e) {
          console.error(e); alert("ERROR: " + (e as Error).message);
      } finally { setIsProcessing(false); }
  };

  const handleListing = async (carId: string, currentStatus: boolean) => {
      const newStatus = !currentStatus;
      let priceInMist = 0;
      if (newStatus) {
          const inputPrice = prompt("SET PRICE (SUI):", "0.1");
          if (inputPrice === null) return;
          const price = parseFloat(inputPrice);
          if (isNaN(price) || price <= 0) return alert("INVALID PRICE");
          priceInMist = Math.floor(price * 1_000_000_000);
      }
      const tx = new Transaction();
      tx.moveCall({ target: `${PACKAGE_ID}::${MODULE_NAME}::update_listing`, arguments: [ tx.object(carId), tx.pure.bool(newStatus), tx.pure.u64(priceInMist) ] });

      if (user?.type === "zklogin") await executeZkTransaction(tx, newStatus ? "LISTED!" : "UNLISTED!");
      else {
          tx.setSender(user!.address);
          signAndExecute({ transaction: tx }, { onSuccess: () => { alert("SUCCESS"); window.location.reload(); }, onError: (e) => alert("ERROR: " + e.message) });
      }
  };

  const handleTransfer = async (carId: string) => {
      const recipient = prompt("RECIPIENT ADDRESS (0x...):");
      if (!recipient) return;
      const tx = new Transaction();
      tx.moveCall({ target: `${PACKAGE_ID}::${MODULE_NAME}::transfer_car`, arguments: [ tx.object(carId), tx.pure.address(recipient) ] });

      if (user?.type === "zklogin") await executeZkTransaction(tx, "TRANSFERRED!");
      else {
          tx.setSender(user!.address);
          signAndExecute({ transaction: tx }, { onSuccess: () => { alert("SUCCESS"); window.location.reload(); }, onError: (e) => alert("ERROR: " + e.message) });
      }
  };

  if (!user) return null;
  if (isLoading) return <div className="text-center p-8 text-gray-500 font-mono animate-pulse">LOADING DATABASE...</div>;

  return (
    <section className="w-full">
        <h2 className="font-['Press_Start_2P',_cursive] text-sm md:text-base text-[#00E5FF] tracking-wide mb-6 px-2 border-l-4 border-[#00E5FF] pl-3">&gt; MY COLLECTION ({cars.length})</h2>
        
        {cars.length === 0 ? (
             <div className="text-center p-12 bg-[#020408]/50 border border-dashed border-slate-700 rounded-xl">
                <p className="text-slate-500 font-mono">NO VEHICLES DETECTED</p>
             </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {cars.map((car) => (
                    <div key={car.id} className="relative bg-[#020408]/80 rounded-xl overflow-hidden border border-[#29B6F6]/50 shadow-[0_0_10px_rgba(41,182,246,0.1)] hover:shadow-[0_0_15px_rgba(41,182,246,0.4)] transition-all duration-300 group">
                        
                        {/* 裝飾角 */}
                        <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-[#00E5FF]/50 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-[#00E5FF]/50 opacity-0 group-hover:opacity-100 transition-opacity"></div>

                        <Link href={`/car/${car.id}`} className="block">
                            <div className="aspect-w-16 aspect-h-9 h-48 overflow-hidden bg-gradient-to-t from-black to-transparent flex items-center justify-center relative">
                                {car.imageUrl ? (
                                    <img src={car.imageUrl} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-300" />
                                ) : (
                                    <span className="text-slate-600 font-mono">NO SIGNAL</span>
                                )}
                                {car.isListed && (
                                    <div className="absolute top-2 right-2 bg-[#00ff41] text-black text-[10px] px-2 py-1 font-bold font-['Press_Start_2P',_cursive] rounded shadow-[0_0_5px_#00ff41]">FOR SALE</div>
                                )}
                            </div>
                            <div className="p-4 bg-[#020408]/50 backdrop-blur-sm border-t border-[#29B6F6]/20">
                                <h3 className="font-bold text-lg text-[#00E5FF] group-hover:text-white transition-colors font-['Space_Grotesk',_sans-serif]">{car.brand} {car.model}</h3>
                                <p className="text-sm text-slate-400 font-mono mt-1">{Number(car.mileage).toLocaleString()} KM</p>
                            </div>
                        </Link>

                        {/* 控制區 */}
                        <div className="border-t border-slate-700 p-4 flex items-center justify-between gap-3 bg-[#020408]/50 backdrop-blur-sm">
                            <button 
                                onClick={() => handleListing(car.id, car.isListed)}
                                disabled={isProcessing}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded border text-[10px] font-['Press_Start_2P',_cursive] transition-all ${
                                    car.isListed 
                                    ? "border-red-500 text-red-500 hover:bg-red-500/10" 
                                    : "border-[#00ff41] text-[#00ff41] hover:bg-[#00ff41]/10"
                                }`}
                            >
                                <span className={`w-2 h-2 rounded-full ${car.isListed ? 'bg-red-500 animate-pulse' : 'bg-[#00ff41]'}`}></span>
                                {car.isListed ? "UNLIST" : "LIST"}
                            </button>

                            <button 
                                onClick={() => handleTransfer(car.id)}
                                disabled={isProcessing}
                                className="flex-1 border border-[#29B6F6]/50 hover:border-[#29B6F6] bg-[#29B6F6]/10 hover:bg-[#29B6F6]/20 text-[#29B6F6] hover:text-white font-['Press_Start_2P',_cursive] py-2 px-3 rounded text-[10px] flex items-center justify-center gap-2 transition-all shadow-[0_0_5px_rgba(41,182,246,0.1)] hover:shadow-[0_0_10px_rgba(41,182,246,0.3)]"
                            >
                                TRANSFER ➜
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        )}
    </section>
  );
}