import axios, { AxiosInstance } from "axios";

async function createSession(username: string, password: string): Promise<AxiosInstance> {
    let response = await axios.post("http://localhost:3000/api/identity/v1/login", {
        username,
        password,
    })
    return axios.create({
        headers: {
            'Cookie': `cis-session=${response.data.token}`
        }
    })
}

beforeAll(async () => {
    Alice = Alice || await createSession("alice", "password")
})

export let Alice: AxiosInstance;