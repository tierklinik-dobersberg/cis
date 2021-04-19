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
            it("should validate year", () => {
                let copy = {
                    ...roster,
                    year: 2022,
                }
                expectAsync(Alice.put("http://localhost:3000/api/dutyroster/v1/roster/2021/1", copy)).toBeRejected()
            })
            it("should validate month", () => {
                let copy = {
                    ...roster,
                    month: 2,
                }
                expectAsync(Alice.put("http://localhost:3000/api/dutyroster/v1/roster/2021/1", copy)).toBeRejected()
            })
            it("should work", async () => {
                const response = await Alice.put("http://localhost:3000/api/dutyroster/v1/roster/2021/1", roster)
                expect(response.status).toBe(204)
            })
        })

        describe("by retrieving a roster", () => {
            it("should work", async () => {
                const response = await Alice.get("http://localhost:3000/api/dutyroster/v1/roster/2021/1")
                expect(response.status).toBe(200)
                expect(response.data).toBeDefined()
                delete (response.data['_id'])
                expect(response.data).toEqual(roster)
            })

            it("should fail if there is not roster", () => {
                expectAsync(Alice.get("http://localhost:3000/api/dutyroster/v1/roster/2019/10")).toBeRejected()
            })
        })

        describe("by deleting a roster", () => {
            it("should fail if the roster does not exist", () => {
                expectAsync(Alice.delete("http://localhost:3000/api/durtyroster/v1/roster/2019/10")).toBeRejected()
            })

            it("should work", async () => {
                const response = await Alice.delete("http://localhost:3000/api/dutyroster/v1/roster/2021/1")
                expect(response.status).toBe(202)
            })
        })
    })

    describe("roster overwrites", () => {
        it("should require phone or username", async () => {
            const response = await Alice.post("http://localhost:3000/api/dutyroster/v1/overwrite?date=2021-2-1", {
                displayName: "test",
            }).catch(err => err.response)

            expect(response.status).toBe(400)
        })

        it("should work for regular users", async () => {
            let response = await Alice.post("http://localhost:3000/api/dutyroster/v1/overwrite?date=2021-2-1", {
                username: "alice"
            })
            expect(response.status).toBe(204)

            response = await Alice.get("http://localhost:3000/api/dutyroster/v1/overwrite?date=2021-2-1")
            expect(response.status).toBe(200)
            const createdAt = response.data.createdAt
            delete (response.data['createdAt'])

            expect(response.data).toEqual({
                username: "alice",
                date: "2021-02-01",
            })
            expect(new Date(createdAt).getTime() / 1000).toBeCloseTo(new Date().getTime() / 1000, 0)
        })

        it("should fail for disabled users", async () => {
            let response = await Alice.post("http://localhost:3000/api/dutyroster/v1/overwrite?date=2021-2-1", {
                username: "diser"
            }).catch(err => err.response as AxiosResponse)
            expect(response.status).toBe(400)
        })

        it("should work for custom phone numbers", async () => {
            let response = await Alice.post("http://localhost:3000/api/dutyroster/v1/overwrite?date=2021-2-1", {
                phoneNumber: "10",
                displayName: "extension",
            })
            expect(response.status).toBe(204)

            response = await Alice.get("http://localhost:3000/api/dutyroster/v1/overwrite?date=2021-2-1")
            expect(response.status).toBe(200)
            const createdAt = response.data.createdAt
            delete (response.data['createdAt'])

            expect(response.data).toEqual({
                phoneNumber: "10",
                date: "2021-02-01",
                displayName: "extension"
            })
            expect(new Date(createdAt).getTime() / 1000).toBeCloseTo(new Date().getTime() / 1000, 0)
        })

        it("should return an error if there is no overwrite", async () => {
            const response = await Alice.get("http://localhost:3000/api/dutyroster/v1/overwrite?date=2019-11-11")
                .catch(err => err.response)
            expect(response.status).toBe(404)
        })

        it("should be possible to delete an overwrite", async () => {
            const response = await Alice.delete("http://localhost:3000/api/dutyroster/v1/overwrite?date=2021-2-1")
            expect(response.status).toBe(204)
        })

        it("should return an error when deleting a non-existing overwrite", async () => {
            const response = await Alice.delete("http://localhost:3000/api/dutyroster/v1/overwrite?date=2021-2-1")
                .catch(err => err.response)
            expect(response.status).toBe(404)
        })
    })

    describe("doctor-on-duty", () => {
        // there's roster loaded for 2021/04 with one week
        // see testdata/dumps/dutyRosters.json

        let get = (day: number, hour: number, min: number) => {
            let d = new Date(Date.UTC(2021, 3, day, hour, min));
            return Alice.get<DoctorOnDutyResponse<string>>("http://localhost:3000/api/external/v1/doctor-on-duty?at=" + d.toISOString())
        }

        it("should check the correct roster", async () => {
            const response = await get(6, 10, 0)
            expect(response.status).toBe(200)
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
            expect(response2.status).toBe(200)
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

        it("should honor change-of-duty on regular days", async () => {
            const response = await get(6, 5, 29) // duty changes at 07:30 in Europe/Vienna
            expect(response.status).toBe(200)
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
            expect(response2.status).toBe(200)
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
            expect(response3.status).toBe(200)
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
            expect(response.status).toBe(200)
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
            expect(response2.status).toBe(200)
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
            expect(response3.status).toBe(200)
            expect(response3.data.doctors).toEqual([{
                username: "bob",
                fullname: "Bob Mustermann",
                phone: "",
                properties: {
                    PhoneExtension: "12",
                }
            }])
            expect(response3.data.until).toBe("2021-04-11T07:30:00+02:00")
        })

        it("should honor change-of-duty on specific days even if it's late", async () => {
            const response = await get(11, 17, 29) // duty changes at 19:30 in Europe/Vienna
            expect(response.status).toBe(200)
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
            expect(response2.status).toBe(200)
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
    })
})