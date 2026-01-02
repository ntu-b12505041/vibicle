"use client";

import { useSuiClient } from "@mysten/dapp-kit";
import { useEffect, useState } from "react";
import Link from "next/link";
import { LoginSection } from "../../components/LoginSection";
import { EVENT_THIRD_PARTY_GRANTED, EVENT_THIRD_PARTY_REVOKED } from "../../constants";

type Partner = {
    id: string; 
    name: string;
    type: "Service" | "Insurance";
    address: string;
    status: "Active" | "Revoked";
    grantedAt: number;
};

export default function PartnersPage() {
  const suiClient = useSuiClient();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [filteredPartners, setFilteredPartners] = useState<Partner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchPartners = async () => {
        try {
            // 1. 查詢所有授權事件
            const grantedEvents = await suiClient.queryEvents({
                query: { MoveEventType: EVENT_THIRD_PARTY_GRANTED }
            });

            // 2. 查詢所有撤銷事件
            const revokedEvents = await suiClient.queryEvents({
                query: { MoveEventType: EVENT_THIRD_PARTY_REVOKED }
            });

            const revokedIds = new Set(
                revokedEvents.data.map(e => (e.parsedJson as any).cap_id)
            );

            const partnerList: Partner[] = grantedEvents.data.map(e => {
                const data = e.parsedJson as any;
                return {
                    id: data.cap_id,
                    name: data.name,
                    type: Number(data.org_type) === 1 ? "Service" : "Insurance",
                    address: data.recipient,
                    status: revokedIds.has(data.cap_id) ? "Revoked" : "Active",
                    grantedAt: Number(e.timestampMs)
                };
            });

            partnerList.sort((a, b) => b.grantedAt - a.grantedAt);
            setPartners(partnerList);
            setFilteredPartners(partnerList);

        } catch (e) {
            console.error("Fetch partners failed:", e);
        } finally {
            setIsLoading(false);
        }
    };

    fetchPartners();
  }, [suiClient]);

  // 搜尋過濾
  useEffect(() => {
      const lowerTerm = searchTerm.toLowerCase();
      const filtered = partners.filter(p => 
          p.name.toLowerCase().includes(lowerTerm) || 
          p.address.toLowerCase().includes(lowerTerm)
      );
      setFilteredPartners(filtered);
  }, [searchTerm, partners]);

  return (
    <div className="min-h-screen bg-[#050b14] text-white font-display overflow-x-hidden relative selection:bg-[#06e0f9] selection:text-background-dark">
        {/* Background Grid */}
        <div className="fixed inset-0 bg-[linear-gradient(rgba(6,224,249,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(6,224,249,0.03)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none z-0"></div>
        <div className="fixed inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0),rgba(255,255,255,0)_50%,rgba(0,0,0,0.2)_50%,rgba(0,0,0,0.2))] bg-[size:100%_4px] pointer-events-none z-50 opacity-15"></div>

        <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-[#050b14]/80 border-b border-[#06e0f9]/20">
            <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4 group cursor-pointer">
                    <Link href="/" className="flex items-center gap-3">
                        <div className="size-8 text-[#06e0f9] animate-pulse flex items-center justify-center">
                            <span className="text-3xl">🕸️</span>
                        </div>
                        <h2 className="text-[#06e0f9] text-sm md:text-base font-['Press_Start_2P',_cursive] leading-tight tracking-widest group-hover:text-white transition-all">
                            CYBER.NET
                        </h2>
                    </Link>
                </div>
                <LoginSection />
            </div>
        </header>

        <main className="flex-grow flex flex-col items-center w-full relative z-10">
            {/* 標題與搜尋區 */}
            <section className="w-full max-w-[1280px] px-6 py-12 md:py-20 flex flex-col items-center">
                <div className="w-full relative p-8 md:p-12 overflow-hidden rounded-sm border border-[#29B6F6]/30 bg-[#0a1520]/50">
                    {/* 角落裝飾 */}
                    <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-[#06e0f9]"></div>
                    <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-[#06e0f9]"></div>
                    <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-[#06e0f9]"></div>
                    <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-[#06e0f9]"></div>

                    <div className="flex flex-col gap-6 items-center justify-center text-center z-10 relative">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-[#29B6F6]/10 border border-[#29B6F6]/30 text-[#29B6F6] text-xs tracking-[0.2em] mb-2 font-mono">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                            SYSTEM.STATUS: ONLINE
                        </div>
                        <h1 className="text-white text-3xl md:text-5xl lg:text-6xl font-['Press_Start_2P',_cursive] leading-tight drop-shadow-[0_0_10px_rgba(6,224,249,0.5)] md:max-w-4xl mx-auto">
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#29B6F6] to-[#06e0f9]">STRATEGIC</span><br/>
                            ALLIANCES
                        </h1>
                        <h2 className="text-[#29B6F6] text-sm md:text-lg font-mono tracking-widest mt-2 max-w-2xl">
                            &gt; EXECUTING PARTNER_PROTOCOL_V9.2...<br/>
                            &gt; LOADING DATABASE... {isLoading ? "PROCESSING..." : "100%"}
                        </h2>

                        <div className="w-full max-w-lg mt-8 group">
                            <div className="flex w-full items-stretch h-12 md:h-14 relative">
                                <div className="absolute inset-0 bg-[#06e0f9]/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                <div className="relative z-10 flex w-full bg-[#0a1520] border border-[#29B6F6]/50 group-hover:border-[#06e0f9] transition-colors clip-path-polygon">
                                    <div className="flex items-center justify-center pl-4 text-[#29B6F6]">
                                        <span>🔍</span>
                                    </div>
                                    <input 
                                        type="text"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="flex-1 bg-transparent border-none text-white placeholder-[#29B6F6]/50 focus:ring-0 text-sm md:text-base font-mono px-4 uppercase outline-none" 
                                        placeholder="SEARCH_ENTITY_ID..." 
                                    />
                                    <button className="px-6 h-full bg-[#29B6F6]/20 hover:bg-[#06e0f9] hover:text-black text-[#06e0f9] font-bold tracking-widest text-xs md:text-sm transition-colors border-l border-[#29B6F6]/50">
                                        SCAN
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* 合作夥伴列表 (Tier 1) */}
            <section className="w-full max-w-[1280px] px-6 py-8">
                <div className="flex items-center gap-4 mb-8">
                    <span className="text-[#06e0f9] text-2xl">❖</span>
                    <h2 className="text-xl md:text-2xl font-['Press_Start_2P',_cursive] text-white tracking-wide">TIER 1: PRIME OPERATORS</h2>
                    <div className="h-px bg-gradient-to-r from-[#06e0f9]/50 to-transparent flex-1"></div>
                </div>

                {isLoading ? (
                    <div className="flex justify-center p-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#06e0f9]"></div>
                    </div>
                ) : filteredPartners.length === 0 ? (
                    <div className="text-center p-20 border border-[#29B6F6]/30 bg-[#0a1520]/50">
                        <p className="text-[#29B6F6] font-mono">NO PARTNERS FOUND IN SECTOR 7</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                        {filteredPartners.map((p) => (
                            <div key={p.id} className="bg-[#0a1520] border border-[#29B6F6]/30 p-1 relative group hover:border-[#06e0f9] transition-all duration-300 hover:-translate-y-1">
                                <div className="absolute inset-0 bg-gradient-to-b from-[#06e0f9]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                                <div className="h-full w-full bg-[#081018] p-6 flex flex-col gap-6">
                                    <div className="flex justify-between items-start">
                                        <div className="h-16 w-16 rounded bg-white/5 flex items-center justify-center border border-white/10 group-hover:border-[#06e0f9]/50 group-hover:shadow-[0_0_15px_rgba(6,224,249,0.3)] transition-all">
                                            <span className="text-4xl">
                                                {p.type === "Service" ? "🔧" : "🛡️"}
                                            </span>
                                        </div>
                                        <span className={`text-[10px] font-mono px-2 py-1 rounded border ${
                                            p.status === "Active" 
                                            ? "text-[#00FF00] bg-[#00FF00]/10 border-[#00FF00]/20" 
                                            : "text-[#FF3333] bg-[#FF3333]/10 border-[#FF3333]/20"
                                        }`}>
                                            {p.status.toUpperCase()}
                                        </span>
                                    </div>
                                    <div>
                                        <h3 className="text-white text-xl font-bold uppercase tracking-wide group-hover:text-[#06e0f9] transition-colors truncate">
                                            {p.name}
                                        </h3>
                                        <p className="text-[#29B6F6]/60 text-xs font-mono mt-1 flex items-center gap-2">
                                            <span>&gt; TYPE: {p.type.toUpperCase()}</span>
                                            {p.status === "Active" && <span className="w-1.5 h-1.5 rounded-full bg-[#00FF00] animate-pulse"></span>}
                                        </p>
                                    </div>
                                    <div className="border-t border-white/5 pt-4">
                                        <p className="text-gray-400 text-xs font-mono mb-1">CAP ID:</p>
                                        <p className="text-[#29B6F6] text-xs font-mono truncate cursor-pointer hover:text-white" title={p.id}>
                                            {p.id}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* 加入聯盟 CTA */}
            <section className="w-full max-w-[1280px] px-6 pb-24 pt-8 flex justify-center">
                <div className="w-full max-w-2xl relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-[#06e0f9] via-[#29B6F6] to-[#06e0f9] rounded-lg blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200 animate-pulse"></div>
                    <div className="relative w-full p-8 md:p-10 bg-[#0a1520]/90 backdrop-blur-sm border border-[#06e0f9]/50 flex flex-col items-center justify-center text-center gap-6 shadow-[0_0_20px_rgba(6,224,249,0.3)]">
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-[2px] bg-gradient-to-r from-transparent via-[#06e0f9] to-transparent"></div>
                        <div className="flex flex-col gap-2 items-center">
                            <div className="size-12 rounded-full border-2 border-[#06e0f9]/30 flex items-center justify-center bg-[#06e0f9]/10 mb-2">
                                <span className="text-[#06e0f9] text-2xl animate-pulse">🤝</span>
                            </div>
                            <h2 className="text-2xl md:text-3xl font-['Press_Start_2P',_cursive] text-white">JOIN THE ALLIANCE</h2>
                            <p className="text-[#29B6F6]/80 font-mono text-sm md:text-base max-w-md">
                                Initiate partnership protocols and integrate your systems with the Vibicle mainframe.
                            </p>
                        </div>
                        <button className="relative group/btn overflow-hidden px-8 py-4 bg-[#06e0f9] text-[#0a1520] font-['Press_Start_2P',_cursive] text-sm md:text-base tracking-widest hover:bg-white transition-all duration-300 transform hover:scale-105 hover:shadow-[0_0_20px_rgba(6,224,249,0.6)]">
                            <span className="relative z-10 flex items-center gap-3">
                                BECOME_A_PARTNER
                                <span>→</span>
                            </span>
                        </button>
                        <div className="absolute bottom-2 left-2 text-[10px] font-mono text-[#06e0f9]/40">SYS.ID: REG_01</div>
                        <div className="absolute bottom-2 right-2 text-[10px] font-mono text-[#06e0f9]/40">STATUS: OPEN</div>
                    </div>
                </div>
            </section>

        </main>
        
        {/* Footer */}
        <footer className="w-full bg-[#0a1520] border-t border-[#29B6F6]/20 py-8 relative">
            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-[#06e0f9]/50 to-transparent"></div>
            <div className="flex flex-col items-center justify-center text-center px-6">
                <div className="flex gap-2 items-center text-[#29B6F6]/50 font-['Press_Start_2P',_cursive] text-[10px] mb-4">
                    <span>SYS.VER.4.0.2</span>
                    <span>|</span>
                    <span>SECURE CONNECTION</span>
                </div>
                <div className="text-white/40 text-sm font-mono">
                    © 2077 VIBICLE ALLIANCE DATABASE. UNAUTHORIZED ACCESS IS PROHIBITED.
                </div>
            </div>
        </footer>
    </div>
  );
}