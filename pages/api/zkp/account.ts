import { ethers } from "ethers";
import { Chain, buildZkAdminData, getWeb3Provider } from "./userop";
import {
  AccountFactory,
  AccountFactory__factory,
  GoogleZkAdmin,
  GoogleZkAdmin__factory,
  OpenId3Account__factory,
} from "@openid3/contracts";

export function getAccountFactory(chain: Chain): AccountFactory {
  return AccountFactory__factory.connect(
    process.env.ACCOUNT_FACTORY_CONTRACT_V1!,
    getWeb3Provider(chain)
  );
}

export function getGoogleZkAdmin(provider: ethers.Provider): GoogleZkAdmin {
  return GoogleZkAdmin__factory.connect(
    process.env.GOOGLE_ZK_ADMIN_CONTRACT_V1!,
    provider
  );
}

export async function isContract(
    provider: ethers.Provider,
    address: string
): Promise<boolean> {
   try {
     const code = await provider.getCode(address);
     if (code !== "0x") return true;
   } catch (error) {}
   return false;
}

async function getInitCode(chain: Chain, accountHash: string) {
  const factory = getAccountFactory({ name: "", id: 0 });
  const provider = getWeb3Provider(chain);
  const zkAdmin = getGoogleZkAdmin(provider);
  const adminData = buildZkAdminData(zkAdmin, accountHash);
  const deploymentCode = factory.interface.encodeFunctionData(
    "cloneWithAdminOnly",
    [adminData],
  );
  return ethers.solidityPacked(
    ["address", "bytes"],
    [process.env.ACCOUNT_FACTORY_CONTRACT_V1!, deploymentCode]
  );
}

export async function getAccountInfo(chain: Chain, accountHash: string) {
  const provider = getWeb3Provider(chain);
  const zkAdmin = getGoogleZkAdmin(provider);
  const adminData = buildZkAdminData(zkAdmin, accountHash);
  const factory = getAccountFactory(chain);
  const salt = ethers.keccak256(adminData);
  const accountAddr = await factory.predictClonedAddress(salt);
  if (await isContract(provider, accountAddr)) {
    return {
        address: accountAddr,
        deployed: false,
        admin: zkAdmin,
        operator: ethers.ZeroAddress,
        initCode: await getInitCode(chain, accountHash),
        accountHash
    };
  } else {
    const account = OpenId3Account__factory.connect(
        accountAddr, provider);
    const [admin, operator] = await Promise.all([
        account.getAdmin(),
        account.getOperator(),
    ]);
    if (admin != process.env.GOOGLE_ZK_ADMIN_CONTRACT_V1) {
        throw new Error("account is not controlled by the admin anymore");
    }
    return {
        address: accountAddr,
        deployed: true,
        admin: zkAdmin,
        operator,
        initCode: "0x",
        accountHash,
    };
  }
}
