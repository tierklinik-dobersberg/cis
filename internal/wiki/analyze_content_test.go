package wiki

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func Test_AnalyzeContent(t *testing.T) {
	cases := []struct {
		Input            string
		ExpectedMetadata *ContentMetadata
		ExpectedError    string
	}{
		{
			Input: `Some [Link](/path/to/document) content`,
			ExpectedMetadata: &ContentMetadata{
				References: []Reference{
					{
						Collection: "test-collection",
						Path:       "/path/to/document",
					},
				},
			},
			ExpectedError: "",
		},
		{
			Input: `Some [Link](col1#/path/to/document) content`,
			ExpectedMetadata: &ContentMetadata{
				References: []Reference{
					{
						Collection: "col1",
						Path:       "/path/to/document",
					},
				},
			},
			ExpectedError: "",
		},
	}

	for idx := range cases {
		testCase := cases[idx]

		t.Run(testCase.Input, func(t *testing.T) {
			t.Parallel()

			var result ContentMetadata
			err := AnalyzeContent("test-collection", testCase.Input, &result)

			if testCase.ExpectedError != "" {
				if !assert.Error(t, err) {
					return
				}
				if !assert.Contains(t, err.Error(), testCase.ExpectedError) {
					return
				}

				return
			}

			if testCase.ExpectedError == "" {
				if !assert.NoError(t, err) {
					return
				}

				assert.Equal(t, *testCase.ExpectedMetadata, result)
			}
		})
	}
}
