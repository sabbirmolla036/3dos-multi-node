const fs = require('fs');
const axios = require('axios');
const HttpsProxyAgent = require('https-proxy-agent');
const readline = require('readline');
const chalk = require('chalk');

const BASE_API = 'https://api.dashboard.3dos.io/api';

function readLines(filename) {
    if (!fs.existsSync(filename)) return [];
    return fs.readFileSync(filename, 'utf-8').split('\n').map(l => l.trim()).filter(Boolean);
}

function parseAccount(line) {
    const [email, password] = line.split(':');
    return { email, password };
}

function getProxyAgent(proxy) {
    if (!proxy) return undefined;
    let url = proxy;
    if (!/^https?:\/\//.test(proxy) && !/^socks[45]:\/\//.test(proxy)) {
        url = 'http://' + proxy;
    }
    return new HttpsProxyAgent(url);
}

async function prompt(question) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans); }));
}

async function login(email, password, agent) {
    try {
        const res = await axios.post(`${BASE_API}/auth/login`, {
            email, password
        }, {
            headers: { 'Content-Type': 'application/json' },
            httpsAgent: agent,
            proxy: false,
            timeout: 20000
        });
        if (res.data && res.data.status === 'Success') {
            return res.data.data.access_token;
        }
        return null;
    } catch (e) {
        return null;
    }
}

async function checkin(token, agent) {
    try {
        const res = await axios.post(`${BASE_API}/claim-reward`, { id: 'daily-reward-api' }, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            httpsAgent: agent,
            proxy: false,
            timeout: 20000
        });
        return res.data;
    } catch (e) {
        return null;
    }
}

async function runNode(nodeId, email, password, proxy) {
    const agent = getProxyAgent(proxy);
    console.log(chalk.cyan(`[Node ${nodeId}] Using proxy: ${proxy || 'None'}`));
    let token = await login(email, password, agent);
    if (!token) {
        console.log(chalk.red(`[Node ${nodeId}] Login failed.`));
        return;
    }
    console.log(chalk.green(`[Node ${nodeId}] Login success!`));
    // Example: do check-in every 12 hours
    while (true) {
        const res = await checkin(token, agent);
        if (res && res.status === 'Success') {
            console.log(chalk.green(`[Node ${nodeId}] Check-in success: +${res.data.points} pts`));
        } else if (res && res.status === 'Failed') {
            console.log(chalk.yellow(`[Node ${nodeId}] Already checked in today.`));
        } else {
            console.log(chalk.red(`[Node ${nodeId}] Check-in failed or token expired.`));
            // Try to re-login
            token = await login(email, password, agent);
            if (!token) {
                console.log(chalk.red(`[Node ${nodeId}] Re-login failed. Exiting node.`));
                return;
            }
            continue;
        }
        await new Promise(r => setTimeout(r, 12 * 60 * 60 * 1000)); // 12 hours
    }
}

(async () => {
    const accounts = readLines('main_account.txt');
    if (accounts.length === 0) {
        console.log(chalk.red('No accounts found in main_account.txt'));
        process.exit(1);
    }
    const { email, password } = parseAccount(accounts[0]);
    if (!email || !password) {
        console.log(chalk.red('Invalid account format in main_account.txt'));
        process.exit(1);
    }
    const proxies = readLines('proxies.txt');
    let maxNodes = 1;
    const maxAllowed = proxies.length > 0 ? proxies.length : 100;
    let input = await prompt(chalk.blue(`How many nodes to run in parallel? (1-${maxAllowed}): `));
    maxNodes = Math.max(1, Math.min(parseInt(input) || 1, maxAllowed));
    console.log(chalk.green(`Running ${maxNodes} node(s) for account: ${email}`));
    const tasks = [];
    for (let i = 0; i < maxNodes; ++i) {
        const proxy = proxies.length > 0 ? proxies[i % proxies.length] : null;
        tasks.push(runNode(i + 1, email, password, proxy));
        await new Promise(r => setTimeout(r, 1000)); // Stagger start for stability
    }
    await Promise.all(tasks);
})();
