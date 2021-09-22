import { AxiosResponse } from 'axios';
import { Alice } from '../utils';

describe('APIs for 3CX', () => {
    describe("CRM integration", () => {
        it('retrieving contact using +43', async () => {
            const response = await Alice.get(`http://localhost:3000/api/external/v1/contact?phone=%2B4333333333`)
            expect(response.status).toBe(200)
            expect(response.data.contact.phone1).toBe('+4333333333')
            expect(response.data.contact.phone2).toBe('33333333')
        })
        it('retrieving contact using 0043', async () => {
            const response = await Alice.get(`http://localhost:3000/api/external/v1/contact?phone=004333333333`)
            expect(response.status).toBe(200)
            expect(response.data.contact.phone1).toBe('+4333333333')
            expect(response.data.contact.phone2).toBe('33333333')
        })
        it('retrieving contact using national number', async () => {
            const response = await Alice.get(`http://localhost:3000/api/external/v1/contact?phone=33333333`)
            expect(response.status).toBe(200)
            expect(response.data.contact.phone1).toBe('+4333333333')
            expect(response.data.contact.phone2).toBe('33333333')
        })
        it('should return with 404 for unknown numbers', async () => {
            // TODO(ppacher): also test the "unknown-user" case
            const response = await Alice.get(`http://localhost:3000/api/external/v1/contact?phone=99999999`).catch(err => err.response as AxiosResponse)
            expect(response.status).toBe(404)
        })
    })

    describe("call journaling", () => {
        it("should be possible to record an unidentified caller", async () => {
            const response = await Alice.post(`http://localhost:3000/api/external/v1/calllog?ani=33333333&did=99`)
            expect(response.status).toBe(204);
        })
        it("should be possible to create an unidentified anonymous caller", async () => {
            const response = await Alice.post(`http://localhost:3000/api/external/v1/calllog?ani=Anonymous&did=99`)
            expect(response.status).toBe(204);
        })

        it("should be possible to create an identified call record", async () => {
            const response = await Alice.post(`http://localhost:3000/api/external/v1/calllog`, {
                duration: "10",
                number: "12341234",
                agent: "10",
                callType: "Inbound",
                dateTime: "02.01.2006 15:04",
                cid: "3",
                source: "vetinf",
            })
            expect(response.status).toBe(204)

            const loadResponse = await Alice.get(`http://localhost:3000/api/calllogs/v1/customer/vetinf/3`)
            expect(loadResponse.status).toBe(200)
            expect(loadResponse.data).toHaveSize(1)
            expect(loadResponse.data[0]._id).toBeTruthy();
            delete (loadResponse.data[0]._id);
            expect(loadResponse.data[0]).toEqual({
                caller: '+43 1 2341234',
                inboundNumber: '',
                date: '2006-01-02T14:04:00Z',
                durationSeconds: 10,
                callType: 'Inbound',
                datestr: '2006-01-02',
                agent: '10',
                customerID: '3',
                customerSource: 'vetinf'
            });
        })

        it("should replace an unidentified record with an identified one", async () => {
            const response = await Alice.post(`http://localhost:3000/api/external/v1/calllog?ani=88888888&did=99`)
            expect(response.status).toBe(204);

            const now = new Date();
            const [year, month, day] = [now.getFullYear(), now.getMonth() + 1, now.getDate()]
            let callLogsFromToday = await Alice.get(`http://localhost:3000/api/calllogs/v1/date/${year}/${month}/${day}`)
            expect(callLogsFromToday.status).toBe(200)
            expect(callLogsFromToday.data.find((d: any) => d.caller === '+43 888 88888' && !d.callType)).toBeTruthy()

            let pad = (x: string | number) => {
                x = `${x}`;
                if (x.length === 2) {
                    return x;
                }
                return `0${x}`
            }

            const dateStr = `${pad(day)}.${pad(month)}.${year} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
            const response2 = await Alice.post(`http://localhost:3000/api/external/v1/calllog`, {
                duration: "10",
                number: "88888888",
                agent: "10",
                callType: "Inbound",
                dateTime: dateStr,
                cid: "3",
                source: "unknown",
            })
            expect(response2.status).toBe(204)

            // now it should include own with callType but none without
            callLogsFromToday = await Alice.get(`http://localhost:3000/api/calllogs/v1/date/${year}/${month}/${day}`)
            expect(callLogsFromToday.status).toBe(200)
            expect(callLogsFromToday.data.find((d: any) => d.caller === '+43 888 88888' && d.callType === 'Inbound')).toBeTruthy()
            expect(callLogsFromToday.data.find((d: any) => d.caller === '+43 888 88888' && !d.callType)).toBeUndefined()

        })
    })
})