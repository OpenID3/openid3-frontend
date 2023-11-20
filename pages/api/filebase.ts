import axios from "axios";

const callFirebaseFunction = async (
        func: string,
        data: any,
        token
            ?: string
    ) => {

        let url = "https://us-central1-openid3-bbd1b.cloudfunctions.net/" + func;
        const config = token ? {headers: {authorization: "Bearer " + token}} : {};
        return axios.post(url, data, config);
    }
;

export {
    callFirebaseFunction
}
