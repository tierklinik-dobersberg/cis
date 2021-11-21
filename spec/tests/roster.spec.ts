import { Alice } from '../utils';
import { Roster } from '../../ui/src/app/api/roster.api';
import { DoctorOnDutyResponse } from '../../ui/src/app/api/external.api';
import { AxiosResponse } from 'axios';

describe("Duty roster API:", () => {
    describe("Managing duty rosters", () => {
        let roster: Roster = {
            month: 1,
            year: 2021,
            days: {
                1: {
                    forenoon: ["alice"],
                    afternoon: ["alice", "bob"],
                    onCall: {
                        day: ["alice"],
                        night: ["alice"],
                    }
                },
                2: {
                    forenoon: ["bob"],
                    afternoon: ["alice", "bob"],
                    onCall: {
                        day: ["bob"],
                        night: ["bob"],
                    }
                },
                3: {
                    forenoon: ["alice"],
                    afternoon: ["bob"],
                    onCall: {
                        day: ["alice"],
                        night: ["alice"],
                    }
                },
                4: {
                    forenoon: ["bob"],
                    afternoon: ["alice", "bob"],
                    onCall: {
                        day: ["bob"],
                        night: ["bob"],
                    }
                },
                5: {
                    forenoon: ["bob"],
                    afternoon: ["bob"],
                    onCall: {
                        day: ["bob"],
                        night: ["bob"],
                    }
                },
            }
        }

        describe("by creating a new roster", () => {
            it("should validate year", async () => {
                let copy = {
                    ...roster,
                    year: 2022,
                }
                await expectAsync(Alice.put("/api/dutyroster/v1/roster/2021/1", copy)).toBeRejected()
            })
            it("should validate month", async () => {
                let copy = {
                    ...roster,
                    month: 2,
                }
                await expectAsync(Alice.put("/api/dutyroster/v1/roster/2021/1", copy)).toBeRejected()
            })
            it("should work", async () => {
                const response = await Alice.put("/api/dutyroster/v1/roster/2021/1", roster)
                expect(response.status).toBe(204)
            })
        })

        describe("by retrieving a roster", () => {
            it("should work", async () => {
                const response = await Alice.get("/api/dutyroster/v1/roster/2021/1")
                expect(response.status).toBe(200)
                expect(response.data).toBeDefined()
                delete (response.data['_id'])
                expect(response.data).toEqual(roster)
            })

            it("should fail if there is not roster", async () => {
                await expectAsync(Alice.get("/api/dutyroster/v1/roster/2019/10")).toBeRejected()
            })
        })

        describe("by deleting a roster", () => {
            it("should fail if the roster does not exist", async () => {
                await expectAsync(Alice.delete("/api/durtyroster/v1/roster/2019/10")).toBeRejected()
            })

            it("should work", async () => {
                const response = await Alice.delete("/api/dutyroster/v1/roster/2021/1")
                expect(response.status).toBe(202)
            })
        })
    })

    describe("roster overwrites", () => {
        it("should require check for required parameters", async () => {
            let response = await Alice.post("/api/dutyroster/v1/overwrite", {
                displayName: "test",
                from: "2021-02-01T18:30:00Z",
                to: "2021-02-02T18:30:00Z",
            }).catch(err => err.response)
            expect(response.status).toBe(400, response.data)

            response = await Alice.post("/api/dutyroster/v1/overwrite", {
                displayName: "test",
                user: "test",
                to: "2021-02-02T18:30:00Z",
            }).catch(err => err.response)
            expect(response.status).toBe(400, response.data)

            response = await Alice.post("/api/dutyroster/v1/overwrite", {
                displayName: "test",
                user: "test",
                from: "2021-02-02T18:30:00Z",
            }).catch(err => err.response)
            expect(response.status).toBe(400, response.data)
        })

        it("should work for regular users", async () => {
            let response = await Alice.post("/api/dutyroster/v1/overwrite", {
                username: "alice",
                from: "2021-02-01T06:30:00Z",
                to: "2021-02-02T05:30:00Z",
            }).catch(err => err.response)
            expect(response.status).toBe(204, response.data)

            response = await Alice.get("/api/dutyroster/v1/overwrite?date=2021-02-01T10:30:00Z").catch(err => err.response)
            expect(response.status).toBe(200, response.data)
            const createdAt = response.data.createdAt
            delete (response.data['createdAt'])

            expect(response.data).toEqual({
                username: "alice",
                from: "2021-02-01T06:30:00Z",
                to: "2021-02-02T05:30:00Z",
            })
            expect(new Date(createdAt).getTime() / 1000).toBeCloseTo(new Date().getTime() / 1000, 0)
        })

        it("should fail for disabled users", async () => {
            let response = await Alice.post("/api/dutyroster/v1/overwrite", {
                username: "diser",
                from: "2021-02-01T08:30:00+02:00",
                to: "2021-02-02T07:30:00+02:00",
            }).catch(err => err.response as AxiosResponse)
            expect(response.status).toBe(400, response.data)
        })

        it("should detect overlapping overwrites", async () => {
            let first = await Alice.post("/api/dutyroster/v1/overwrite", {
                username: "alice",
                from: "2021-02-03T08:30:00+02:00",
                to: "2021-02-04T07:30:00+02:00",
            }).catch(err => err.response)
            expect(first.status).toBe(204, first.data)

            let second = await Alice.post("/api/dutyroster/v1/overwrite", {
                username: "bob",
                from: "2021-02-03T08:30:00+02:00",
                to: "2021-02-04T07:30:00+02:00",
            }).catch(err => err.response)
            expect(second.status).toBe(409, second.data) // conflict
        })

        it("should work for custom phone numbers", async () => {
            let response = await Alice.post("/api/dutyroster/v1/overwrite", {
                phoneNumber: "10",
                displayName: "extension",
                from: "2021-02-05T08:30:00+02:00",
                to: "2021-02-06T07:30:00+02:00",
            }).catch(err => err.response)
            expect(response.status).toBe(204, response.data)

            response = await Alice.get("/api/dutyroster/v1/overwrite?date=2021-02-05T14:00:00%2B02:00")
                .catch(err => err.response)
            expect(response.status).toBe(200, response.data)
            const createdAt = response.data.createdAt
            delete (response.data['createdAt'])

            expect(response.data).toEqual({
                phoneNumber: "10",
                displayName: "extension",
                from: "2021-02-05T06:30:00Z",
                to: "2021-02-06T05:30:00Z",
            })
            expect(new Date(createdAt).getTime() / 1000).toBeCloseTo(new Date().getTime() / 1000, 0)
        })

        it("should return an error if there is no overwrite", async () => {
            const response = await Alice.get("/api/dutyroster/v1/overwrite?date=2019-11-11T14:00:00Z")
                .catch(err => err.response)
            expect(response.status).toBe(404, response.data)
        })

        it("should be possible to delete an overwrite", async () => {
            const response = await Alice.delete("/api/dutyroster/v1/overwrite?date=2021-02-01T14:00:00Z")
                .catch(err => err.response)
            expect(response.status).toBe(204, response.data)
        })

        it("should return an error when deleting a non-existing overwrite", async () => {
            const response = await Alice.delete("/api/dutyroster/v1/overwrite?date=2021-02-01T14:00:00Z")
                .catch(err => err.response)
            expect(response.status).toBe(404, response.data)
        })

        it("should support querying all overwrites", async () => {
            const response = await Alice.get("/api/dutyroster/v1/overwrites?from=2021-02-01T14:00:00Z&to=2021-02-07T18:00:00%2B02:00")
                .catch(err => err.response)
            expect(response.status).toBe(200, response.data);
            expect(response.data.length).toBe(2);
            delete(response.data[0].createdAt);
            delete(response.data[1].createdAt);
            expect(response.data).toEqual([
               {
                 username: "alice",
                 from: "2021-02-03T06:30:00Z",
                 to: "2021-02-04T05:30:00Z",
               },
               {
                 phoneNumber: "10",
                 displayName: "extension",
                 from: "2021-02-05T06:30:00Z",
                 to: "2021-02-06T05:30:00Z",
               },
            ])
        })
    })

    describe("doctor-on-duty", () => {
        // there's roster loaded for 2021/04 with one week
        // see testdata/dump/dutyRosters.json

        // TODO(ppacher): assert isDayShift and isNightShift in response

        let get = (day: number, hour: number, min: number) => {
            let d = new Date(Date.UTC(2021, 3, day, hour, min));
            return Alice.get<DoctorOnDutyResponse<string>>("/api/external/v1/doctor-on-duty?at=" + d.toISOString())
                .catch(err => err.response)
        }

        it("should check the correct roster", async () => {
            const response = await get(6, 10, 0)
            expect(response.status).toBe(200, response.data)
            expect(response.data.doctors).toEqual([{
                username: "bob",
                fullname: "Bob Mustermann",
                phone: "",
                properties: {
                    PhoneExtension: "12",
                }
            }])
            expect(response.data.until).toBe("2021-04-06T19:30:00+02:00")

            const response2 = await get(6, 22, 0)
            expect(response2.status).toBe(200, response2.data)
            expect(response2.data.doctors).toEqual([{
                username: "bob",
                fullname: "Bob Mustermann",
                phone: "",
                properties: {
                    PhoneExtension: "12",
                }
            }])
            expect(response2.data.until).toBe("2021-04-07T07:30:00+02:00")
        })

        it("should work even with different time-zones", async () => {
            const inLocalTime = await Alice.get<DoctorOnDutyResponse<string>>("/api/external/v1/doctor-on-duty?at=2021-04-11T01:10:00%2B02:00")
                .catch(err => err.response)

            expect(inLocalTime.status).toBe(200, inLocalTime.data)
            expect(inLocalTime.data.doctors).toEqual([{
                username: "bob",
                fullname: "Bob Mustermann",
                phone: "",
                properties: {
                    PhoneExtension: "12",
                }
            }])

            const inUTC = await Alice.get<DoctorOnDutyResponse<string>>("/api/external/v1/doctor-on-duty?at=2021-04-10T23:10:00Z")
                .catch(err => err.response)
            expect(inUTC.status).toBe(200, inUTC.data)
            expect(inUTC.data.doctors).toEqual([{
                username: "bob",
                fullname: "Bob Mustermann",
                phone: "",
                properties: {
                    PhoneExtension: "12",
                }
            }])
        })

        it("should honor change-of-duty on regular days", async () => {
            const response = await get(6, 5, 29) // duty changes at 07:30 in Europe/Vienna
            expect(response.status).toBe(200, response.data)
            expect(response.data.doctors).toEqual([{
                username: "alice",
                fullname: "Alice Musterfrau",
                phone: "+4312345678",
                properties: {
                    PhoneExtension: "10",
                }
            }])
            expect(response.data.until).toBe("2021-04-06T07:30:00+02:00")

            const response2 = await get(6, 5, 30)
            expect(response2.status).toBe(200, response2.data)
            expect(response2.data.doctors).toEqual([{
                username: "bob",
                fullname: "Bob Mustermann",
                phone: "",
                properties: {
                    PhoneExtension: "12",
                }
            }])
            expect(response2.data.until).toBe("2021-04-06T19:30:00+02:00")

            const response3 = await get(6, 17, 30)
            expect(response3.status).toBe(200, response3.data)
            expect(response3.data.doctors).toEqual([{
                username: "bob",
                fullname: "Bob Mustermann",
                phone: "",
                properties: {
                    PhoneExtension: "12",
                }
            }])
            expect(response3.data.until).toBe("2021-04-07T07:30:00+02:00")
        })

        it("should honor change-of-duty on specific days", async () => {
            const response = await get(10, 6, 29) // duty changes at 8:30 in Europe/Vienna
            expect(response.status).toBe(200, response.data)
            expect(response.data.doctors).toEqual([{
                username: "alice",
                fullname: "Alice Musterfrau",
                phone: "+4312345678",
                properties: {
                    PhoneExtension: "10",
                }
            }])
            expect(response.data.until).toBe("2021-04-10T08:30:00+02:00")

            const response2 = await get(10, 6, 30)
            expect(response2.status).toBe(200, response2.data)
            expect(response2.data.doctors).toEqual([{
                username: "bob",
                fullname: "Bob Mustermann",
                phone: "",
                properties: {
                    PhoneExtension: "12",
                }
            }])
            expect(response2.data.until).toBe("2021-04-10T19:30:00+02:00")

            const response3 = await get(10, 23, 30)
            expect(response3.status).toBe(200, response.data)
            expect(response3.data.doctors).toEqual([{
                username: "bob",
                fullname: "Bob Mustermann",
                phone: "",
                properties: {
                    PhoneExtension: "12",
                }
            }])
            expect(response3.data.until).toBe("2021-04-11T08:30:00+02:00")
        })

        it("should honor change-of-duty on specific days even if it's late", async () => {
            const response = await get(11, 17, 29) // duty changes at 19:30 in Europe/Vienna
            expect(response.status).toBe(200, response.data)
            expect(response.data.doctors).toEqual([{
                username: "alice",
                fullname: "Alice Musterfrau",
                phone: "+4312345678",
                properties: {
                    PhoneExtension: "10",
                }
            }])
            expect(response.data.until).toBe("2021-04-11T19:30:00+02:00")

            const response2 = await get(11, 17, 30)
            expect(response2.status).toBe(200, response2.data)
            expect(response2.data.doctors).toEqual([{
                username: "alice",
                fullname: "Alice Musterfrau",
                phone: "+4312345678",
                properties: {
                    PhoneExtension: "10",
                }
            }])
            expect(response2.data.until).toBe("2021-04-12T07:30:00+02:00")
        })

        it("should return an error if there's no roster", async () => {
            const response = await get(22, 8, 0);
            expect(response.status).toBe(404, response.data);
        })

        it("should use overwrites if they exist", async () => {
            // created by the roster test cases above
            const query = await Alice.get("/api/external/v1/doctor-on-duty?at=2021-02-03T15:30:00Z")
                .catch(err => err.response);
            expect(query.status).toBe(200, query.data);

            expect(query.data.doctors).toEqual([{
                username: "alice",
                fullname: "Alice Musterfrau",
                phone: "+4312345678",
                properties: {
                    PhoneExtension: "10",
                }
            }])
            expect(query.data.isOverwrite).toBeTrue()
            expect(query.data.until).toBe("2021-02-04T05:30:00Z")
        })
    })
})