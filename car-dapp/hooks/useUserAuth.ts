import { useCurrentAccount } from "@mysten/dapp-kit";
import { useEnokiFlow } from "@mysten/enoki/react";
import { useState, useEffect } from "react";

export function useUserAuth() {
  const walletAccount = useCurrentAccount();
  const enokiFlow = useEnokiFlow();
  
  const [zkSession, setZkSession] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      // 1. 讀取 LocalStorage (這裡面已經包含由 auth/page.tsx 算好的正確地址)
      const backup = window.localStorage.getItem("demo_zk_session");
      if (backup) {
        try {
          const session = JSON.parse(backup);
          setZkSession(session);
          
          // 嘗試恢復 SDK 狀態
          if ((enokiFlow as any).$zkLoginState) {
             (enokiFlow as any).$zkLoginState.set(session);
          }
        } catch (e) { console.error(e); }
      } 
      // 備援：如果 LocalStorage 沒資料才問 SDK (通常此時還沒登入)
      else {
        try {
            const s = await (enokiFlow as any).getSession();
            if (s && s.jwt) setZkSession(s);
        } catch (e) {}
      }
      setIsLoading(false);
    };

    const timer = setTimeout(checkAuth, 100); // 稍微延遲避免 Hydration 錯誤
    return () => clearTimeout(timer);
  }, [enokiFlow]);

  const user = walletAccount?.address 
    ? { type: "wallet", address: walletAccount.address }
    : zkSession?.address // 這裡會直接讀到 auth/page 寫入的正確地址 B
      ? { type: "zklogin", address: zkSession.address, session: zkSession }
      : null;

  return {
    user,
    isLoading,
    login: async () => {  
        const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
        const redirectUrl = `${window.location.origin}/auth`;
        try {
            // @ts-ignore
            const url = await enokiFlow.createAuthorizationURL({
                provider: "google",
                clientId: clientId,
                redirectUrl: redirectUrl,
                network: "testnet"
            });
            window.location.href = url;
        } catch (e) {
            console.error("Login URL Error:", e);
        }
    },
    logout: () => { 
        // @ts-ignore
        enokiFlow.logout();
        window.localStorage.removeItem("demo_zk_session");
        window.localStorage.removeItem("shinami_jwt");
        setZkSession(null);
        window.location.reload();
    }
  };
}