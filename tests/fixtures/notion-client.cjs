// Loaded only by the synthetic Nx integration test; never calls Notion.
const { Client } = require('@notionhq/client');
Client.prototype.request = async function () {
  return { results: [], has_more: false };
};
