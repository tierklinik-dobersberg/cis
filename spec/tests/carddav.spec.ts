import { AxiosResponse } from 'axios';
import { Alice } from '../utils';

describe("CardDAV", () => {
    describe("importing customer data", () => {
        it("should have imported 2 contacts", async () => {
            const response = await Alice.post("http://localhost:3000/api/customer/v1/search", { "customerSource": "carddav" })
            expect(response.status).toBe(200);
            expect(response.data).toHaveSize(2);
        })

        it("should be able to find Max by phone number using +43", async () => {
            const response = await Alice.get("http://localhost:3000/api/customer/v1?phone=%2B4312341234")
            expect(response.status).toBe(200);
            expect(response.data).toHaveSize(1);
        })

        it("should be able to find Max by phone number using 00", async () => {
            const response = await Alice.get("http://localhost:3000/api/customer/v1?phone=004312341234")
            expect(response.status).toBe(200);
            expect(response.data).toHaveSize(1);
        })
    })

    describe("should support deleting customers", async () => {
        let max: string = "";

        beforeAll(async () => {
            const response = await Alice.get("http://localhost:3000/api/customer/v1?phone=004312341234")
            expect(response.status).toBe(200);
            expect(response.data).toHaveSize(1);
            max = response.data[0].cid
        })


        it("should work via api", async () => {
            const response = await Alice.delete(`http://localhost:3000/api/customer/v1/carddav/${max}`)
            expect(response.status).toBe(200);
        })

        it("should not return max anymore", async () => {
            const response = await Alice.get(`http://localhost:3000/api/customer/v1/carddav/${max}`).catch(err => err.response as AxiosResponse)
            expect(response.status).toBe(404);
        })

        // TODO(ppacher): verify that max has been deleted from carddav/radicale
    })
})