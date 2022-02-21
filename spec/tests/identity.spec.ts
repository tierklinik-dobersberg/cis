import { Cookie, parse as parseCookie } from "set-cookie-parser";
import { Alice, Unauth } from "../utils";

describe("The Identity API:", () => {
  describe("Login and logout", () => {
    let accessToken: string | null = null;
    let refreshCookie: Cookie;

    it("should work as alice", async () => {
      const response = await Unauth.post("/api/identity/v1/login", {
        username: "alice",
        password: "password",
      });
      expect(response).toBeDefined();
      expect(response.data.token).toBeTruthy();
      expect(response.headers["set-cookie"]).toBeTruthy();

      accessToken = response.data.token;
      let cookies = parseCookie(response.headers["set-cookie"] as string[]);
      refreshCookie = cookies.find((cookie) => cookie.name === "cis-refresh");

      expect(refreshCookie).toBeTruthy();
      // refresh cookie MUST be scoped to the exact refresh endpoint
      expect(refreshCookie.path).toBe("/api/identity/v1/refresh");
    });

    it("should not work for disabled uesrs", async () => {
      const response = await Unauth.post("/api/identity/v1/login", {
        username: "diser",
        password: "password",
      });

      expect(response.status).toBe(401);
    });

    it("should issue a new access token on refresh", async () => {
      const response = await Unauth.post("/api/identity/v1/refresh", null, {
        headers: {
          Cookie: `${refreshCookie.name}=${refreshCookie.value}`,
        },
      });
      expect(response).toBeDefined();
      expect(response.status).toBe(200);
      expect(response.data.token).toBeTruthy();
    });

    it("should clear session and refresh token on logout", async () => {
      const response = await Unauth.post("/api/identity/v1/logout", null, {
        headers: {
          Cookie: `cis-session=${accessToken}`,
        },
      });
      expect(response).toBeDefined();
      expect(response.status).toBe(204);
      const headers = parseCookie(response.headers["set-cookie"]);
      expect(headers).toContain({
        name: "cis-session",
        domain: "localhost",
        path: "/",
        value: "",
        maxAge: 0,
      });
      expect(headers).toContain({
        name: "cis-refresh",
        domain: "localhost",
        path: "/api/identity/v1/refresh",
        value: "",
        maxAge: 0,
      });
    });

    describe("autologin", () => {
      describe("using ConditionAccessToken", () => {
        it("should support basic auth", async () => {
          const response = await Unauth.get("/api/identity/v1/profile", {
            headers: {
              Authorization: `Basic ${btoa(":test-token")}`,
            },
          });
          expect(response.status).toBe(200, response.data);
          response.data.roles.sort();
          expect(response.data).toEqual({
            name: "guest",
            fullname: "guest user",
            mail: null,
            phoneNumbers: null,
            roles: ["Service Account", "intern"],
            properties: {},
            needsPasswordChange: true,
          });
        });

        it("should support query parameter", async () => {
          const response = await Unauth.get(
            "/api/identity/v1/profile?access_token=test-token"
          );
          expect(response.status).toBe(200, response.data);
          expect(response.data).toEqual({
            name: "guest",
            fullname: "guest user",
            mail: null,
            phoneNumbers: null,
            roles: ["Service Account", "intern"],
            properties: {},
            needsPasswordChange: true,
          });
        });

        it("should verify the token", async () => {
          const response = await Unauth.get(
            "/api/identity/v1/profile?access_token=test-token1"
          );
          expect(response.status).toBe(401, response.data);
        });
      });
    });
  });

  describe("a logged in user", () => {
    it("should be able to see all users", async () => {
      const response = await Alice.get("/api/identity/v1/users");
      expect(response).toBeDefined();
      expect(response.status).toBe(200);
      expect(response.data).toContain({
        name: "guest",
        fullname: "guest user",
        mail: null,
        phoneNumbers: null,
        roles: ["Service Account"],
        properties: {},
        needsPasswordChange: true,
      });
      expect(response.data).toContain({
        name: "alice",
        fullname: "Alice Musterfrau",
        mail: ["alice@example.at", "alice@example.com"],
        phoneNumbers: ["+4312345678", "+2812345"],
        roles: ["default-role", "doctor"],
        properties: { PhoneExtension: "10" },
        calendarID: "primary",
        color: "#1b7550b9",
      });
      expect(response.data).toContain({
        name: "bob",
        fullname: "Bob Mustermann",
        mail: ["bob@example.com"],
        phoneNumbers: null,
        roles: ["default-role"],
        properties: { PhoneExtension: "12" },
        color: "#ddb0b0",
        needsPasswordChange: true,
      });
      expect(response.data).toContain({
        name: "diser",
        fullname: "Disabled user",
        mail: null,
        phoneNumbers: null,
        roles: ["default-role"],
        properties: { PhoneExtension: "13" },
        color: "#1b7550b9",
        disabled: true,
        needsPasswordChange: true,
      });
    });

    it("should be able to access user avatars", async () => {
      const response = await Alice.get("/api/identity/v1/avatar/bob");
      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toEqual("image/png");
    });

    it("should have access to his own profile", async () => {
      const response = await Alice.get("/api/identity/v1/profile");
      expect(response.status).toBe(200);
      expect(response.data).toEqual({
        name: "alice",
        fullname: "Alice Musterfrau",
        mail: ["alice@example.at", "alice@example.com"],
        phoneNumbers: ["+4312345678", "+2812345"],
        roles: ["default-role", "doctor"],
        calendarID: "primary",
        properties: {
          PhoneExtension: "10",
          PrivateProperty: "some-secret-value",
        },
        color: "#1b7550b9",
      });
    });

    describe("trying to change their password", () => {
      it("should work", async () => {
        const response = await Alice.put("/api/identity/v1/profile/password", {
          current: "password",
          newPassword: "test",
        });
        expect(response).toBeDefined();
        expect(response.status).toBe(204);

        const loginResponse = await Unauth.post("/api/identity/v1/login", {
          username: "alice",
          password: "test",
        });
        expect(loginResponse.status).toBe(200);
        expect(loginResponse.data.token).toBeTruthy();

        const responseReset = await Alice.put(
          "/api/identity/v1/profile/password",
          {
            current: "test",
            newPassword: "password",
          }
        );
        expect(responseReset).toBeDefined();
        expect(responseReset.status).toBe(204);
      });

      it("should fail if the current password is wrong", async () => {
        const response = await Alice.put("/api/identity/v1/profile/password", {
          current: "wrong-password",
          newPassword: "silly-password",
        });
        expect(response.status).toBe(400);
      });

      it("should fail if the current password is unset", async () => {
        const response = await Alice.put("/api/identity/v1/profile/password", {
          current: "",
          newPassword: "silly-password",
        });
        expect(response.status).toBe(400);
      });

      it("should fail if the new password is unset", async () => {
        const response = await Alice.put("/api/identity/v1/profile/password", {
          current: "password",
          newPassword: "",
        });
        expect(response.status).toBe(400);
      });
    });
  });

  describe("user, role and permissions management", () => {
    const lucy = {
      name: "lucy",
      fullname: "Test User",
      mail: ["lucy@example.com"],
      phoneNumbers: ["+123123123"],
      roles: ["intern"],
      properties: {
        PhoneExtension: 100,
      },
    };
    let lucyPassword = "";
    let userPermId = "";

    it("should be possible to get user details", async () => {
      const response = await Alice.get("/api/identity/v1/users/alice");
      expect(response.status).toBe(200, response.data);
      // delete the ID property form all permissions
      response.data.permissions.forEach((p: any) => delete p["id"]);

      expect(response.data).toEqual({
        name: "alice",
        fullname: "Alice Musterfrau",
        mail: ["alice@example.at", "alice@example.com"],
        phoneNumbers: ["+4312345678", "+2812345"],
        roles: ["default-role", "doctor"],
        calendarID: "primary",
        properties: {
          PhoneExtension: "10",
        },
        color: "#1b7550b9",
        permissions: [
          {
            description: "Alice can do everything",
            resources: [".*"],
            effect: "allow",
            actions: [".*"],
          },
        ],
      });
    });

    it("should be possible to create a new user", async () => {
      const response = await Alice.post("/api/identity/v1/users/lucy", lucy);
      expect(response.status).toBe(200, response.data);
      expect(response.data.password).toBeTruthy();
      lucyPassword = response.data.password;

      const user = await Alice.get("/api/identity/v1/users/lucy");
      expect(user.status).toBe(200, user.data);
      expect(user.data).toEqual({
        ...lucy,
        needsPasswordChange: true,
        permissions: null,
      });
    });

    it("should be possible to log in using lucy", async () => {
      const response = await Alice.post("/api/identity/v1/login", {
        username: "lucy",
        password: lucyPassword,
      });
      expect(response.status).toBe(200);
      expect(response.data.token).toBeTruthy();
      expect(response.headers["set-cookie"]).toBeTruthy();
    });

    it("should be possible to add a permission to the user", async () => {
      let perm = {
        description: "Test User Permission",
        effect: "allow",
        resources: [".*"],
        actions: [".*:(read|list)"],
      };
      const response = await Alice.post(
        "/api/identity/v1/permissions/users/lucy",
        perm
      );
      expect(response.status).toBe(200, response.data);
      expect(response.data.id).toBeTruthy();
      userPermId = response.data.id;

      const user = await Alice.get("/api/identity/v1/users/lucy");
      expect(user.status).toBe(200, user.data);
      expect(user.data.permissions).toEqual([
        {
          ...perm,
          id: userPermId,
        },
      ]);
    });

    it("should be possible to remove a permission from a user", async () => {
      const response = await Alice.delete(
        `/api/identity/v1/permissions/users/lucy/${userPermId}`
      );
      expect(response.status).toBe(204, response.data);

      const user = await Alice.get("/api/identity/v1/users/lucy");
      expect(user.status).toBe(200, user.data);
      expect(user.data.permissions).toBeNull();
    });

    it("should be possible to create a role", async () => {
      let role = {
        name: "write-access",
        description: "A test role at allows write-only access to everything",
      };
      const response = await Alice.post(
        "/api/identity/v1/roles/write-access",
        role
      );
      expect(response.status).toBe(204, response.data);

      const roleResponse = await Alice.get(
        "/api/identity/v1/roles/write-access"
      );
      expect(roleResponse.status).toEqual(200, roleResponse.data);
      expect(roleResponse.data).toEqual({
        ...role,
        permissions: null,
      });
    });

    let rolePermId = "";
    it("should be possible to add a permission to a role", async () => {
      let perm = {
        description: "Test Role Permission",
        effect: "allow",
        resources: [".*"],
        actions: [".*:write"],
      };
      const response = await Alice.post(
        "/api/identity/v1/permissions/roles/write-access",
        perm
      );
      expect(response.status).toBe(200, response.data);
      expect(response.data.id).toBeTruthy();
      rolePermId = response.data.id;

      const role = await Alice.get("/api/identity/v1/roles/write-access");
      expect(role.status).toBe(200, role.data);
      expect(role.data).toEqual({
        name: "write-access",
        description: "A test role at allows write-only access to everything",
        permissions: [
          {
            id: rolePermId,
            description: "Test Role Permission",
            effect: "allow",
            resources: [".*"],
            actions: [".*:write"],
          },
        ],
      });
    });

    it("should be possible to remove a permission from a role", async () => {
      const response = await Alice.delete(
        `/api/identity/v1/permissions/roles/write-access/${rolePermId}`
      );
      expect(response.status).toBe(204, response.data);

      const role = await Alice.get("/api/identity/v1/roles/write-access");
      expect(role.status).toBe(200, role.data);
      expect(role.data.permissions).toBeNull();
    });

    it("should be possible to assign a role to a user", async () => {
      const response = await Alice.put(
        "/api/identity/v1/users/lucy/roles/write-access"
      );
      expect(response.status).toBe(204, response.data);

      const user = await Alice.get("/api/identity/v1/users/lucy");
      expect(user.status).toBe(200, user.data);
      expect(user.data).toEqual({
        ...lucy,
        needsPasswordChange: true,
        permissions: null,
        roles: [...lucy.roles, "write-access"],
      });
    });

    it("should be possible to unassign a role from a user", async () => {
      const response = await Alice.delete(
        "/api/identity/v1/users/lucy/roles/write-access"
      );
      expect(response.status).toBe(204, response.data);

      const user = await Alice.get("/api/identity/v1/users/lucy");
      expect(user.status).toBe(200, user.data);
      expect(user.data).toEqual({
        ...lucy,
        needsPasswordChange: true,
        permissions: null,
      });
    });

    it("should be possible to remove a role", async () => {
      const response = await Alice.delete(
        "/api/identity/v1/roles/write-access"
      );
      expect(response.status).toBe(204);

      const role = await Alice.get("/api/identity/v1/roles/write-access");
      expect(role.status).toBe(404, role.data);
    });

    // TODO(ppacher): test disabling/deleting a user
  });
});
