import axios from 'axios';
import fs from 'fs';

const baseUrl = 'https://herocoders.atlassian.net/rest/api/3';
const projectKey = 'SP';

export async function getComponents() {
  try {
    const response = await axios.get(
      `${baseUrl}/project/${projectKey}/components`
    );
    return response.data;
  } catch (error) {
    console.error('Error retrieving components:', error);
    return [];
  }
}

export async function getIssues() {
  try {
    const response = await axios.get(
      `${baseUrl}/search?jql=project=${projectKey}`
    );
    return response.data;
  } catch (error) {
    console.error('Error retrieving issues:', error);
    return [];
  }
}

export async function countIssuesByComponent(components) {
  try {
    const componentIds = components.map((component) => component.id);
    const jqlQuery = `project = ${projectKey} AND component in (${componentIds.join(
      ','
    )})`;
    const response = await axios.get(
      `${baseUrl}/search?jql=${encodeURIComponent(jqlQuery)}&maxResults=0`
    );
    const totalIssues = response.data.total;
    const componentCounts = {};

    for (const component of components) {
      componentCounts[component.name] = 0;
    }

    if (totalIssues > 0) {
      const pageSize = 100;
      const totalPages = Math.ceil(totalIssues / pageSize);
      const pageRequests = Array.from({ length: totalPages }, (_, page) =>
        axios.get(
          `${baseUrl}/search?jql=${encodeURIComponent(
            jqlQuery
          )}&maxResults=${pageSize}&startAt=${page * pageSize}`
        )
      );
      const pageResponses = await Promise.all(pageRequests);

      for (const response of pageResponses) {
        for (const issue of response.data.issues) {
          if (issue.fields.components) {
            for (const component of issue.fields.components) {
              if (componentCounts[component.name] !== undefined) {
                componentCounts[component.name]++;
              }
            }
          }
        }
      }
    }

    return componentCounts;
  } catch (error) {
    console.error('Error counting issues by component:', error);
    return {};
  }
}

export async function findComponentsWithoutLead() {
  try {
    const [components, issuesData] = await Promise.all([
      getComponents(),
      getIssues(),
    ]);
    const componentsWithoutLead = components.filter((c) => !c.lead);

    const componentCounts = await countIssuesByComponent(componentsWithoutLead);

    for (const component of componentsWithoutLead) {
      component.issueCount = componentCounts[component.name];
    }

    return componentsWithoutLead;
  } catch (error) {
    console.error('Error finding components without lead:', error);
    return [];
  }
}

(async () => {
  try {
    const componentsWithoutLead = await findComponentsWithoutLead();
    const output = componentsWithoutLead
      .map((component) => `${component.name}: ${component.issueCount} issues`)
      .join('\n');
    fs.writeFileSync('output.txt', output);
    console.log('Output written to output.txt');
  } catch (error) {
    console.error('Error:', error);
  }
})();
