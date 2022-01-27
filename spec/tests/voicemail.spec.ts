import { Alice } from '../utils';

describe('VoiceMail API', () => {
    let getVoicemail = async (id: string) => {
        const response = await Alice.get('/api/voicemail/v1/search', {
            params: {
                name: 'Visiten Anmeldungen',
            }
        })
        return response.data.find((mail: any) => mail._id === id);
    }

    it("should support listing voice-mails", async () => {
        const response = await Alice.get('/api/voicemail/v1/list')
        expect(response.status).toBe(200, response.data)
        expect(response.data).toEqual([]); // TODO(ppacher): create voicemail for test.
    })

    it("should support searching voicemails by date", async () => {
        const response = await Alice.get('/api/voicemail/v1/search', {
            params: {
                name: "Visiten Anmeldungen",
                date: "2021-2-7",
            }
        })
        expect(response.status).toBe(200, response.data)
        expect(response.data).toHaveSize(5)
    })

    it("should support searching voicemails by seen", async () => {
        const response = await Alice.get('/api/voicemail/v1/search', {
            params: {
                name: "Visiten Anmeldungen",
                seen: "false",
            }
        })
        expect(response.status).toBe(200, response.data)
        expect(response.data).toHaveSize(6)
    })

    it("should support searching voicemails by date and seen", async () => {
        const response = await Alice.get('/api/voicemail/v1/search', {
            params: {
                name: "Visiten Anmeldungen",
                seen: "false",
                date: "2021-2-7",
            }
        })
        expect(response.status).toBe(200, response.data)
        expect(response.data).toHaveSize(3)
    })

    it("should support marking voice-mails as seen", async () => {
        expect((await getVoicemail("6020219cfbdac8b50bb5d226"))?.read).toBeUndefined()
        const response = await Alice.put('/api/voicemail/v1/recording/6020219cfbdac8b50bb5d226/seen')
        expect(response.status).toBe(204, response.data)
        expect((await getVoicemail("6020219cfbdac8b50bb5d226"))?.read).toBeTrue()
    })

    it("should support marking voice-mails as unseen", async () => {
        expect((await getVoicemail("6020219cfbdac8b50bb5d226"))?.read).toBeTrue()
        const response = await Alice.delete('/api/voicemail/v1/recording/6020219cfbdac8b50bb5d226/seen')
        expect(response.status).toBe(204, response.data)
        expect((await getVoicemail("6020219cfbdac8b50bb5d226"))?.read).toBeUndefined()
    })

    it("should support retrieving voicemails by ID", async () => {
        const response = await Alice.get("/api/voicemail/v1/recording/60201fd71019fe0e812caa87")
        expect(response.status).toBe(200, response.data);
        expect(response.data).toBe("<testcontent>\n")
    })
})