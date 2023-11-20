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
    "0xa5727531591A3dE7ADaC6b3759bEF5BD5549c121", // TODO: temp workaround, revert this
    // process.env.ACCOUNT_FACTORY_CONTRACT_V1!,
    getWeb3Provider(chain)
  );
}

export function getGoogleZkAdmin(provider: ethers.Provider): GoogleZkAdmin {
  return GoogleZkAdmin__factory.connect(
    "0xbeE0224b98e01A3Dc2066b81bcf2Ce8D5FCF6E15", // TODO: same as above, revert this
    // process.env.GOOGLE_ZK_ADMIN_CONTRACT_V1!,
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
  const provider = getWeb3Provider(chain);
  const zkAdmin = getGoogleZkAdmin(provider);
  const adminData = buildZkAdminData(zkAdmin, accountHash);
  const factory = getAccountFactory(chain);
  const deploymentCode = factory.interface.encodeFunctionData(
    "cloneWithAdminOnly",
    [adminData]
  );
  return ethers.solidityPacked(
    ["address", "bytes"],
    ["0xa5727531591A3dE7ADaC6b3759bEF5BD5549c121", deploymentCode]
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
    const account = OpenId3Account__factory.connect(accountAddr, provider);
    const [admin, operator] = await Promise.all([
      account.getAdmin(),
      account.getOperator(),
    ]);
    if (admin != "0xbeE0224b98e01A3Dc2066b81bcf2Ce8D5FCF6E15") {
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
  } else {
    return {
      address: accountAddr,
      deployed: false,
      admin: zkAdmin,
      operator: ethers.ZeroAddress,
      initCode: await getInitCode(chain, accountHash),
      accountHash,
    };
  }
}
