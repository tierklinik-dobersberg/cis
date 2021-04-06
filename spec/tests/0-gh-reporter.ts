import { issue, issueCommand } from '@actions/core/lib/command'

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

jasmine.getEnv().addReporter(new GHActionsReporter())
