import {signIn, signOut, useSession} from "next-auth/react";
import {Button, Layout, Link, Page, Text} from "@vercel/examples-ui";
import Image from "next/image";
import {getKey} from "../lib/test-eth.js"
import iconMain from "../public/icons/icon.svg"
import iconEthSvg from "../public/icons/eth.svg"
import iconUSDC from "../public/icons/usdc.svg"
import iconEthPng from "../public/icons/eth.png"
import {useEffect, useState} from "react";
import queryString from "query-string";
import * as oauth2 from "oauth4webapi";
import config from "./config";
import axios from "axios";
import {jwtDecode} from "jwt-decode";
import {buildAdminCallResetOperatorUserOp, getWeb3Provider} from "./api/zkp/userop";
import {getAuth, signInWithCredential, signInWithRedirect, GoogleAuthProvider} from "@firebase/auth";
import {app} from "./filebase"
import {UserCredential} from "@firebase/auth";
import {callFirebaseFunction} from "./api/filebase";
import {getAccountInfo} from "./api/zkp/account";
import {SEPOLIA} from "./api/zkp/constants";
import {sha256, keccak256, toUtf8Bytes} from "ethers";

interface Operational {
    privateKey: string
    address: string
}

const lsKey = "operation-key"

function getOperator(): Operational {
    let operator = getKey();
    localStorage.clear()
    localStorage.setItem(lsKey, JSON.stringify(operator));
    return operator
}

async function handleCredentialResponse(idToken: string): string {
    // Build Firebase credential with the Google ID token.
    const credential = GoogleAuthProvider.credential(idToken);

    // Sign in with credential from the Google user.
    const auth = getAuth(app);

    try {
        const res: UserCredential = await signInWithCredential(auth, credential)
        return res.user.accessToken
    } catch (err: any) {
        const errorCode = err.code;
        const errorMessage = err.message;
        // The email of the user's account used.
        const email = err.email;
        // The credential that was used.
        const credential = GoogleAuthProvider.credentialFromError(err);
    }
    //     .then((userCredential: UserCredential) => {
    //     const at = userCredential.user.accessToken
    //     setAccessToken(at)
    //
    //
    //     // TODO: move this block to the outside
    //     // then use above data to initiate a firebase login

    //         .then(res => {
    //
    //         })
    //         .catch(err => {
    //
    //         })
    //
    // }).catch((error: any) => {
    //
    // });
}

function handleLogin(operator: Operational, setOperator: Function) {
    return async function () {

        const queryIdToken = queryString.stringify({
            client_id: config.clientId,
            redirect_uri: config.redirectUri,
            scope: config.scopes,
            state: oauth2.generateRandomState(),
            response_type: "id_token",
            //     nonce: oauth2.generateRandomNonce().
            //     Following is a hardcode, it showcases that we can replace it with any value.
            nonce: 'A9GwX3CyLQ73F9xYDnaJKIvsrF98uFnQQuSZL-PJ3mE',
            prompt: "consent",
        });
        localStorage.clear()

        setOperator(getOperator())

        window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${queryIdToken}`;
    }
}

export default function Home() {
    const {data, status} = useSession();

    // session state
    const [jwt, setJWT] = useState({});
    const [loading, setLoading] = useState(true);

    const [operator, setOperator] = useState({})
    const [loginResponse, setLoginResponse] = useState({})

    // when page is loaded
    useEffect(() => {
        // use this self-invoking function to embrace async-await
        (async () => {
            let temp = {}
            setOperator(getOperator)

            // means we have logged in
            if (window.location.hash) {
                const parsed = queryString.parse(location.hash) || "";
                const idToken = parsed.id_token
                const fbAccessToken = await handleCredentialResponse(idToken)

                setLoginResponse(parsed)

                if (parsed.access_token) {
                    const res = await axios
                        .get("https://www.googleapis.com/oauth2/v2/userinfo", {
                            params: {
                                access_token: parsed.access_token,
                            },
                        })
                    setJWT(JSON.stringify(res.data, null, 4));
                } else if (parsed.id_token) {
                    const decoded = jwtDecode(parsed.id_token as string);
                    temp = decoded
                    setJWT(decoded);
                }

                // start firebase login
                try {

                    setLoading(true)

                    // arguments
                    const address = keccak256(toUtf8Bytes(temp.sub))
                    // TODO: currently broken, to be fixed
                    const accountInfo = await getAccountInfo(SEPOLIA, address);
                    const accountAddress = accountInfo.address;
                    const newOperatorAddress = operator.address;
                    const userOp = await buildAdminCallResetOperatorUserOp(
                        SEPOLIA, accountAddress, newOperatorAddress,
                    );

                    const fbRes = await callFirebaseFunction(
                        "requestToReset",
                        {
                            provider: "google",
                            id_token: idToken,
                            chain: SEPOLIA,
                            dev: true,
                            userOp,
                        },
                        fbAccessToken,
                    )
                    console.log(1234567, fbRes)
                } catch (e) {
                    throw e
                }
            }
        })()
    }, [])

    return (
        <Page className="grid grid-cols-12 lg:max-w-screen-xl">
            <section className="col-span-9 lg:mx-20">
                <section className="flex justify-between">
                    <section className="flex gap-3 items-center">
                        <Image src={iconMain} alt="home icon"/>
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
                            <Image width={25} src={iconEthPng} alt="Ethereum Goerli"/>
                            <p className="text-lg">Ethereum Goerli</p>
                        </section>
                    </section>

                    <hr className="border-t border-accents-2 my-4"/>

                    <section className="flex items-center justify-between my-6">
                        <section className="flex items-center gap-3">
                            <Image width={35} src={iconEthSvg} alt="Ethereum"/>
                            <p> ETH </p>
                        </section>
                        <section className="flex flex-col items-end">
                            <p className="font-semibold">$0</p>
                            <p className="text-gray-500">ETH 0</p>
                        </section>
                    </section>

                    <section className="flex items-center justify-between my-6">
                        <section className="flex items-center gap-3">
                            <Image width={35} src={iconUSDC} alt="home icon"/>
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
                    <hr className="border-t border-accents-2 my-4"/>

                    <section className="flex items-center justify-between">
                        <section>
                            <section className="my-6">
                                <p className="text-lg font-semibold">Account Address</p>
                                <p className="font-light text-gray-500">0x0576a174D229E3cFA37253523E645A78A0C91B59</p>
                            </section>

                            <section className="my-10">
                                <p className="text-lg font-semibold">Local Operation Key</p>
                                <p className="font-light text-gray-500">{operator.privateKey}</p>
                            </section>

                            <section className="my-10">
                                <p className="text-lg font-semibold">UserID (Your Google account hash)</p>
                                <p className="font-light text-gray-500">0x0576a174D229E3cFA37253523E645A78A0C91B59</p>
                            </section>
                        </section>

                        <Button disabled={loading} variant="primary" onClick={handleLogin(operator, setOperator)}>
                            {!loading ? 'Reset' : 'ZKP Calculating'}
                        </Button>
                    </section>
                </section>

                <section className="hidden">
                    <section className="flex flex-row gap-6">
                        <Link href="pkce">PKCE Flow</Link>
                        <Link href="implicit">Implicit Flow</Link>
                    </section>

                    <hr className="border-t border-accents-2 my-6"/>

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
