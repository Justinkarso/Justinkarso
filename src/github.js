import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname } from "node:path";

const QUERY = `
query($login: String!) {
  user(login: $login) {
    name
    login
    createdAt
    followers { totalCount }
    repositories(first: 100, ownerAffiliations: OWNER, isFork: false, orderBy: { field: STARGAZERS, direction: DESC }) {
      totalCount
      nodes { name stargazerCount }
    }
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount } }
      }
    }
  }
}`;

// The token comes from the environment in CI and from the gh CLI locally, so a
// normal `npm run preview` on a laptop needs no setup at all.
function token() {
  const fromEnv = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  if (fromEnv) return fromEnv;
  try {
    return execFileSync("gh", ["auth", "token"], { encoding: "utf8" }).trim();
  } catch {
    throw new Error("no GitHub token: set GITHUB_TOKEN or run `gh auth login`");
  }
}

async function query(login) {
  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      authorization: `bearer ${token()}`,
      "content-type": "application/json",
      "user-agent": "justinkarso-profile-banner",
    },
    body: JSON.stringify({ query: QUERY, variables: { login } }),
  });
  if (!response.ok) {
    throw new Error(`GitHub API ${response.status}: ${await response.text()}`);
  }
  const body = await response.json();
  if (body.errors) throw new Error(body.errors.map((e) => e.message).join("; "));
  return body.data.user;
}

// Consecutive days with at least one contribution, counted back from the most
// recent day that has data. Today counts as part of the streak only once it has
// something in it, which is how GitHub itself shows it.
function currentStreak(days) {
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].count > 0) streak += 1;
    else if (streak > 0 || i < days.length - 1) break;
  }
  return streak;
}

function longestStreak(days) {
  let best = 0;
  let run = 0;
  for (const day of days) {
    run = day.count > 0 ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

export async function collect(login, cachePath) {
  let user;
  if (cachePath && existsSync(cachePath) && process.env.BANNER_USE_CACHE === "1") {
    user = JSON.parse(readFileSync(cachePath, "utf8"));
  } else {
    user = await query(login);
    if (cachePath) {
      mkdirSync(dirname(cachePath), { recursive: true });
      writeFileSync(cachePath, JSON.stringify(user));
    }
  }

  const calendar = user.contributionsCollection.contributionCalendar;
  const weeks = calendar.weeks.map((w) =>
    w.contributionDays.map((d) => ({ date: d.date, count: d.contributionCount })),
  );
  const days = weeks.flat();
  const peak = Math.max(1, ...days.map((d) => d.count));
  const norm = Math.log1p(peak);

  return {
    name: user.name ?? user.login,
    login: user.login,
    since: new Date(user.createdAt).getUTCFullYear(),
    followers: user.followers.totalCount,
    repos: user.repositories.totalCount,
    stars: user.repositories.nodes.reduce((a, r) => a + r.stargazerCount, 0),
    contributions: calendar.totalContributions,
    peak,
    currentStreak: currentStreak(days),
    longestStreak: longestStreak(days),
    // Column-major, one column per calendar week, seven rows Sunday to Saturday.
    // Short weeks at either end are padded so the grid stays rectangular.
    grid: weeks.map((week) => {
      const column = new Array(7).fill(null);
      for (const day of week) column[new Date(day.date).getUTCDay()] = day;
      return column.map((day) => (day ? Math.log1p(day.count) / norm : -1));
    }),
    lastDay: days[days.length - 1]?.date ?? null,
  };
}
