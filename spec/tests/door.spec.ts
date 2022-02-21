import { connect as mqttConnect, Client } from "mqtt";
import { Subject, interval } from "rxjs";
import { take, takeUntil, filter } from "rxjs/operators";
import { Alice } from "../utils";

interface Message<T = any> {
  topic: string;
  payload: T;
}

describe("Door management", () => {
  let client: Client;
  let messages = new Subject<Message>();

  let receive = () => {
    return new Promise<any>((resolve, reject) => {
      let resolved = false;
      let timeout = interval(3000);

      messages
        .pipe(
          filter((msg) => msg.topic.startsWith("cliny/rpc/service/door/")),
          takeUntil(timeout),
          take(1)
        )
        .subscribe({
          next: (msg) => {
            resolved = true;
            resolve(msg.topic.replace("cliny/rpc/service/door/", ""));
          },
          complete: () => {
            if (!resolved) {
              reject();
            }
          },
        });
    });
  };

  afterAll(() => {
    messages.complete();
    client.end(true);
  });

  beforeAll(async () => {
    await new Promise<void>((resolve, reject) => {
      client = mqttConnect("mqtt://localhost");
      client.on("connect", () => {
        resolve();
      });

      client.on("error", () => {
        reject();
      });

      client.on("message", (topic, payload) => {
        let body: any = null;
        try {
          body = JSON.parse(payload.toString());
        } catch {
          body = payload.toString();
        }

        messages.next({
          topic: topic,
          payload: body,
        });

        if (typeof body === "object" && "replyTo" in body) {
          client.publish(body.replyTo, "");
        }
      });
      client.subscribe("#");
    });
  });

  it("should support resetting the door", async () => {
    const response = Alice.post("/api/door/v1/reset", null);
    let commands = [await receive(), await receive(), await receive()];

    await response;

    expect(commands).toEqual(["unlock", "lock", "unlock"]);
  });

  it("should support a manual overwrite", async () => {
    const currentStateResponse = await Alice.get("/api/door/v1/state");
    expect(currentStateResponse).toBeDefined();
    expect(currentStateResponse.data.resetInProgress).toBeFalse();
    expect(["locked", "unlocked"]).toContain(currentStateResponse.data.state);

    let next: string = "";
    switch (currentStateResponse.data.state) {
      case "locked":
        next = "unlock";
        break;
      case "unlocked":
        next = "lock";
        break;
      default:
        throw new Error("unexpected door state");
    }

    const until = new Date(currentStateResponse.data.until);
    const nextUntil = new Date(new Date().getTime() + 2 * 60 * 1000);

    expect(until.getTime()).toBeGreaterThanOrEqual(until.getTime());

    const overWriteResponse = await Alice.post("/api/door/v1/overwrite", {
      state: next,
      duration: "2m",
    });
    expect(overWriteResponse.data).toBeDefined();

    // TODO(ppacher): the following is a bit flanky and does not guarantee stable
    // test results as we might intere with the perodically sent messages here
    //
    // let command = await receive()
    // expect(command).toBe(next)

    const currentStateResponse2 = await Alice.get("/api/door/v1/state");
    expect(currentStateResponse2.data.state).toBe(next + "ed");

    const actual = new Date(currentStateResponse2.data.until);
    expect(Math.abs(actual.getTime() - nextUntil.getTime())).toBeLessThan(1000);
  });
});
