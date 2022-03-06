import { Alice, waitForEvent } from "../utils";

describe("CardDAV", () => {
  it("should not have a carddav config on start", async () => {
    const response = await Alice.get(`/api/config/v1/schema/CardDAV`);
    expect(response.status).toBe(200, "schema type should exist");
    expect(response.data).toBeDefined();
    expect(response.data.configs).toBeDefined();
    expect(typeof response.data).toEqual("object");
    expect(typeof response.data.configs).toEqual("object");
    expect(Object.keys(response.data.configs).length).toBe(0, response.data);
  });

  describe("creating a new source", () => {
    let sourceID: string = '';

    it("should return a warning in case of an error", async () => {
      const response = await Alice.post(`/api/config/v1/schema/CardDAV`, {
        config: {
          ID: "carddav-test",
          Source: "carddav",
          Schedule: "@every 10m",
          Server: "http://radicale:8091",
          AllowInsecure: true,
          User: "admin",
          Password: "wrong-password",
        },
      });

      expect(response.status).toBe(200);
      expect(response.data.id).toBeTruthy();
      expect(response.data.warning).toBeTruthy();

      sourceID = response.data.id;
    })

    it("should work and immediately start syncing", async () => {
      const importComplete = waitForEvent(
        Alice,
        "vet.dobersberg.cis/importer/done",
      );

      const response = await Alice.put(`/api/config/v1/schema/CardDAV/${sourceID}`, {
        config: {
          ID: "carddav-test",
          Source: "carddav",
          Schedule: "@every 10m",
          Server: "http://radicale:8091",
          AllowInsecure: true,
          User: "admin",
          Password: "password",
          // AddressBook is left empty on purpose because CIS should detect it
        },
      });

      expect(response.status).toBe(200);
      expect(response.data.id).toBeTruthy();
      expect(response.data.warning).toBeFalsy();

      // it should have detected the address book to use
      const updated = await Alice.get(
        `/api/config/v1/schema/CardDAV/${response.data.id}`
      );
      expect(updated.status).toBe(200);
      expect(updated.data.config).toBeDefined();
      expect(updated.data.config.AddressBook).toBeTruthy();
      delete updated.data.config["AddressBook"];
      expect(updated.data.config).toEqual({
        ID: "carddav-test",
        Source: "carddav",
        Schedule: "@every 10m",
        Server: "http://radicale:8091",
        AllowInsecure: true,
        User: "admin",
        Password: "password",
      });

      //
      // wait for the import to finish
      //
      try {
        await importComplete;
      } catch (err) {
        console.error(err.status, err.data);
        throw err;
      }
    })
  });

  it("should have imported 2 contacts", async () => {
    const response = await Alice.post("/api/customer/v1/search", {
      customerSource: "carddav",
    });
    expect(response.status).toBe(200, response.data);
    expect(response.data).toHaveSize(2);
  });

  it("should be able to find Max by phone number using +43", async () => {
    const response = await Alice.get("/api/customer/v1?phone=%2B4312341234");
    expect(response.status).toBe(200, response.data);
    expect(response.data).toHaveSize(1);
  });

  it("should be able to find Max by phone number using 00", async () => {
    const response = await Alice.get("/api/customer/v1?phone=004312341234");
    expect(response.status).toBe(200, response.data);
    expect(response.data).toHaveSize(1);
  });

  describe("should support deleting customers", async () => {
    let max: string = "";

    beforeAll(async () => {
      const response = await Alice.get("/api/customer/v1?phone=004312341234");
      expect(response.status).toBe(200, response.data);
      expect(response.data).toHaveSize(1);
      expect(response.data[0]).toBeTruthy();
      expect(response.data[0].cid).toBeTruthy();
      max = response.data[0].cid;
    });

    it("should work via api", async () => {
      const response = await Alice.delete(`/api/customer/v1/carddav/${max}`);
      expect(response.status).toBe(200, response.data);
    });

    it("should not return max anymore", async () => {
      const response = await Alice.get(`/api/customer/v1/carddav/${max}`);
      expect(response.status).toBe(404, response.data);
    });

    // TODO(ppacher): verify that max has been deleted from carddav/radicale
  });
});
