import { Alice } from '../utils';

describe('Comment API', () => {
    it('should return comments by key', async () => {
        const response = await Alice.get('http://localhost:3000/api/comments/v1/roster:2021-5');
        expect(response.status).toBe(200);
        expect(response.data).toHaveSize(2);
    })

    it('should return an empty array instead of 404', async () => {
        const response = await Alice.get('http://localhost:3000/api/comments/v1/roster:2021-3');
        expect(response.status).toBe(200);
        expect(response.data).toHaveSize(0);
    })

    it('should be able to search comments by prefix', async () => {
        const response = await Alice.get('http://localhost:3000/api/comments/v1/roster:2021', {
            params: {
                prefix: true,
            }
        });
        expect(response.status).toBe(200);
        expect(response.data).toHaveSize(2);
    })

    it('should be possible to create new comments', async () => {
        let now = new Date();
        const key = `test-key-${now.getTime()}`
        const response = await Alice.post('http://localhost:3000/api/comments/v1/' + key, JSON.stringify("Test comment message"), {
            headers: {
                'content-type': 'application/json; charset=utf-8'
            }
        })
        expect(response.status).toBe(204)

        const list = await Alice.get('http://localhost:3000/api/comments/v1/' + key)
        expect(list.status).toBe(200);
        expect(list.data).toHaveSize(1);
        expect(list.data[0].user).toEqual("alice")
        expect(list.data[0].message).toEqual("Test comment message")
        expect(list.data[0].key).toEqual(key)
        expect(list.data[0].createdAt).toEqual(list.data[0].updatedAt)
        expect(list.data[0].parentID).toEqual("000000000000000000000000")
        expect(new Date(list.data[0].createdAt).getTime() / 1000).toBeCloseTo(now.getTime() / 1000, 0)
    })

    it('should be possible to reply to comments', async () => {
        const response = await Alice.put('http://localhost:3000/api/comments/v1/comment/6092e75fb832d4592661eed8/replies', "reply message", {
            headers: {
                'content-type': 'text/plain'
            }
        })
        expect(response.status).toBe(204);

        const list = await Alice.get('http://localhost:3000/api/comments/v1/roster:2021-5');
        expect(list.status).toBe(200);
        expect(list.data).toHaveSize(3);
    })
})
