import axios, { AxiosResponse } from 'axios';
import { Alice } from '../utils';

const InlineMailTemplateTrigger = "test-mail-inline"
const FileMailTemplateTrigger = "test-mail-file"

async function getMails(): Promise<AxiosResponse<any[]>> {
    return axios.get(`http://localhost:8092/api/emails`, {
        auth: {
            password: "mailpass",
            username: "mailuser",
        }
    })
}

describe("Triggers", () => {
    describe("Mail action", () => {
        beforeEach(async () => {
            await axios.delete("http://localhost:8092/api/emails", {
                auth: {
                    password: "mailpass",
                    username: "mailuser",
                }
            })
        })

        it("should send a To and CC mails when triggered using inline-template", async () => {
            const response = await
                Alice.post(`http://localhost:3000/api/triggers/v1/instance/${InlineMailTemplateTrigger}`);
            expect(response.status).toBe(202);

            const mails = await getMails()
            expect(mails.status).toBe(200);
            expect(mails.data).toBeDefined()
            const m = mails.data.filter(m => m.subject === "Test Email");
            expect(m).toBeDefined()

            // NOTE(ppacher): the fake-smtp-server we're using for tests here does not
            // support multiple RCPT-TO SMTP commands and thus, the mail is only "sent" to
            // the "To" header field and not to Cc or Bcc.
            // We cannot test that behavior with fake-smtp-server here ...
            expect(m.length).toBe(1)
            expect(m[0].text).toBe("Test Inline Template\n")
        })

        it("should send a To and CC mails when triggered using inline-template", async () => {
            const response = await
                Alice.post(`http://localhost:3000/api/triggers/v1/instance/${FileMailTemplateTrigger}`);
            expect(response.status).toBe(202);

            const mails = await getMails()
            expect(mails.status).toBe(200);
            expect(mails.data).toBeDefined()
            const m = mails.data.filter(m => m.subject === "Test Email");
            expect(m).toBeDefined()

            // NOTE(ppacher): the fake-smtp-server we're using for tests here does not
            // support multiple RCPT-TO SMTP commands and thus, the mail is only "sent" to
            // the "To" header field and not to Cc or Bcc.
            // We cannot test that behavior with fake-smtp-server here ...
            expect(m.length).toBe(1)
            expect(m[0].text).toBe("Test File Template\n")
        })
    })
})