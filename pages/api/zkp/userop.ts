import { AddressLike, BigNumberish, BytesLike, ethers } from "ethers";
import { GoogleZkAdmin, OpenId3Account, OpenId3Account__factory } from "@openid3/contracts";

export type UserOperationStruct = {
    sender: AddressLike;
    nonce: BigNumberish;
    initCode: BytesLike;
    callData: BytesLike;
    callGasLimit: BigNumberish;
    verificationGasLimit: BigNumberish;
    preVerificationGas: BigNumberish;
    maxFeePerGas: BigNumberish;
    maxPriorityFeePerGas: BigNumberish;
    paymasterAndData: BytesLike;
    signature: BytesLike;
};

const ENTRY_POINT_ADDRESS = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";

const DUMMY_SIGNATURE = "0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c";

export interface Chain {
  name: string;
  id: number;
};

export const getWeb3Provider = (chain: Chain) => {
  const apiKey = process.env.INFURA_API_KEY;
  return new ethers.InfuraProvider(Number(chain.id), apiKey);
};

export const buildAccountExecData = async (
    account: OpenId3Account,
    target: string,
    value?: BigNumberish,
    data?: string
) => {
    return account.interface.encodeFunctionData("execute", [
      target,
      value ?? 0,
      data ?? "0x"
    ]);
}

const getNonce = async (
    account: OpenId3Account,
    chain: Chain,
) => {
  const accountAddr = await account.getAddress();
  if (await getWeb3Provider(chain).getCode(accountAddr) === "0x") {
    return 0;
  }
  return await account.getNonce() as BigNumberish;
}

export const genUserOp = async (
  chain: Chain,
  account: OpenId3Account,
  callData: string,
  paymasterAndData: string,
): Promise<UserOperationStruct> => {
  const accountAddr = await account.getAddress();
  const fee = await getWeb3Provider(chain).getFeeData();
  const signature = ethers.solidityPacked(
    ["uint8", "bytes"], [1, DUMMY_SIGNATURE]);
  const userOp: UserOperationStruct = {
    sender: accountAddr,
    nonce: await getNonce(account, chain),
    initCode: "0x",
    callData,
    callGasLimit: 200000, // hardcoded
    verificationGasLimit: 2000000, // hardcoded
    preVerificationGas: 400000, // hardcoded, tune it later
    maxFeePerGas: fee.maxFeePerGas ?? 0n, // may need to tune this
    maxPriorityFeePerGas: fee.maxPriorityFeePerGas ?? 0n,
    paymasterAndData: paymasterAndData ?? "0x",
    signature,
  };
  return await ethers.resolveProperties(userOp);
}

export const genUserOpHash = async (
  chain: Chain,
  op: UserOperationStruct
) => {
    const opHash = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          [
            'address',
            'uint256',
            'bytes32',
            'bytes32',
            'uint256',
            'uint256',
            'uint256',
            'uint256',
            'uint256',
            'bytes32',
          ],
          [
            op.sender,
            op.nonce,
            ethers.keccak256(op.initCode),
            ethers.keccak256(op.callData),
            op.callGasLimit,
            op.verificationGasLimit,
            op.preVerificationGas,
            op.maxFeePerGas,
            op.maxPriorityFeePerGas,
            ethers.keccak256(op.paymasterAndData)
          ]
        )
      );
    return ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ["bytes32", "address", "uint256"],
          [opHash, ENTRY_POINT_ADDRESS, chain.id]
        )
    );
}

export const buildZkAdminData = (
    admin: GoogleZkAdmin,
    accountHash: string,
  ) => {
    let adminData = admin.interface.encodeFunctionData(
      "linkAccount", [accountHash]
    );
    return ethers.solidityPacked(
      ["address", "bytes"], [admin.target, adminData])
}

export async function buildAdminCallUserOp(
    chain: Chain,
    sender: OpenId3Account,
    callData: string,
    paymasterAndData?: string,
) {
    let userOp = await genUserOp(
        chain, sender, callData, paymasterAndData ?? "0x");
    const userOpHash = await genUserOpHash(chain, userOp);
    userOp.signature = ethers.solidityPacked(
        ["uint8", "bytes"], [1, userOp.signature]);
    return {userOp, userOpHash};
}

export async function buildAdminCallResetOperatorUserOp(
    chain: Chain,
    sender: string,
    newOperator: string,
    paymasterAndData?: string,
) {
    const account = OpenId3Account__factory.connect(
        sender, getWeb3Provider(chain));
    const callData = account.interface.encodeFunctionData(
        "setOperator", [newOperator]);
    return await buildAdminCallUserOp(
        chain, account, callData, paymasterAndData ?? "0x");
}
