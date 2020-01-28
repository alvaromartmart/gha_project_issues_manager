import * as core from '@actions/core';
import * as github from '@actions/github';

const TOKEN = core.getInput('token') || (process.env.GITHUB_TOKEN as string);
const PROJECT_NAME = core.getInput('project') || process.env.PROJECT_NAME;
const gh = new github.GitHub(TOKEN);

const labelRules: { label: string; column: string; remove?: string[] }[] = JSON.parse(core.getInput('rules'));

async function listProjects() {
  console.log(`Listing projects...`);
  const projects = await gh.projects.listForRepo({
    repo: github.context.repo.repo,
    owner: github.context.repo.owner
  });
  return projects.data;
}

async function listColumns(columns_url: string, project_id: number) {
  console.log(`Getting project columns ${columns_url}/${project_id}...`);
  const columns = await gh.projects.listColumns({
    ...github.context.repo,
    url: columns_url,
    project_id
  });
  return columns.data;
}

async function getIssue() {
  const issueResult = await gh.issues.get({
    ...github.context.repo,
    issue_number: github.context.issue.number
  });
  return issueResult.data;
}

async function getProject() {
  console.log(`Getting project`);
  const projects = await gh.projects.listForRepo({
    ...github.context.repo
  });
  const project = projects.data.find(p => p.name === PROJECT_NAME);
  if (!project) {
    core.setFailed(`Project board '${PROJECT_NAME}' not found`)
  }
  return project;
}

function getColumnByName(columns: { name: string; id: number; url: string }[], name: string) {
  // console.log(`Getting column by name "${name}"`);
  const column = columns.find(col => col.name === name);
  // console.log(`${column?.name} (${column?.id}) - ${column?.url}`);
  return column;
}

async function createIssueCard(issue_id: number, column_id: number) {
  console.log(`Creating issue card`);
  return gh.projects.createCard({
    ...github.context.repo,
    column_id,
    content_id: issue_id,
    content_type: 'Issue'
  });
}

async function moveIssueCard(issue_url: string, column_id: number) {
  const project = await getProject();
  if (!project) return;
  const columns = await listColumns(project.columns_url, project.id);
  for (const column of columns) {
    const cards = (
      await gh.projects.listCards({
        column_id: column.id
      })
    ).data;
    let card = cards.find(c => c.content_url === issue_url);
    if (card !== undefined) {
      return gh.projects.moveCard({
        card_id: card.id,
        column_id,
        position: 'bottom'
      });
    }
  }
}

export async function run() {
  try {
    // created, labeled, unlabeled
    const action = github.context.payload.action;

    if (action && ['opened', 'labeled', 'unlabeled'].includes(action)) {
      const project = await getProject();
      if (!project) return;
      const columns = await listColumns(project.columns_url, project.id);
      const issue = await getIssue();
      switch (action) {
        case 'opened':
          const todoColumn = getColumnByName(columns, 'To do');
          if (todoColumn) {
            await createIssueCard(issue.id, todoColumn.id);
          }
          core.setOutput('message', `New issue card added to ${todoColumn?.name}`)
          break;
        case 'labeled':
          const columnMapping = labelRules.find(m => m.label === github.context.payload.label.name);
          if (columnMapping) {
            const column = getColumnByName(columns, columnMapping.column);
            if (column) {
              await moveIssueCard(issue.url, column.id);
            }
            if (columnMapping.remove !== undefined) {
              console.log(`Removing labels [${columnMapping.remove.join(', ')}]`);
              const labels = issue.labels.map(label => label.name).filter(label => !(columnMapping.remove || []).includes(label));
              await gh.issues.replaceLabels({
                ...github.context.issue,
                labels
              });
              core.setOutput('message', `Issue moved to ${column?.name}, with labels ${labels.join(', ')}`)
            }else{
              core.setOutput('message', `Issue moved to ${column?.name}`)
            }
          } else {
            core.setFailed(`No matching column found for ${github.context.payload.label}`);
          }
          break;
      }
    } else {
      console.log(`Irrelevant action: ${action}`);
      return;
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}
