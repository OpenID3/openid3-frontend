import { signIn, signOut, useSession } from "next-auth/react";
import { Button, Layout, Link, Page, Text } from "@vercel/examples-ui";
import Image from "next/image";
import { getKey } from "../lib/test-eth.js"
import iconMain from "../public/icons/icon.svg"
import iconEthSvg from "../public/icons/eth.svg"
import iconUSDC from "../public/icons/usdc.svg"
import iconEthPng from "../public/icons/eth.png"
import { useEffect, useState } from "react";
import queryString from "query-string";
import * as oauth2 from "oauth4webapi";
import config from "./config";
import { jwtDecode } from "jwt-decode";
import { buildAdminCallResetOperatorUserOp, getWeb3Provider } from "./api/zkp/userop";
import { getAuth, signInWithCredential, GoogleAuthProvider } from "@firebase/auth";
import { app } from "./filebase"
import { UserCredential } from "@firebase/auth";
import { callFirebaseFunction } from "./filebase";
import { getAccountInfo } from "./api/zkp/account";
import { SEPOLIA } from "./api/zkp/constants";
import { ethers, keccak256, toUtf8Bytes } from "ethers";
import { useRequest } from 'ahooks'
import { BounceLoader } from 'react-spinners'
import * as web3 from 'web3';
import { ZkpRequest, AuthState } from "./types";

const lsKey = "operation-key"

function getOperator(): web3.eth.accounts.Web3Account {
    let operator = getKey();
    localStorage.removeItem(lsKey)
    localStorage.setItem(lsKey, JSON.stringify(operator));
    return operator
}

async function handleCredentialResponse(idToken: string): Promise<string> {
    const credential = GoogleAuthProvider.credential(idToken);
    const auth = getAuth(app);
    try {
        const res: UserCredential = await signInWithCredential(auth, credential)
        return res.user.getIdToken();
    } catch (err: any) {
        console.log(err);
        throw new Error("failed to get id token of user");
    }
}

