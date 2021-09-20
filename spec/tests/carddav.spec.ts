import { Alice } from '../utils';

describe("CardDAV", () => {
    describe("importing customer data", () => {
        it("should have imported 2 contacts", async () => {
            const response = await Alice.post("http://localhost:3000/api/customer/v1/search", { "customerSource": "carddav" })
            expect(response.status).toBe(200);
            expect(response.data).toHaveSize(2);
        })
    })
})