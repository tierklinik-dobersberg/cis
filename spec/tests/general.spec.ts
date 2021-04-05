import axios, { AxiosError } from 'axios';

describe("CIS service", () => {
    it("should be reachable and require auth", async () => {
        try {
            await axios.get('http://localhost:3000/api/identity/v1/profile')
        } catch (err: any) {
            expect((err as AxiosError<any>).response.status).toBe(401);
        }
    })
})