export default function Home() {
    const { data, status } = useSession();

    const [authState, setAuthState] =
        useState<AuthState>({status: "unauthenticated"});
    const [zkpRequest, setZkpRequest] =
        useState<ZkpRequest>({status: "idle"});

    const [idToken, setIdToken] = useState<string | null>(null);
    const [balance, setBalance] = useState<string | null>(null);

    useEffect(() => {
        const parsed = queryString.parse(location.hash) || {};
        if (parsed.id_token) {
            setIdToken(parsed.id_token as string);
        }
    }, [])

    // when page is loaded
    useEffect(() => {
        // use this self-invoking function to embrace async-await
        (async () => {
            if (!idToken) {
                return;
            }
            if (authState.status == "authenticated" && zkpRequest.status === "requesting") {
                // this means it's called before the redirect
                if (idToken === authState.idToken) {
                    return;
                }
                console.log("idToken to proof: ", idToken);
                await callFirebaseFunction(
                    "requestToReset",
                    {
                        provider: "google",
                        idToken,
                        chain: SEPOLIA,
                        dev: true,
                        userOp: zkpRequest.userOp,
                    },
                    authState.accessToken,
                );
                updateZkpRequest({
                    ...zkpRequest,
                    idToken,
                    status: "requested",
                });
            } else if (authState.status === "authenticating") {
                const accessToken = await handleCredentialResponse(idToken as string);
                const decoded = jwtDecode<{sub: string}>(idToken as string);
                updateAuth({
                    status: "authenticated",
                    sub: decoded.sub,
                    accessToken: accessToken,
                    idToken,
                });
            }
        })()
    }, [authState.status, zkpRequest.status, idToken]);

    useEffect(() => {
        if (authState.status === "authenticated" && authState.sub) {
            const key = authState.sub + "_zkp";
            const zkpRequest = localStorage.getItem(key);
            if (zkpRequest && zkpRequest.length > 0) {
                const request = JSON.parse(zkpRequest) as ZkpRequest;
                console.log("idToken to proof: ", request.idToken);
                setZkpRequest(request);
            }
        }
    }, [authState.status, authState.sub]);

    useEffect(() => {
        const auth = localStorage.getItem("auth");
        if (auth && auth.length > 0) {
            setAuthState(JSON.parse(auth) as AuthState)
        }
    }, []);

    useEffect(() => {
        (async () => {
            if (authState.status === "authenticated" && authState.sub) {
                const accountHash = keccak256(toUtf8Bytes(authState.sub!));
                const accountInfo = await getAccountInfo(SEPOLIA, accountHash);
                const provider = getWeb3Provider(SEPOLIA);
                const balance = await provider.getBalance(accountInfo.address);
                setBalance(ethers.formatEther(balance));
                updateAuth({
                    ...authState,
                    account: accountInfo,
                });
            }
        })()
    }, [authState.status, authState.sub]);

    function updateAuth(auth: AuthState) {
        setAuthState(auth);
        localStorage.setItem("auth", JSON.stringify(auth));
    }

    function updateZkpRequest(request: ZkpRequest) {
        setZkpRequest(request);
        const key = authState.sub + "_zkp";
        localStorage.setItem(key, JSON.stringify(request));
    }

    function stopCalculating() {
        updateZkpRequest({status: "idle"});
        window.location.href = "/";
    }

    useRequest(queryZkpStatus, {
        pollingInterval: 5000,
        ready: zkpRequest.status === "requested",
    });

    async function queryZkpStatus() {
        if (zkpRequest.status !== "requested") {
            return;
        }
        try {
            const res = await callFirebaseFunction(
                "queryResetStatus",
                {chain: SEPOLIA},
                authState.accessToken!,
            );
            if (res.data.status !== "processing") {
                stopCalculating();
            }
        } catch(err: any) {
            if (err.response.status === 404) {
                stopCalculating();
            } else {
                throw err;
            }
        }
    }

    async function handleLogin() {
        updateAuth({status: "authenticating"});
        await getGoogleIdToken(crypto.randomUUID());
    }

    async function handleReset() {
        if (zkpRequest.status !== "idle") {
            console.log("zkp in progress");
            return;
        }
        const operator = getOperator();
        const newOperatorAddress = operator!.address;
        const userOp = await buildAdminCallResetOperatorUserOp(
            SEPOLIA,
            authState.account!.address,
            authState.account!.initCode,
            newOperatorAddress,
        );
        updateZkpRequest({
            status: "requesting",
            userOp: userOp.userOp,
            userOpHash: userOp.userOpHash,
            operator,
        });
        await getGoogleIdToken(userOp.userOpHash!.slice(2));
    }

    async function handleLogout() {
        updateAuth({status: "unauthenticated"});
        window.location.href = "/";
    }

    async function getGoogleIdToken(nonce: string) {
        const queryIdToken = queryString.stringify({
            client_id: config.clientId,
            redirect_uri: config.redirectUri,
            scope: config.scopes,
            state: oauth2.generateRandomState(),
            response_type: "id_token",
            nonce,
            prompt: "consent",
        });
        localStorage.removeItem(lsKey);
        window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${queryIdToken}`;
    }

    return (
        <Page className="grid grid-cols-12 lg:max-w-screen-xl">
            <section className="col-span-9 lg:mx-20">
                <section className="flex justify-between">
                    <section className="flex gap-3 items-center">
                        <Image src={iconMain} alt="home icon" />
                        <p className="text-xl font-semibold"> Openid3 </p>
                    </section>
                    {
                        authState.status === "unauthenticated" && (
                            <Button variant="secondary" onClick={handleLogin}>
                                Sign In
                            </Button>
                        )
                    }
                    {
                        authState.status === "authenticating" && (
                            <Button disabled variant="secondary">
                                Signing In
                            </Button>
                        )
                    }
                    {
                        authState.status === "authenticated" && (
                            <Button variant="secondary" onClick={handleLogout}>
                                Sign Out
                            </Button>
                        )
                    }
                </section>

                <section className="my-20">
                    <section className="flex justify-between">
                        <p className="text-2xl font-semibold">Tokens</p>
                        <section className="flex items-center gap-1.5">
                            <Image width={25} src={iconEthPng} alt="Ethereum Goerli" />
                            <p className="text-lg">Ethereum Goerli</p>
                        </section>
                    </section>

                    <hr className="border-t border-accents-2 my-4" />

                    <section className="flex items-center justify-between my-6">
                        <section className="flex items-center gap-3">
                            <Image width={35} src={iconEthSvg} alt="Ethereum" />
                            <p> ETH </p>
                        </section>
                        <section className="flex flex-col items-end">
                            <p className="text-gray-500">{balance} ETH</p>
                        </section>
                    </section>

                    <section className="flex items-center justify-between my-6">
                        <section className="flex items-center gap-3">
                            <Image width={35} src={iconUSDC} alt="home icon" />
                            <p> USDC </p>
                        </section>
                        <section className="flex flex-col items-end">
                            <p className="text-gray-500">0 USDC</p>
                        </section>
                    </section>
                </section>

                <section className="my-10">
                    <p className="text-2xl font-semibold">AA Acount</p>
                    <hr className="border-t border-accents-2 my-4" />

                    <section className="flex items-center justify-between">
                        <section>
                            <section className="my-6">
                                <p className="text-lg font-semibold">Account Address</p>
                                <p className="font-light text-gray-500">{authState.account?.address ?? (
                                    authState.status == "unauthenticated" ? "please login first" : "loading account info"
                                )}</p>
                            </section>

                            <section className="my-10">
                                <p className="text-lg font-semibold">Local Operation Key</p>
                                <p className="font-light text-gray-500">{authState.account?.operator ?? (
                                    authState.status == "unauthenticated" ? "please login first" : "loading account info"
                                )}</p>
                            </section>

                            <section className="my-10">
                                <p className="text-lg font-semibold">UserID (Your Google account hash)</p>
                                <p className="font-light text-gray-500">{authState.account?.accountHash ?? (
                                    authState.status == "unauthenticated" ? "please login first" : "loading account info"
                                )}</p>
                            </section>
                        </section>
                        {
                            zkpRequest.status === "idle" && <Button
                                disabled={authState.status !== "authenticated"}
                                variant="primary"
                                onClick={handleReset}
                            >
                                <span>Reset</span>
                            </Button>
                        }
                        {
                            zkpRequest.status !== 'idle' &&
                                <Button
                                    disabled
                                    variant="primary"
                                >
                                    <div className="flex justify-center items-center">
                                        Calculating Zkp &nbsp;<BounceLoader size={12} color="#fff" />
                                    </div>
                                </Button>
                        }
                    </section>
                </section>

                <section className="hidden">
                    <section className="flex flex-row gap-6">
                        <Link href="pkce">PKCE Flow</Link>
                        <Link href="implicit">Implicit Flow</Link>
                    </section>

                    <hr className="border-t border-accents-2 my-6" />

                    <section className="flex flex-col gap-3">
                        {status === "authenticated" ? (
                            <section className="flex flex-col gap-3">
                                Welcome {data?.user?.name}!{" "}
                                <Button onClick={() => signOut()}>Sign out</Button>
                            </section>
                        ) : status === "loading" ? (
                            <section className="text-center">
                                <Text>Loading...</Text>
                            </section>
                        ) : (
                            <>
                                <section className="m-auto w-fit">
                                    <Button size="lg" onClick={() => signIn("github")}>
                                        Sign in with GitHub
                                    </Button>
                                </section>
                                <section className="m-auto w-fit">
                                    <Button size="lg" onClick={() => signIn("google")}>
                                        Sign in with Google
                                    </Button>
                                </section>
                            </>
                        )}
                    </section>
                </section>
            </section>
            <section className="py-12 px-8 flex flex-col justify-end text-white col-span-3 bg-accents-8">
                <section className="my-6">
                    <p className="font-semibold text-center my-3"> JWT </p>
                    <p className="text-gray-800 h-40 bg-gray-100 p-2">lorem ipsum</p>
                </section>

                <section className="my-3 flex">
                    <p className="w-28 text-xs">UserOp Hash</p>
                    <p className="h-6 flex-1 bg-gray-100"></p>
                </section>
                <section className="flex my-3">
                    <p className="w-28 text-xs">Issued at Time</p>
                    <p className="h-6 flex-1 bg-gray-100"></p>
                </section>
            </section>
        </Page>
    );
}

Home.Layout = Layout;
