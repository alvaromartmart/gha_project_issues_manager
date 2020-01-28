# Project management for issues

This action manages issue cards on the specified project board reacting to different actions
- **issue is opened**: an issue card is added to the project
- **issue is labeled**: if a rule is set for that label, the issue card is moved to a specific column. Additional labels can be added or removed.

## Inputs

### `project`

**Required** The name of the project board, i.e. "Issues"

### `rules`

**Required** JSON string definining the array of rules that will be evaluated based on the label added to the issue. Each rule is specified by:
- **label**: name of the new label to match.
    > Only the first matching rule will be applied
- **column**: the column the card should be moved to
- **remove** (optional): array of label names to be removed

Example:
```json
[
    {
        "label": "inProgress",
        "column": "In progress",
    },
    {
        "label": "pendingReview",
        "column": "Pending review",
        "remove": ["inProgress"],
    }
]
```

## Outputs

### `message`

Arbitrary action output message.

## Example usage

```yaml
uses: alvaromartmart/gha_project_issues_manager/@master
with:
    project: Issues
    rules: '[
        { "label": "inProgress", "column": "In progress" },
        { "label": "pendingReview", "column": "Pending progress", "remove": ["inProgress"] }
    ]'
env:
    GITHUB_TOKEN: ${{secrets.GITHUB_TOKEN}}
```