import axios, { AxiosInstance } from "axios";

beforeAll(async () => {
    await waitForApi()

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

async function waitForApi(): Promise<void> {
    for (let i = 0; i < 10; i++) {
        try {
            await testAPI()
            return
        } catch (err) {
            console.log('Waiting ...')
        }
        await sleep(1000);
    }
    throw new Error('Timeout waiting for CIS to come online')
}

function sleep(timeout: number): Promise<void> {
    return new Promise<void>(resolve => {
        setTimeout(resolve, timeout)
    })
}

async function testAPI(): Promise<any> {
    const resp = await axios.get("http://localhost:3000/api")
        .catch(err => err.response)
    if (resp?.status !== 200) {
        throw new Error(`unexpected status ${resp.status}`)
    }
}

export let Alice: AxiosInstance;