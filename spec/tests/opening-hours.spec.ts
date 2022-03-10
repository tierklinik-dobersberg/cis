import { Alice, waitForEvent } from "../utils";

describe("OpeningHours", () => {
  describe("configuring opening hours", () => {
    describe("creating new opening hours", () => {
      let createdId = "";

      it("should work", async () => {
        const waiter = waitForEvent(Alice, "vet.dobersberg.cis/door/unlock");

        // the following opening hour should immediately trigger a "unlock" event
        const response = await Alice.post(`/api/config/v1/schema/OpeningHour`, {
          config: {
            OnWeekday: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
            TimeRanges: ["00:00 - 23:59"],
          },
        });

        expect(response.status).toBe(200);
        expect(response.data.id).toBeTruthy();
        expect(response.data.warning).toBeFalsy();

        createdId = response.data.id;

        await waiter;
      });

      it("should correctly report opening hours", async () => {
        const response = await Alice.get(`/api/config/v1/schema/OpeningHour`);
        expect(response.status).toBe(200);
        expect(typeof response.data).toBe("object");
        expect(typeof response.data.configs).toBe("object");
        expect(Object.keys(response.data.configs)).toEqual(
          [createdId],
          response.data
        );
        expect(response.data.configs[createdId]).toBeTruthy(response.data);
        expect(response.data.configs[createdId]).toEqual(
          {
            OnWeekday: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
            TimeRanges: ["00:00 - 23:59"],
            Unofficial: false,
          },
          response.data
        );
      });

      it("should support deleting it", async () => {
        // deleting the opening hour should immediately trigger a lock
        const waiter = waitForEvent(Alice, "vet.dobersberg.cis/door/lock");

        const response = await Alice.delete(
          `/api/config/v1/schema/OpeningHour/${createdId}`
        );
        expect(response.status).toBe(200);
        expect(response.data.id).toBe(createdId);
        expect(response.data.warning).toBeFalsy();

        await waiter;
      });
    });
  });

  describe("retrieving opening hours", () => {
    // create all opening hours that we need for the following tests
    beforeAll(async () => {
      // TODO(ppacher): create and use a batch api?
      const openingHours = [
        {
          OnWeekday: ["Mon", "Tue", "Wed", "Thu", "Fri"],
          TimeRanges: ["08:00 - 12:00"],
        },
        {
          OnWeekday: ["Tue", "Thu"],
          TimeRanges: ["14:00 - 18:00"],
          CloseAfter: "30m",
        },
        {
          OnWeekday: ["Mon", "Wed", "Fri"],
          TimeRanges: ["14:00 - 17:00"],
        },
        {
          OnWeekday: ["Sat"],
          TimeRanges: ["09:00 - 12:00"],
          OnCallDayStart: "08:30",
        },
        {
          OnWeekday: "Sun",
          OnCallDayStart: "08:30",
          TimeRanges: "09:00 - 12:00",
          Unofficial: true,
        },
        {
          UseAtDate: "10/24",
          TimeRanges: "09:00 - 12:00",
          OpenBefore: "0m",
          CloseAfter: "0m",
          Holiday: "only",
          Unofficial: "yes",
          OnCallNightStart: "20:00",
        },
      ];

      for (let i = 0; i < openingHours.length; i++) {
        const response = await Alice.post(`/api/config/v1/schema/OpeningHour`, {
          config: openingHours[i],
        });

        expect(response.status).toBe(200, response.data)
        expect(response.data.id).toBeTruthy()
        expect(response.data.warning).toBeFalsy()
      }
    });

    it("should work for a specific date", async () => {
      const response = await Alice.get(
        "/api/openinghours/v1/opening-hours?at=2021-10-23"
      );
      expect(response.status).toBe(200)
      expect(response.data).toEqual({
        openingHours: [
          {
            from: "2021-10-23T09:00:00+02:00",
            to: "2021-10-23T12:00:00+02:00",
            unofficial: false,
          },
        ],
        onCallStartDay: "2021-10-23T08:30:00+02:00",
        onCallStartNight: "2021-10-23T19:30:00+02:00",
        holiday: false,
      });
    });

    it("should work for a holiday date", async () => {
      const response = await Alice.get(
        "/api/openinghours/v1/opening-hours?at=2021-10-26"
      );
      expect(response.status).toBe(200)
      expect(response.data).toEqual({
        openingHours: [
          {
            from: "2021-10-26T09:00:00+02:00",
            to: "2021-10-26T12:00:00+02:00",
            unofficial: true,
          },
        ],
        onCallStartDay: "2021-10-26T07:30:00+02:00",
        onCallStartNight: "2021-10-26T20:00:00+02:00",
        holiday: true,
      });
    });

    it("should support retrieving ranges", async () => {
      const response = await Alice.get(
        "/api/openinghours/v1/opening-hours?from=2021-10-23&to=2021-10-27"
      );
      expect(response.status).toBe(200)
      expect(response.data).toEqual({
        dates: {
          "2021-10-23T00:00:00+02:00": {
            openingHours: [
              {
                from: "2021-10-23T09:00:00+02:00",
                to: "2021-10-23T12:00:00+02:00",
                unofficial: false,
              },
            ],
            holiday: false,
            onCallStartDay: "2021-10-23T08:30:00+02:00",
            onCallStartNight: "2021-10-23T19:30:00+02:00",
          },
          "2021-10-24T00:00:00+02:00": {
            openingHours: [
              {
                from: "2021-10-24T09:00:00+02:00",
                to: "2021-10-24T12:00:00+02:00",
                unofficial: true,
              },
            ],
            holiday: false,
            onCallStartDay: "2021-10-24T08:30:00+02:00",
            onCallStartNight: "2021-10-24T20:00:00+02:00", 
          },
          "2021-10-25T00:00:00+02:00": {
            openingHours: [
              {
                from: "2021-10-25T08:00:00+02:00",
                to: "2021-10-25T12:00:00+02:00",
                unofficial: false,
              },
              {
                from: "2021-10-25T14:00:00+02:00",
                to: "2021-10-25T17:00:00+02:00",
                unofficial: false,
              },
            ],
            holiday: false,
            onCallStartDay: "2021-10-25T07:30:00+02:00",
            onCallStartNight: "2021-10-25T19:30:00+02:00",
          },
          "2021-10-26T00:00:00+02:00": {
            openingHours: [
              {
                from: "2021-10-26T09:00:00+02:00",
                to: "2021-10-26T12:00:00+02:00",
                unofficial: true,
              },
            ],
            holiday: true,
            onCallStartDay: "2021-10-26T07:30:00+02:00",
            onCallStartNight: "2021-10-26T20:00:00+02:00",
          },
        },
      });
    });
  });
});
