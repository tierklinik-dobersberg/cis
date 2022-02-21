import axios, { AxiosResponse } from "axios";
import { Alice } from "../utils";

const InlineMailTemplateTrigger = "test-mail-inline";
const FileMailTemplateTrigger = "test-mail-file";

async function getMails(): Promise<AxiosResponse<any[]>> {
  return axios.get(`http://localhost:8092/api/emails`, {
    auth: {
      password: "mailpass",
      username: "mailuser",
    },
  });
}

describe("Triggers", () => {
  it("should support listing available triggers", async () => {
    // TODO(ppacher): add test case that trigger instances are filtered
    // based on permissions checks. I.e. add a user that only has access to one
    // following triggers.

    const response = await Alice.get("/api/triggers/v1");
    expect(response.status).toBe(200);
    expect(response.data).toEqual({
      instances: [
        {
          name: "test-mail-file",
          pending: false,
          groups: ["test-mail-file"],
        },
        {
          name: "test-mail-inline",
          pending: false,
          groups: ["test-mail-inline"],
        },
        {
          name: "test-mqtt",
          pending: false,
          groups: null,
        },
      ],
    });
  });

  describe("Mail action", () => {
    beforeEach(async () => {
      await axios.delete("http://localhost:8092/api/emails", {
        auth: {
          password: "mailpass",
          username: "mailuser",
        },
      });
    });

    it("should support defining a new mailer", async () => {
      const response = await Alice.post(`/api/config/v1/schema/Mailer`, {
        config: {
          Host: "smtp",
          Port: 1025,
          From: "noreply@example.com",
          AllowInsecure: true,
          UseSSL: false,
        },
      });
      expect(response.status).toBe(200);
      expect(response.data.id).toBeTruthy();
    });

    it("should send a To and CC mails when triggered using inline-template", async () => {
      const response = await Alice.post(
        `/api/triggers/v1/instance/${InlineMailTemplateTrigger}`
      );
      expect(response.status).toBe(202);

      const mails = await getMails();
      expect(mails.status).toBe(200);
      expect(mails.data).toBeDefined();
      const m = mails.data.filter((m) => m.subject === "Test Email");
      expect(m).toBeDefined();

      // NOTE(ppacher): the fake-smtp-server we're using for tests here does not
      // support multiple RCPT-TO SMTP commands and thus, the mail is only "sent" to
      // the "To" header field and not to Cc or Bcc.
      // We cannot test that behavior with fake-smtp-server here ...
      expect(m.length).toBe(1);
      expect(m[0].text).toBe("Test Inline Template\n");
    });

    it("should send a To and CC mails when triggered using inline-template", async () => {
      const response = await Alice.post(
        `/api/triggers/v1/instance/${FileMailTemplateTrigger}`
      );
      expect(response.status).toBe(202);

      const mails = await getMails();
      expect(mails.status).toBe(200);
      expect(mails.data).toBeDefined();
      const m = mails.data.filter((m) => m.subject === "Test Email");
      expect(m).toBeDefined();

      // NOTE(ppacher): the fake-smtp-server we're using for tests here does not
      // support multiple RCPT-TO SMTP commands and thus, the mail is only "sent" to
      // the "To" header field and not to Cc or Bcc.
      // We cannot test that behavior with fake-smtp-server here ...
      expect(m.length).toBe(1);
      expect(m[0].text).toBe("Test File Template\n");
    });
  });
});
