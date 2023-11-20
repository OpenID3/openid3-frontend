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
import { UserOperationStruct, buildAdminCallResetOperatorUserOp } from "./api/zkp/userop";
import { getAuth, signInWithCredential, GoogleAuthProvider } from "@firebase/auth";
import { app } from "./filebase"
import { UserCredential } from "@firebase/auth";
import { callFirebaseFunction } from "./api/filebase";
import { getAccountInfo } from "./api/zkp/account";
import { SEPOLIA } from "./api/zkp/constants";
import { ethers, keccak256, toUtf8Bytes } from "ethers";
import { useRequest } from 'ahooks'
import { BounceLoader } from 'react-spinners'
import * as web3 from 'web3';

interface Operational {
    privateKey: string
    address: string
}

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

    // session state
    const [jwt, setJWT] = useState<{sub: string}>({sub: ""});
    const [isCalculating, setIsCalculating] = useState(false);

    const [accountInfo, setAccountInfo] = useState<{
        address: string,
        deployed: boolean,
        initCode: string,
        operator: string,
        accountHash: string,
    }>({
        address: ethers.ZeroAddress,
        deployed: false,
        initCode: "0x",
        accountHash: "0x",
        operator: ethers.ZeroAddress,
    });
    const [userOp, setUserOp] = useState<{
        userOp?: UserOperationStruct,
        userOpHash?: string
    }>({})
    const [operator, setOperator] = useState<web3.eth.accounts.Web3Account | null>(null);
    const [_loginResponse, setLoginResponse] = useState({})

    async function handleLogin() {
        setOperator(getOperator());
        const queryIdToken = queryString.stringify({
            client_id: config.clientId,
            redirect_uri: config.redirectUri,
            scope: config.scopes,
            state: oauth2.generateRandomState(),
            response_type: "id_token",
            nonce: userOp.userOpHash!.slice(2),
            prompt: "consent",
        });
        localStorage.removeItem(lsKey)
        window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${queryIdToken}`;
    }

    // when page is loaded
    useEffect(() => {
        // use this self-invoking function to embrace async-await
        (async () => {
            setOperator(getOperator)
            if (window.location.hash) {
                const parsed = queryString.parse(location.hash) || "";
                const fbAccessToken = await handleCredentialResponse(parsed.id_token as string)
                setLoginResponse(parsed)
                setJWT(jwtDecode(parsed.id_token as string));
                try {
                    const address = keccak256(toUtf8Bytes(jwt.sub))
                    const accountInfo = await getAccountInfo(SEPOLIA, address);
                    setAccountInfo(accountInfo);
                    const newOperatorAddress = operator!.address;
                    const userOp = await buildAdminCallResetOperatorUserOp(
                        SEPOLIA,
                        accountInfo.address,
                        accountInfo.initCode,
                        newOperatorAddress,
                    );
                    setUserOp(userOp);
                    const fbRes = await callFirebaseFunction(
                        "requestToReset",
                        {
                            provider: "google",
                            id_token: parsed.id_token,
                            chain: SEPOLIA,
                            dev: true,
                            userOp,
                        },
                        fbAccessToken,
                    )
                    setIsCalculating(true)
                    localStorage.setItem('isCalculate', 'true')
                    console.log(1234567, fbRes)
                } catch (e) {
                    throw e
                } finally {
                    setIsCalculating(false)
                    localStorage.setItem('isCalculate', 'false')
                }
            }
        })()
    }, [jwt.sub, operator])

    useEffect(() => {
        const _isCalculating = localStorage.getItem('isCalculating')
        if (_isCalculating === 'true') {
            setIsCalculating(true)
        }
    }, []);

    async function callFunction2() {
        console.log('calling')
        // mock call
        if (Date.now() > 1700594759838) {
            // if success cancel polling
            setIsCalculating(false)
            localStorage.removeItem('isCalculating')
        } else {
            console.log("polling")
            throw new Error('polling')
            // call function2
        }
    }

    function stopLoading() {
        setIsCalculating(false)
        localStorage.removeItem('isCalculating')
    }

    function startLoading() {
        setIsCalculating(true)
        localStorage.setItem('isCalculating', 'true')
    }
    
    useRequest(callFunction2, {
        pollingInterval: 2000,
        ready: isCalculating ,
    });

    function handleClick() {
        startLoading();
        handleLogin();
    }

    return (
        <Page className="grid grid-cols-12 lg:max-w-screen-xl">
            <section className="col-span-9 lg:mx-20">
                <section className="flex justify-between">
                    <section className="flex gap-3 items-center">
                        <Image src={iconMain} alt="home icon" />
                        <p className="text-xl font-semibold"> Openid3 </p>
                    </section>
                    <button className="font-semibold text-gray-400">
                        Sign Out
                    </button>
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
                            <p className="font-semibold">$0</p>
                            <p className="text-gray-500">ETH 0</p>
                        </section>
                    </section>

                    <section className="flex items-center justify-between my-6">
                        <section className="flex items-center gap-3">
                            <Image width={35} src={iconUSDC} alt="home icon" />
                            <p> USDC </p>
                        </section>
                        <section className="flex flex-col items-end">
                            <p className="font-semibold">$0</p>
                            <p className="text-gray-500">USDC 0</p>
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
                                <p className="font-light text-gray-500">{accountInfo.address}</p>
                            </section>

                            <section className="my-10">
                                <p className="text-lg font-semibold">Local Operation Key</p>
                                <p className="font-light text-gray-500">{accountInfo.operator}</p>
                            </section>

                            <section className="my-10">
                                <p className="text-lg font-semibold">UserID (Your Google account hash)</p>
                                <p className="font-light text-gray-500">{accountInfo.accountHash}</p>
                            </section>
                        </section>

                        <Button disabled={isCalculating} variant="primary" onClick={handleClick}>
                            {!isCalculating ? <span>Reset</span> : <div className="flex justify-center items-center">ZKP Calculating &nbsp;<BounceLoader size={12} color="#fff" /></div>}
                        </Button>
                        {
                            isCalculating &&  <Button  className="" variant="secondary" onClick={stopLoading}>
                                Stop
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
