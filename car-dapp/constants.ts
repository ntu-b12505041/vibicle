// 1. 合約 Package ID
export const PACKAGE_ID = "0xbeed8e27325f9b0f2894c2e2878e6fffed792e10d75137fe480136697d51f986";

// 2. 模組名稱
export const MODULE_NAME = "vehicle";

// 3. Shared Objects
export const CAR_REGISTRY_ID = "0xbc379139b676c9f71dc4ef80c9c3fd1546deb3a7208e622d35b148d2555e4753";
export const AUTH_REGISTRY_ID = "0x18e49dce2f94bc1faff370f95bb656759792e89be502870551802994f0a9dcb6";

// 4. AdminCap (Owned Object)
export const ADMIN_CAP_ID = "0xe91647bdcec70adf896ac34908d4235217e088c3f697295653d1966009a626c5";

// 5. 物件類型 (用於權限檢查 Hook)
export const ADMIN_CAP_TYPE = `${PACKAGE_ID}::${MODULE_NAME}::AdminCap`;
export const THIRD_PARTY_CAP_TYPE = `${PACKAGE_ID}::${MODULE_NAME}::ThirdPartyCap`;

// 6. 事件類型 (用於製作 "合作夥伴清單" 頁面)
export const EVENT_THIRD_PARTY_GRANTED = `${PACKAGE_ID}::${MODULE_NAME}::ThirdPartyGranted`;
export const EVENT_THIRD_PARTY_REVOKED = `${PACKAGE_ID}::${MODULE_NAME}::ThirdPartyRevoked`;

// RPC 節點
export const SUI_RPC_URL = "https://fullnode.testnet.sui.io:443";