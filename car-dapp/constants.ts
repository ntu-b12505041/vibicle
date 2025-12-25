// // ========================================================================================
// // 第一版（有鑄造功能、我的車庫、二手車市場、Walrus、zkLogin、sponsored transaction）
// // ========================================================================================
// // 1. 合約 Package ID (來自 Published Objects)
// export const PACKAGE_ID = "0x4a8be009bb193d883c63b1e193e48df68bc42898fddd36e6ee013c4ea91bf46d";

// // 2. 模組名稱
// export const MODULE_NAME = "vehicle";

// // 3. 車輛註冊表 (Shared Object - 用於前端展示列表 & 鑄造)
// // 來自 Created Objects, Type: ...::vehicle::CarRegistry
// export const CAR_REGISTRY_ID = "0x1b7c588da210a08968bc8657d8cc1d6f38e807a48a47cf3371abc7e625743980";

// // 4. 權限註冊表 (Shared Object - 用於 Admin 授權 & 第三方新增紀錄)
// // 來自 Created Objects, Type: ...::vehicle::AuthRegistry
// export const AUTH_REGISTRY_ID = "0x692a7af908e58444299d79300aa827ded794d86f8869b4ea22a9bc55c87772a8";

// // 5. 管理員權限 (AdminCap - 在你錢包裡)
// // 來自 Created Objects, Type: ...::vehicle::AdminCap
// export const ADMIN_CAP_ID = "0xccc7b963fdd27e1cd2555b587a36bb685fb5bfef85681aa422d3442b3e26f4d7";

// // RPC 節點 (Shinami 或 官方)
// export const SUI_RPC_URL = "https://fullnode.testnet.sui.io:443";



// ========================================================================================
// 第二版（有鑄造功能、我的車庫、二手車市場、Walrus、zkLogin、sponsored transaction、完整功能）
// ========================================================================================
// 1. 合約 Package ID (來自 Published Objects)
export const PACKAGE_ID = "0x90c07cb444d737d0880f505d26c4659c1f134f129230cac9e76fb3bf0342930a";

// 2. 模組名稱
export const MODULE_NAME = "vehicle";

// 3. 車輛註冊表 (Shared Object - 用於前端展示列表 & 鑄造)
// 來自 Created Objects, Type: ...::vehicle::CarRegistry
export const CAR_REGISTRY_ID = "0xfd86709bf23a1affc80db695eb5ce34ad0ff4140be3a78c7abcb63fff1928af4";

// 4. 權限註冊表 (Shared Object - 用於 Admin 授權 & 第三方新增紀錄)
// 來自 Created Objects, Type: ...::vehicle::AuthRegistry
export const AUTH_REGISTRY_ID = "0xe41ac212d96827c4e7c4d461cf7123121c2bcdfefb3d4fd3a54d6f206425c4e1";

// 5. 管理員權限 (AdminCap - 在你錢包裡)
// 來自 Created Objects, Type: ...::vehicle::AdminCap
export const ADMIN_CAP_ID = "0xac37f5a0ddacc484d48ff1ad9774ac0cd178f6dedee79e4e5e3356faec172a45";

// 用於權限判斷的 Type Definition
export const ADMIN_CAP_TYPE = `${PACKAGE_ID}::${MODULE_NAME}::AdminCap`;
export const THIRD_PARTY_CAP_TYPE = `${PACKAGE_ID}::${MODULE_NAME}::ThirdPartyCap`;

// RPC 節點 (Shinami 或 官方)
export const SUI_RPC_URL = "https://fullnode.testnet.sui.io:443";