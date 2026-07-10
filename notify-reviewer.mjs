import { writeFileSync, readFileSync, existsSync } from 'fs';

const GITLAB_BASE_URL = process.env.GITLAB_BASE_URL;
const GITLAB_TOKEN = process.env.GITLAB_TOKEN;
const GITLAB_USERNAME = process.env.GITLAB_USERNAME;
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const SLACK_USER_ID = process.env.SLACK_USER_ID;
const STATE_FILE = 'notified-mrs.json';

async function getOpenReviewRequests() {
  const url = `${GITLAB_BASE_URL}/api/v4/merge_requests?reviewer_username=${GITLAB_USERNAME}&state=opened&scope=all&per_page=100`;
  const res = await fetch(url, { headers: { 'PRIVATE-TOKEN': GITLAB_TOKEN } });
  if (!res.ok) throw new Error(`GitLab API error: ${res.status} ${await res.text()}`);
  return res.json();
}

async function sendSlackDM(text) {
  const res = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel: SLACK_USER_ID, text }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Slack API error: ${data.error}`);
}

const loadState = () => (existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, 'utf8')) : []);
const saveState = (ids) => writeFileSync(STATE_FILE, JSON.stringify(ids, null, 2));

const mrs = await getOpenReviewRequests();
const notified = loadState();
const newMrs = mrs.filter((mr) => !notified.includes(mr.id));

for (const mr of newMrs) {
  await sendSlackDM(`:eyes: You were requested as a reviewer on *${mr.title}*\n${mr.web_url}`);
  console.log(`Notified for MR #${mr.iid}: ${mr.title}`);
}

saveState(mrs.map((mr) => mr.id));
