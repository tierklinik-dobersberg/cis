import axios, { AxiosInstance } from "axios";

async function createSession(username: string, password: string): Promise<AxiosInstance> {
    let response = await axios.post("http://localhost:3000/api/identity/v1/login", {
        username,
        password,
    })
    return axios.create({
        headers: {
            'Cookie': `cis-session=${response.data.token}`
        },
        baseURL: "http://localhost:3000"
    })
}

beforeAll(async () => {
    Alice = Alice || await createSession("alice", "password")
    Unauth = Unauth || axios.create({
        baseURL: "http://localhost:3000"
    })
})

export let Alice: AxiosInstance;
export let Unauth: AxiosInstance;