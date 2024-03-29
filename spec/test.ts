import { execSync } from 'child_process';
import { issue, issueCommand } from '@actions/core/lib/command';
import { join } from 'path';
import axios from "axios";

export class GHActionsReporter implements jasmine.CustomReporter {
    private failes: jasmine.CustomReporterResult[] = [];

    jasmineDone(_: jasmine.RunDetails) {
        this.failes.forEach(result => {
            issue("group", result.fullName)
            result.failedExpectations.forEach(expectation => {
                const x = /\((.+?):(\d+):(\d+)\)/;
                const match = x.exec(expectation.stack);

                if (match && match.length > 2) {
                    issueCommand(
                        "error",
                        {
                            file: match[1],
                            line: match[2],
                            col: match[3]
                        },
                        result.fullName + " " + expectation.message
                    );
                } else {
                    issueCommand(
                        "error",
                        {},
                        result.fullName + " " + expectation.message
                    );
                }
            })

            issue("endgroup")
        })
    }

    specDone(result: jasmine.CustomReporterResult) {
        if (result.status === 'passed') {
            return;
        }
        this.failes.push(result);
    }
}

(global as any).currentSpec = null;
export class CurrentSpecReporter implements jasmine.CustomReporter {
    specStarted(result: jasmine.CustomReporterResult): void {
        (global as any).currentSpec = result; 
    }
    specDone(result: jasmine.CustomReporterResult): void {
        (global as any).currentSpec = null;
    }
}

async function waitForApi(): Promise<void> {
    for (let i = 0; i < 60; i++) {
        try {
            await testAPI()
            console.log("reached CIS api")
            return
        } catch (err) {
            console.log('Waiting ...')
        }
        await sleep(1000);
    }
    console.log("done")
    throw new Error('Timeout waiting for CIS to come online')
}

function sleep(timeout: number): Promise<void> {
    return new Promise<void>(resolve => {
        setTimeout(resolve, timeout)
    })
}

async function testAPI(): Promise<any> {
    const resp = await axios.get("http://localhost:3000/api/")
        .catch(err => err.response)
    if (resp?.status !== 200) {
        throw new Error(`unexpected status ${resp.status}`)
    }
}

function dockerCompose(args: string, env?: NodeJS.ProcessEnv) {
    execSync(`sh -c 'yes | docker-compose ${args}'`, {
        cwd: join('..', 'deploy'),
        env: env,
    })
}

async function main() {
    const Jasmine = require("jasmine")
    const runner = new Jasmine();
    const reporter = require("jasmine-console-reporter");

    // if we're not running on CI we might need to restart cisd
    // so import tasks get re-executed immediately
    if (!process.env['CI']) {
        dockerCompose('down -v')
        dockerCompose('up -d', {
            'CIS_BOOTSTRAP_ADMIN': 'password',
        })
        await waitForApi()
    }

    runner.loadConfig({
        spec_dir: "tests",
        spec_files: [
            "**/*.ts"
        ],
        helpers: [
            "../node_modules/ts-node/register/type-check.js"
        ],
        stopSpecOnExpectationFailure: false,
        random: false
    })
    runner.addReporter(new reporter())
    runner.addReporter(new CurrentSpecReporter())

    if (!!process.env['CI']) {
        runner.addReporter(new GHActionsReporter())
        await waitForApi();
    }

    runner.execute();
}

main().catch(err => {
    console.error(err);
    process.exit(-1)
})