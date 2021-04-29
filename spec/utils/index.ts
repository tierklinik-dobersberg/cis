import axios, { AxiosInstance } from "axios";

beforeAll(async () => {
    // Don't do anything if Alice is already initialized.
    if (!!Alice) {
        return;
    }

    let response = await axios.post("http://localhost:3000/api/identity/v1/login", {
        username: "alice",
        password: "password",
    })
    Alice = axios.create({
        headers: {
            'Cookie': `cis-session=${response.data.token}`
        }
    })
})


export let Alice: AxiosInstance;