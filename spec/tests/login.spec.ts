import axios from 'axios';

describe("Logging into CIS", () => {
    let token: string | null = null;
    it("should work as alice", async () => {
        const response = await axios.post("http://localhost:3000/api/identity/v1/login", {
            username: "alice",
            password: "password"
        })
        expect(response).not.toBeNull()
        expect(response.data.token).toBeTruthy();

        token = response.data.token;
    })

    it("should pick existing session", async () => {
        const response = await axios.get("http://localhost:3000/api/identity/v1/profile", {
            headers: {
                "Authorization": `Bearer ${token}`,
            }
        })
        expect(response.status).toBe(200);
        expect(response.data.name).toBe("alice")
    })
})