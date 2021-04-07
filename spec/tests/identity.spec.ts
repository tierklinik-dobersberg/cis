import axios from 'axios';
import { Cookie, parse as parseCookie } from 'set-cookie-parser';
import { Alice } from '../utils';

describe("The identity API", () => {
    it("should allow access to all members", async () => {
        const response = await Alice.get("http://localhost:3000/api/identity/v1/users")
        expect(response).toBeDefined()
        expect(response.status).toBe(200)
        expect(response.data).toContain(
            {
                "name": "guest",
                "fullname": "guest user",
                "mail": null,
                "phoneNumbers": null,
                "roles": ["Service Account"],
                "properties": {}
            })
        expect(response.data).toContain(
            {
                "name": "alice",
                "fullname": "Alice Musterfrau",
                "mail": ["alice@example.at", "alice@example.com"],
                "phoneNumbers": ["+4312345678", "+2812345"],
                "roles": ["default-role"],
                "properties": { "PhoneExtension": "10" },
                "color": "#1b7550b9"
            })
        expect(response.data).toContain(
            {
                "name": "bob",
                "fullname": "Bob Mustermann",
                "mail": ["bob@example.com"],
                "phoneNumbers": null,
                "roles": ["default-role"],
                "properties": { "PhoneExtension": "12" },
                "color": "#ddb0b0"
            })
    })

    it("should allow access to profile", async () => {
        const response = await Alice.get("http://localhost:3000/api/identity/v1/profile")
        expect(response.status).toBe(200);
        expect(response.data).toEqual({
            name: "alice",
            fullname: "Alice Musterfrau",
            mail: [
                "alice@example.at",
                "alice@example.com",
            ],
            phoneNumbers: [
                "+4312345678",
                "+2812345"
            ],
            roles: [
                "default-role",
            ],
            properties: {
                GoogleCalendarID: "primary",
                PhoneExtension: '10',
            },
            color: "#1b7550b9",
        })
    })

    it("should allow access to user avatars", async () => {
        const response = await Alice.get("http://localhost:3000/api/identity/v1/avatar/bob")
        expect(response.status).toBe(200)
        expect(response.headers['content-type']).toEqual("image/png")
    })

    describe("Login and logout", () => {
        let accessToken: string | null = null;
        let refreshCookie: Cookie;

        it("should work as alice", async () => {
            const response = await axios.post("http://localhost:3000/api/identity/v1/login", {
                username: "alice",
                password: "password"
            })
            expect(response).toBeDefined()
            expect(response.data.token).toBeTruthy();
            expect(response.headers['set-cookie']).toBeTruthy()

            accessToken = response.data.token;
            let cookies = parseCookie(response.headers['set-cookie'] as string[])
            refreshCookie = cookies.find(cookie => cookie.name === "cis-refresh")

            expect(refreshCookie).toBeTruthy();
            // refresh cookie MUST be scoped to the exact refresh endpoint
            expect(refreshCookie.path).toBe("/api/identity/v1/refresh")
        })

        it("should issue a new access token on refresh", async () => {
            const response = await axios.post("http://localhost:3000/api/identity/v1/refresh", null, {
                headers: {
                    Cookie: `${refreshCookie.name}=${refreshCookie.value}`,
                }
            })
            expect(response).toBeDefined()
            expect(response.status).toBe(200)
            expect(response.data.token).toBeTruthy()
        })

        it("should clear session and refresh token on logout", async () => {
            const response = await axios.post("http://localhost:3000/api/identity/v1/logout", null, {
                headers: {
                    Cookie: `cis-session=${accessToken}`
                }
            })
            expect(response).toBeDefined()
            expect(response.status).toBe(204)
            const headers = parseCookie(response.headers['set-cookie']);
            expect(headers).toContain({
                name: "cis-session",
                domain: "localhost",
                path: "/",
                value: "",
                maxAge: 0,
            })
            expect(headers).toContain({
                name: "cis-refresh",
                domain: "localhost",
                path: "/api/identity/v1/refresh",
                value: "",
                maxAge: 0,
            })
        })
    })

    describe("chaning passwords", () => {
        it("should work", async () => {
            const response = await Alice.put("http://localhost:3000/api/identity/v1/profile/password", {
                current: "password",
                newPassword: "test",
            })
            expect(response).toBeDefined();
            expect(response.status).toBe(204)

            const loginResponse = await axios.post("http://localhost:3000/api/identity/v1/login", {
                username: "alice",
                password: "test"
            })
            expect(loginResponse.status).toBe(200)
            expect(loginResponse.data.token).toBeTruthy()

            const responseReset = await Alice.put("http://localhost:3000/api/identity/v1/profile/password", {
                current: "test",
                newPassword: "password",
            })
            expect(responseReset).toBeDefined();
            expect(responseReset.status).toBe(204)
        })

        it("should fail if the current password is wrong", async () => {
            let catched = false
            try {
                await Alice.put("http://localhost:3000/api/identity/v1/profile/password", {
                    current: "wrong-password",
                    newPassword: "silly-password",
                })
            } catch (err) {
                catched = true
                expect(err.response.status).toBe(400)
            }
            expect(catched).toBeTrue()
        })

        it("should fail if the current password is unset", async () => {
            let catched = false
            try {
                await Alice.put("http://localhost:3000/api/identity/v1/profile/password", {
                    current: "",
                    newPassword: "silly-password",
                })
            } catch (err) {
                catched = true
                expect(err.response.status).toBe(400)
            }
            expect(catched).toBeTrue()
        })

        it("should fail if the new password is unset", async () => {
            let catched = false
            try {
                await Alice.put("http://localhost:3000/api/identity/v1/profile/password", {
                    current: "password",
                    newPassword: "",
                })
            } catch (err) {
                catched = true
                expect(err.response.status).toBe(400)
            }
            expect(catched).toBeTrue()
        })
    })
})