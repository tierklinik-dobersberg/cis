import { Alice } from '../utils';

describe("OpeningHours", () => {
    describe("retrieving opening hours", () => {
        it("should work for a specific date", async () => {
            const response = await Alice.get("http://localhost:3000/api/openinghours/v1/opening-hours?at=2021-10-23")
            expect(response.data).toEqual({
                openingHours: [
                    {
                        from: "2021-10-23T09:00:00+02:00",
                        to: "2021-10-23T12:00:00+02:00",
                        unofficial: false
                    }
                ],
                holiday: false
            })
        })

        it("should work for a holiday date", async () => {
            const response = await Alice.get("http://localhost:3000/api/openinghours/v1/opening-hours?at=2021-10-26")
            expect(response.data).toEqual({
                openingHours: [
                    {
                        from: "2021-10-26T09:00:00+02:00",
                        to: "2021-10-26T12:00:00+02:00",
                        unofficial: true
                    }
                ],
                holiday: true
            })
        })

        it("should support retrieving ranges", async () => {
            const response = await Alice.get("http://localhost:3000/api/openinghours/v1/opening-hours?from=2021-10-23&to=2021-10-27")
            expect(response.data).toEqual({
                "dates": {
                    "2021-10-23T00:00:00+02:00": {
                        "openingHours": [
                            {
                                "from": "2021-10-23T09:00:00+02:00",
                                "to": "2021-10-23T12:00:00+02:00",
                                "unofficial": false
                            }
                        ],
                        "holiday": false
                    },
                    "2021-10-24T00:00:00+02:00": {
                        "openingHours": [
                            {
                                from: "2021-10-24T09:00:00+02:00",
                                to: "2021-10-24T12:00:00+02:00",
                                unofficial: true
                            }
                        ],
                        "holiday": false
                    },
                    "2021-10-25T00:00:00+02:00": {
                        "openingHours": [
                            {
                                "from": "2021-10-25T08:00:00+02:00",
                                "to": "2021-10-25T12:00:00+02:00",
                                "unofficial": false
                            },
                            {
                                "from": "2021-10-25T14:00:00+02:00",
                                "to": "2021-10-25T17:00:00+02:00",
                                "unofficial": false
                            }
                        ],
                        "holiday": false
                    },
                    "2021-10-26T00:00:00+02:00": {
                        "openingHours": [
                            {
                                "from": "2021-10-26T09:00:00+02:00",
                                "to": "2021-10-26T12:00:00+02:00",
                                "unofficial": true
                            }
                        ],
                        "holiday": true
                    }
                }
            })
        })
    })
})