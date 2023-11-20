import { AddressLike, BigNumberish, BytesLike, ethers } from "ethers";
import { AccountFactory__factory, GoogleZkAdmin, OpenId3Account, OpenId3Account__factory } from "@openid3/contracts";
import { DUMMY_SIGNATURE, ENTRY_POINT_ADDRESS } from "./constants";

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
    accountAddr: string,
    chain: Chain,
) => {
  if (await getWeb3Provider(chain).getCode(accountAddr) === "0x") {
    return 0n;
  }
  const account = OpenId3Account__factory.connect(
    accountAddr,
    getWeb3Provider(chain)
  );
  return await account.getNonce();
}

export const genUserOp = async (
  chain: Chain,
  sender: string,
  initCode: string,
  callData: string,
  paymasterAndData: string,
): Promise<UserOperationStruct> => {
  const fee = await getWeb3Provider(chain).getFeeData();
  const signature = ethers.solidityPacked(
    ["uint8", "bytes"], [1, DUMMY_SIGNATURE]);
  const maxFeePerGas = fee.maxFeePerGas ?? 0n;
  const maxPriorityFeePerGas = fee.maxPriorityFeePerGas ?? 0n;
  const nonce = await getNonce(sender, chain);
  const userOp: UserOperationStruct = {
    sender,
    nonce: "0x" + nonce.toString(16),
    initCode,
    callData,
    callGasLimit: 1000000, // hardcoded
    verificationGasLimit: 2000000, // hardcoded
    preVerificationGas: 400000, // hardcoded, tune it later
    maxFeePerGas: "0x" + maxFeePerGas.toString(16), // may need to tune this
    maxPriorityFeePerGas: "0x" + maxPriorityFeePerGas.toString(16),
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

export async function buildAdminCallResetOperatorUserOp(
    chain: Chain,
    sender: string,
    initCode: string,
    newOperator: string,
    paymasterAndData?: string,
) {
    const iface = new ethers.Interface(OpenId3Account__factory.abi);
    const callData = iface.encodeFunctionData(
        "setOperator", [newOperator]);
    const userOp = await genUserOp(
          chain,
          sender,
          initCode,
          callData,
          paymasterAndData ?? "0x"
    );
    const userOpHash = await genUserOpHash(chain, userOp);
    userOp.signature = ethers.solidityPacked(
        ["uint8", "bytes"], [1, userOp.signature]);
    return {userOp, userOpHash};
}
