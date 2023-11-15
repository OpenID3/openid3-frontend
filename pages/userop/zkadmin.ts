import { GoogleZkAdmin, OpenId3Account, OpenId3Account__factory } from "@openid3/contracts";
import { ethers } from "ethers";
import { Chain, genUserOp, genUserOpHash, getWeb3Provider, updateGasEstimation } from "./userop";

export interface JwtInput {
    kidSha256: string,
    iat: string,
    jwtHeaderAndPayloadHash: string,
    jwtSignature: string,
}

export interface OidcZkProofInput {
    jwt: JwtInput,
    circuitDigest: string,
    proof: string,
}

// export const AUD_SHA256 = "0x639d84aa3d96a6c1d4d140267fb9d209a412d8cd2de2702e3f309149ae2321ec";
export const AUD_SHA256 = "0x63adebe476a0d4dfc02266fd4398280d7c50cc62137c3f7b7884a1255fc45238";

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

export const buildZkValidationData = (proof: OidcZkProofInput) => {
    return ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(tuple(bytes32, string, bytes32, bytes), bytes32, bytes)"],
        [
            [
                [
                    proof.jwt.kidSha256,
                    proof.jwt.iat,
                    proof.jwt.jwtHeaderAndPayloadHash,
                    proof.jwt.jwtSignature
                ],
                proof.circuitDigest,
                proof.proof
            ]
        ]
    );
}

export async function buildAdminCallUserOp(
    chain: Chain,
    sender: OpenId3Account,
    proof: OidcZkProofInput,
    callData: string,
    paymasterAndData?: string,
) {
    let userOp = await genUserOp(
        chain, sender, callData, paymasterAndData ?? "0x");
    userOp = await updateGasEstimation(chain, userOp);
    const userOpHash = await genUserOpHash(chain, userOp);
    const validationData = buildZkValidationData(proof);
    userOp.signature = ethers.solidityPacked(["uint8", "bytes"], [1, validationData]);
    return {userOp, userOpHash};
}

export async function buildOperatorCallUserOp(
    chain: Chain,
    sender: OpenId3Account,
    operator: ethers.Signer,
    callData: string,
    paymasterAndData?: string,
) {
    let userOp = await genUserOp(
        chain, sender, callData, paymasterAndData ?? "0x");
    userOp = await updateGasEstimation(chain, userOp);
    const userOpHash = await genUserOpHash(chain, userOp);
    const signature = await operator.signMessage(ethers.getBytes(userOpHash));
    userOp.signature = ethers.solidityPacked(["uint8", "bytes"], [1, signature]);
    return {userOp, userOpHash};
}

export async function buildAdminCallResetOperatorUserOp(
    chain: Chain,
    sender: string,
    proof: OidcZkProofInput,
    newOperator: string,
    paymasterAndData?: string,
) {
    const account = OpenId3Account__factory.connect(
        sender, getWeb3Provider(chain));
    const callData = account.interface.encodeFunctionData(
        "setOperator", [newOperator]);
    return await buildAdminCallUserOp(
        chain, account, proof, callData, paymasterAndData ?? "0x");
}
