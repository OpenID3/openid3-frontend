import { UserOperationStruct } from "./api/zkp/userop";

export interface AccountInfo {
    address: string,
    deployed: boolean,
    initCode: string,
    operator: string,
    accountHash: string,
}

export interface AuthState {
    status: "unauthenticated" | "authenticated" | "authenticating" ;
    sub?: string;
    accessToken?: string;
    idToken?: string;
    account?: AccountInfo;
}

export interface ZkpRequest {
    status: "requesting" | "requested" | "idle";
    idToken?: string;
    userOp?: UserOperationStruct;
    userOpHash?: string,
    operator?: any;
}